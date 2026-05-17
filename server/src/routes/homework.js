const express  = require('express');
const mongoose = require('mongoose');
const { body, param, validationResult } = require('express-validator');
const Homework   = require('../models/Homework');
const Submission = require('../models/Submission');
const Student    = require('../models/Student');
const { protect, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { ensureLessonHomeworkForTeacher, ensureLessonHomeworkForAll } = require('../utils/ensureLessonHomework');

const router = express.Router();
router.use(protect, requireActive);

const ok = (req,res,next) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ success:false, errors:e.array() });
  next();
};

// LIST  GET /api/homework?col=pending&teacherId=&groupId=
router.get('/', asyncHandler(async (req,res) => {
  const { col, teacherId, groupId, page=1, limit=50 } = req.query;
  const filter = {};
  if (col)       filter.col     = col;
  if (teacherId) filter.teacher = teacherId;
  if (groupId)   filter.group   = groupId;
  // Teacher faqat o'zining vazifalarini ko'radi
  if (req.user.role === 'teacher' && !teacherId) {
    if (!req.user.teacherRef) return res.json({ success:true, data:[] });
    filter.teacher = req.user.teacherRef;
  }

  // Avto vazifa yaratish — dars kunlari bo'yicha yetishmagan vazifalar
  try {
    if (req.user.role === 'teacher' && req.user.teacherRef) {
      await ensureLessonHomeworkForTeacher(req.user.teacherRef);
    } else if (req.user.role === 'admin') {
      if (teacherId)      await ensureLessonHomeworkForTeacher(teacherId);
      else if (!groupId)  await ensureLessonHomeworkForAll();
    }
  } catch (e) { /* sukut — list'ni baribir qaytaramiz */ }

  const [data, total] = await Promise.all([
    Homework.find(filter).populate('teacher','name hue').populate('group','name code')
      .sort({ dueDate:-1 }).skip((Number(page)-1)*Number(limit)).limit(Number(limit)),
    Homework.countDocuments(filter),
  ]);
  res.json({ success:true, data, pagination:{ total, page:Number(page), limit:Number(limit) } });
}));

// STATS  GET /api/homework/stats
router.get('/stats', asyncHandler(async (req,res) => {
  const agg  = await Homework.aggregate([{ $group:{ _id:'$col', count:{ $sum:1 } } }]);
  const stat = Object.fromEntries(agg.map(a=>[a._id, a.count]));
  res.json({ success:true, data:{ pending:stat.pending||0, checking:stat.checking||0, done:stat.done||0 } });
}));

// OVERDUE  GET /api/homework/overdue  — muddati o'tgan + tekshirilmagan
router.get('/overdue', asyncHandler(async (req,res) => {
  const filter = {
    dueDate: { $lt: new Date() },
    col: { $ne: 'done' },
  };
  if (req.user.role === 'teacher') {
    if (!req.user.teacherRef) return res.json({ success:true, data:[] });
    filter.teacher = req.user.teacherRef;
  }
  const items = await Homework.find(filter)
    .populate('teacher','name hue')
    .populate('group','name code')
    .sort({ dueDate: 1 })
    .lean();
  const now = Date.now();
  const data = items.map(hw => {
    const overdueMs = now - new Date(hw.dueDate).getTime();
    const overdueDays = Math.floor(overdueMs / (24 * 60 * 60 * 1000));
    return { ...hw, overdueDays };
  });
  res.json({ success:true, data });
}));

// GET ONE
router.get('/:id', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  const hw = await Homework.findById(req.params.id).populate('teacher','name hue').populate('group','name code');
  if (!hw) return res.status(404).json({ success:false, message:'Not found' });
  res.json({ success:true, data:hw });
}));

// SUBMISSIONS  GET /api/homework/:id/submissions
router.get('/:id/submissions', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  const subs = await Submission.find({ homework: req.params.id })
    .populate('student', 'name hue photoUrl telegramUsername')
    .lean();
  // Sort by status (pending first → submitted → reviewed → returned), then by name
  const order = { pending:0, submitted:1, returned:2, reviewed:3 };
  subs.sort((a, b) => {
    const sa = order[a.status] ?? 99;
    const sb = order[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    return (a.student?.name || '').localeCompare(b.student?.name || '');
  });
  res.json({ success:true, data: subs });
}));

// CREATE
router.post('/',
  [
    body('title').notEmpty(),
    body('group').isMongoId(),
    body('teacher').isMongoId(),
    body('dueDate').isISO8601(),
  ],
  ok, asyncHandler(async (req,res) => {
    const payload = { ...req.body };
    delete payload.total; delete payload.submissions; delete payload.progress; // auto

    // Student soni asosida total
    const students = await Student.find({ group: payload.group, status: 'active' }).select('_id').lean();
    payload.total = Math.max(students.length, 1);

    const hw = await Homework.create(payload);

    // Har student uchun pending submission
    if (students.length) {
      const docs = students.map(s => ({
        homework: hw._id,
        student:  s._id,
        group:    hw.group,
        teacher:  hw.teacher,
        status:   'pending',
      }));
      await Submission.insertMany(docs, { ordered: false }).catch(() => {});
    }

    await Submission.recomputeHomework(hw._id);
    const updated = await Homework.findById(hw._id).populate('teacher','name hue').populate('group','name code');
    res.status(201).json({ success:true, data: updated });
  })
);

// UPDATE
router.patch('/:id', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  delete req.body._id;
  delete req.body.total; delete req.body.submissions; delete req.body.progress; // auto
  const hw = await Homework.findByIdAndUpdate(req.params.id, { $set:req.body }, { new:true, runValidators:true });
  if (!hw) return res.status(404).json({ success:false, message:'Not found' });
  res.json({ success:true, data:hw });
}));

// MOVE (Kanban column)
router.patch('/:id/move',
  [param('id').isMongoId(), body('col').isIn(['pending','checking','done'])],
  ok, asyncHandler(async (req,res) => {
    const hw = await Homework.findByIdAndUpdate(req.params.id, { col:req.body.col }, { new:true });
    if (!hw) return res.status(404).json({ success:false, message:'Not found' });
    res.json({ success:true, data:hw });
  })
);

// DELETE — cascade submissions
router.delete('/:id', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  const hw = await Homework.findByIdAndDelete(req.params.id);
  if (!hw) return res.status(404).json({ success:false, message:'Not found' });
  await Submission.deleteMany({ homework: req.params.id });
  res.json({ success:true, message:'Deleted' });
}));

module.exports = router;
