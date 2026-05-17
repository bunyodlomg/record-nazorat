const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Student    = require('../models/Student');
const Group      = require('../models/Group');
const Homework   = require('../models/Homework');
const Submission = require('../models/Submission');
const { protect, requireRole, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
const ok = (req,res,next) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ success:false, errors:e.array() });
  next();
};

router.use(protect, requireActive);

const filterForUser = async (req) => {
  if (req.user.role === 'admin') return {};
  if (req.user.role === 'teacher') {
    if (!req.user.teacherRef) return { _id: null }; // hech narsa
    const groups = await Group.find({ teacher: req.user.teacherRef }).select('_id');
    return { group: { $in: groups.map(g => g._id) } };
  }
  if (req.user.role === 'student') {
    if (!req.user.studentRef) return { _id: null };
    const me = await Student.findById(req.user.studentRef).select('group');
    if (!me) return { _id: null };
    return { group: me.group };
  }
  return { _id: null };
};

// LIST /api/students?groupId=&status=&search=
router.get('/', asyncHandler(async (req, res) => {
  const baseFilter = await filterForUser(req);
  const filter = { ...baseFilter };
  if (req.query.groupId) filter.group = req.query.groupId;
  if (req.query.status)  filter.status = req.query.status;
  else                    filter.status = { $ne: 'inactive' };
  if (req.query.search) filter.name = new RegExp(req.query.search, 'i');

  const students = await Student.find(filter).sort('-score')
    .populate('group', 'name code')
    .populate('teacher', 'name hue')
    .limit(Number(req.query.limit) || 200);
  res.json({ success:true, data: students });
}));

// GET /api/students/:id
router.get('/:id', param('id').isMongoId(), ok, asyncHandler(async (req, res) => {
  const baseFilter = await filterForUser(req);
  const s = await Student.findOne({ _id: req.params.id, ...baseFilter })
    .populate('group', 'name code level scheduleDays scheduleTime')
    .populate('teacher', 'name hue subject');
  if (!s) return res.status(404).json({ success:false, message:'O\'quvchi topilmadi' });
  res.json({ success:true, data: s });
}));

// CREATE /api/students  (admin yoki guruh teacheri)
router.post('/',
  [
    body('name').notEmpty().withMessage('Ism majburiy').isLength({ max:120 }).trim(),
    body('group').isMongoId().withMessage('Guruh tanlanishi kerak'),
    body('phone').optional({ nullable:true }).isString().trim(),
    body('notes').optional({ nullable:true }).isString().trim(),
  ],
  ok, asyncHandler(async (req, res) => {
    const group = await Group.findById(req.body.group);
    if (!group) return res.status(404).json({ success:false, message:"Guruh topilmadi" });

    const isOwnerTeacher = req.user.role === 'teacher' && req.user.teacherRef
      && String(group.teacher) === String(req.user.teacherRef);
    if (req.user.role !== 'admin' && !isOwnerTeacher) {
      return res.status(403).json({ success:false, message:"Ruxsat yo'q" });
    }

    const payload = {
      name:    req.body.name.trim(),
      group:   group._id,
      teacher: group.teacher,
      hue:     Math.floor(Math.random() * 360),
      status:  'active',
    };
    if (req.body.phone) payload.phone = req.body.phone.trim();
    if (req.body.notes) payload.notes = req.body.notes.trim();

    const student = await Student.create(payload);

    // Mavjud (tugatilmagan) homework'larga submission qo'shamiz
    const existingHw = await Homework.find({
      group: group._id,
      col: { $ne: 'done' },
    }).select('_id teacher').lean();
    if (existingHw.length) {
      const subDocs = existingHw.map(hw => ({
        homework: hw._id,
        student:  student._id,
        group:    group._id,
        teacher:  hw.teacher,
        status:   'pending',
      }));
      await Submission.insertMany(subDocs, { ordered:false }).catch(() => {});
      // Total = real active student soni (bo'sh guruhdagi placeholder qiymatni ham to'g'rilaydi)
      const activeCount = await Student.countDocuments({ group: group._id, status: 'active' });
      await Homework.updateMany(
        { _id: { $in: existingHw.map(h => h._id) } },
        { $set: { total: Math.max(activeCount, 1) } },
      );
    }

    const populated = await Student.findById(student._id)
      .populate('group', 'name code')
      .populate('teacher', 'name hue');
    res.status(201).json({ success:true, data: populated });
  })
);

// PATCH /api/students/:id  (admin va shu guruhning teacheri)
router.patch('/:id', param('id').isMongoId(), ok, asyncHandler(async (req, res) => {
  const s = await Student.findById(req.params.id).populate('group', 'teacher');
  if (!s) return res.status(404).json({ success:false, message:'O\'quvchi topilmadi' });

  const isOwnerTeacher = req.user.role === 'teacher' && req.user.teacherRef
    && String(s.group?.teacher) === String(req.user.teacherRef);
  if (req.user.role !== 'admin' && !isOwnerTeacher) {
    return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });
  }

  const fields = ['name','phone','notes','status','score','attendance','homeworkRate','hue'];
  const update = {};
  for (const f of fields) if (f in req.body) update[f] = req.body[f];

  const updated = await Student.findByIdAndUpdate(req.params.id, { $set: update }, { new:true, runValidators:true })
    .populate('group', 'name code')
    .populate('teacher', 'name hue');
  res.json({ success:true, data: updated });
}));

// DELETE /api/students/:id (admin yoki guruh teacheri)
router.delete('/:id', param('id').isMongoId(), ok, asyncHandler(async (req, res) => {
  const s = await Student.findById(req.params.id).populate('group', 'teacher');
  if (!s) return res.status(404).json({ success:false, message:'O\'quvchi topilmadi' });
  const isOwnerTeacher = req.user.role === 'teacher' && req.user.teacherRef
    && String(s.group?.teacher) === String(req.user.teacherRef);
  if (req.user.role !== 'admin' && !isOwnerTeacher) {
    return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });
  }
  await Student.findByIdAndDelete(req.params.id);
  res.json({ success:true, message:"O'chirildi" });
}));

module.exports = router;
