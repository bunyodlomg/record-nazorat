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
// Default: faqat active student'lar (pending bot orqali ulangan, lekin tasdiqlanmaganlar — chiqmaydi)
router.get('/', asyncHandler(async (req, res) => {
  const baseFilter = await filterForUser(req);
  const filter = { ...baseFilter };
  if (req.query.groupId) filter.group = req.query.groupId;
  if (req.query.status)  filter.status = req.query.status;
  else                    filter.status = 'active';
  if (req.query.search) filter.name = new RegExp(req.query.search, 'i');

  const sortField = req.query.status === 'pending' ? '-createdAt' : '-score';
  const students = await Student.find(filter).sort(sortField)
    .populate('group', 'name code')
    .populate('teacher', 'name hue')
    .limit(Number(req.query.limit) || 200);
  res.json({ success:true, data: students });
}));

// GET /api/students/pending — teacher yoki admin uchun tasdiqlash kutayotgan ro'yxat
router.get('/pending/list', asyncHandler(async (req, res) => {
  const baseFilter = await filterForUser(req);
  const students = await Student.find({ ...baseFilter, status: 'pending' })
    .sort('-createdAt')
    .populate('group', 'name code')
    .populate('teacher', 'name hue')
    .lean();
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

// CREATE /api/students  (faqat admin — teacher endi faqat link orqali qo'sha oladi)
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

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success:false, message:"O'quvchini faqat admin qo'lda qo'sha oladi. Teacher link orqali qo'shadi." });
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

// PATCH /api/students/:id/approve — pending student'ni active qilish
// O'quvchini faqat o'sha guruh teacher'i tasdiqlay oladi (admin emas).
router.patch('/:id/approve', param('id').isMongoId(), ok, asyncHandler(async (req, res) => {
  const s = await Student.findById(req.params.id).populate('group', 'teacher name code');
  if (!s) return res.status(404).json({ success:false, message:"O'quvchi topilmadi" });

  const isOwnerTeacher = req.user.role === 'teacher' && req.user.teacherRef
    && String(s.group?.teacher) === String(req.user.teacherRef);
  if (!isOwnerTeacher) {
    return res.status(403).json({ success:false, message:"Faqat guruh o'qituvchisi o'quvchini tasdiqlay oladi" });
  }
  if (s.status === 'active') {
    return res.json({ success:true, data: s, message:'Allaqachon tasdiqlangan' });
  }

  s.status = 'active';
  await s.save();

  // Mavjud (tugatilmagan) homework'larga submission qo'shamiz
  const existingHw = await Homework.find({
    group: s.group._id,
    col: { $ne: 'done' },
  }).select('_id teacher').lean();
  if (existingHw.length) {
    const subDocs = existingHw.map(hw => ({
      homework: hw._id,
      student:  s._id,
      group:    s.group._id,
      teacher:  hw.teacher,
      status:   'pending',
    }));
    await Submission.insertMany(subDocs, { ordered:false }).catch(() => {});
    const activeCount = await Student.countDocuments({ group: s.group._id, status: 'active' });
    await Homework.updateMany(
      { _id: { $in: existingHw.map(h => h._id) } },
      { $set: { total: Math.max(activeCount, 1) } },
    );
  }

  // Botga "tasdiqlandingiz" xabari
  try {
    const { notifyStudentApproved } = require('../bot/notifications');
    notifyStudentApproved(s).catch(() => {});
  } catch {}

  const populated = await Student.findById(s._id)
    .populate('group', 'name code')
    .populate('teacher', 'name hue');
  res.json({ success:true, data: populated });
}));

// PATCH /api/students/:id/reject — pending student'ni o'chirish (rad etish)
// Faqat guruh teacher'i rad eta oladi (admin emas).
router.patch('/:id/reject', param('id').isMongoId(), ok, asyncHandler(async (req, res) => {
  const s = await Student.findById(req.params.id).populate('group', 'teacher name');
  if (!s) return res.status(404).json({ success:false, message:"O'quvchi topilmadi" });

  const isOwnerTeacher = req.user.role === 'teacher' && req.user.teacherRef
    && String(s.group?.teacher) === String(req.user.teacherRef);
  if (!isOwnerTeacher) {
    return res.status(403).json({ success:false, message:"Faqat guruh o'qituvchisi o'quvchini rad eta oladi" });
  }

  // Bot orqali kelgan student'lar uchun: bildirib qo'yamiz, keyin o'chiramiz
  try {
    const { notifyStudentRejected } = require('../bot/notifications');
    notifyStudentRejected(s).catch(() => {});
  } catch {}

  await Student.findByIdAndDelete(s._id);
  res.json({ success:true, message:'Rad etildi' });
}));

// POST /api/students/:id/message — teacher o'quvchiga bot orqali xabar/maqtov yuboradi
router.post('/:id/message',
  [
    param('id').isMongoId(),
    body('text').isString().trim().isLength({ min:1, max:1500 }),
    body('kind').optional().isIn(['message','praise']),
  ],
  ok, asyncHandler(async (req, res) => {
    const s = await Student.findById(req.params.id).populate('group', 'teacher name');
    if (!s) return res.status(404).json({ success:false, message:"O'quvchi topilmadi" });

    const isOwnerTeacher = req.user.role === 'teacher' && req.user.teacherRef
      && String(s.group?.teacher) === String(req.user.teacherRef);
    if (!isOwnerTeacher) {
      return res.status(403).json({ success:false, message:"Faqat o'z guruhingiz o'quvchisiga yoza olasiz" });
    }
    if (!s.telegramId) {
      return res.status(400).json({ success:false, message:"O'quvchining Telegram akkaunti topilmadi" });
    }

    const { sendStudentMessage } = require('../bot/notifications');
    const sent = await sendStudentMessage(s.telegramId, {
      kind: req.body.kind || 'message',
      text: req.body.text,
      from: req.user.name,
    });
    if (!sent) return res.status(502).json({ success:false, message:"Telegram orqali yuborib bo'lmadi" });

    res.json({ success:true, message:'Yuborildi' });
  })
);

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
