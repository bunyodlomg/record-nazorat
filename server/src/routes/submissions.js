const express  = require('express');
const { body, param, validationResult } = require('express-validator');
const Submission = require('../models/Submission');
const Teacher    = require('../models/Teacher');
const { protect, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(protect, requireActive);

const ok = (req,res,next) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ success:false, errors:e.array() });
  next();
};

// LIST  GET /api/submissions?homework=&student=&status=
router.get('/', asyncHandler(async (req, res) => {
  const { homework, student, status } = req.query;
  const filter = {};
  if (homework) filter.homework = homework;
  if (student)  filter.student  = student;
  if (status)   filter.status   = status;
  if (req.user.role === 'teacher') {
    if (!req.user.teacherRef) return res.json({ success:true, data:[] });
    filter.teacher = req.user.teacherRef;
  }
  const data = await Submission.find(filter)
    .populate('student',  'name hue photoUrl telegramUsername')
    .populate('homework', 'title dueDate')
    .populate('group',    'name code')
    .sort('-updatedAt')
    .lean();
  res.json({ success:true, data });
}));

// PATCH  /api/submissions/:id  — status / score / feedback
router.patch('/:id',
  [
    param('id').isMongoId(),
    body('status').optional().isIn(['pending','submitted','reviewed','returned']),
    body('score').optional({ nullable:true }).isInt({ min:0, max:100 }),
    body('feedback').optional({ nullable:true }).isString().isLength({ max:500 }),
  ],
  ok, asyncHandler(async (req, res) => {
    const sub = await Submission.findById(req.params.id);
    if (!sub) return res.status(404).json({ success:false, message:'Not found' });

    // Faqat o'sha vazifaning teacher'i yoki admin yangilay oladi
    if (req.user.role !== 'admin') {
      if (req.user.role !== 'teacher' || String(sub.teacher) !== String(req.user.teacherRef)) {
        return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });
      }
    }

    const { status, score, feedback } = req.body;
    if (status   !== undefined) {
      sub.status = status;
      if (status === 'submitted' && !sub.submittedAt) sub.submittedAt = new Date();
      if (status === 'reviewed')                       sub.reviewedAt  = new Date();
    }
    if (score    !== undefined) sub.score    = score;
    if (feedback !== undefined) sub.feedback = feedback;

    await sub.save();
    await Submission.recomputeHomework(sub.homework);

    if (status === 'reviewed' || status === 'returned') {
      Teacher.updateOne({ _id: sub.teacher }, { $set: { lastReviewedAt: new Date() } }).catch(() => {});
    }

    const updated = await Submission.findById(sub._id)
      .populate('student','name hue photoUrl telegramUsername').lean();
    res.json({ success:true, data: updated });
  })
);

// BULK PATCH  /api/submissions/bulk  — bir nechta submissionni birvarakayiga
router.patch('/bulk',
  [
    body('ids').isArray({ min:1 }),
    body('ids.*').isMongoId(),
    body('status').isIn(['pending','submitted','reviewed','returned']),
  ],
  ok, asyncHandler(async (req, res) => {
    const { ids, status } = req.body;
    const filter = { _id: { $in: ids } };
    if (req.user.role !== 'admin') {
      if (req.user.role !== 'teacher' || !req.user.teacherRef) {
        return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });
      }
      filter.teacher = req.user.teacherRef;
    }
    const subs = await Submission.find(filter).select('homework teacher').lean();
    const set = { status };
    if (status === 'reviewed')  set.reviewedAt  = new Date();
    if (status === 'submitted') set.submittedAt = new Date();
    await Submission.updateMany(filter, { $set: set });

    const hwIds = [...new Set(subs.map(s => String(s.homework)))];
    await Promise.all(hwIds.map(id => Submission.recomputeHomework(id)));

    if (status === 'reviewed' || status === 'returned') {
      const teacherIds = [...new Set(subs.map(s => String(s.teacher)))];
      Teacher.updateMany({ _id:{ $in:teacherIds } }, { $set:{ lastReviewedAt:new Date() } }).catch(() => {});
    }

    res.json({ success:true, updated: subs.length });
  })
);

module.exports = router;
