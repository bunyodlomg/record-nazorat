const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Group   = require('../models/Group');
const Student = require('../models/Student');
const { protect, requireRole, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { ensureLessonHomeworkForGroup } = require('../utils/ensureLessonHomework');

const router = express.Router();
const ok = (req,res,next) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ success:false, errors:e.array() });
  next();
};

router.use(protect, requireActive);

// LIST
router.get('/', asyncHandler(async (req,res) => {
  const { teacherId, level, isActive='true', page=1, limit=50 } = req.query;
  const filter = { isActive: isActive==='true' };
  if (teacherId) filter.teacher = teacherId;
  if (level)     filter.level   = level;

  // O'qituvchi faqat o'zining guruhlarini ko'radi (agar teacherId aniq bermagan bo'lsa)
  if (req.user.role === 'teacher' && !teacherId) {
    if (!req.user.teacherRef) return res.json({ success:true, data:[], pagination:{ total:0, page:1, limit } });
    filter.teacher = req.user.teacherRef;
  }

  const [data, total] = await Promise.all([
    Group.find(filter).populate('teacher','name email hue subject').sort('name')
      .skip((Number(page)-1)*Number(limit)).limit(Number(limit)),
    Group.countDocuments(filter),
  ]);

  // Students count har bir guruh uchun
  const groupIds = data.map(g => g._id);
  const counts = await Student.aggregate([
    { $match: { group: { $in: groupIds }, status: 'active' } },
    { $group: { _id: '$group', n: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map(c => [String(c._id), c.n]));
  const enriched = data.map(g => ({
    ...g.toObject({ virtuals:false }),
    teacher: g.teacher,
    studentCount: countMap[String(g._id)] || 0,
  }));

  res.json({ success:true, data: enriched, pagination:{ total, page:Number(page), limit:Number(limit) } });
}));

// GET ONE (with students)
router.get('/:id', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  const g = await Group.findById(req.params.id).populate('teacher','name email hue subject phone');
  if (!g) return res.status(404).json({ success:false, message:'Guruh topilmadi' });
  const students = await Student.find({ group: g._id, status:'active' }).sort('-score');
  res.json({ success:true, data: { ...g.toObject(), studentList: students, studentCount: students.length } });
}));

// Auto-generate ketma-ket group code: May-G1, May-G2, Iyun-G1, ...
// Oy nomi joriy yaratilgan sanaga ko'ra; N global ravishda shu oy ichidagi guruhlar +1.
const MONTHS_UZ = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
async function generateGroupCode() {
  const month  = MONTHS_UZ[new Date().getMonth()];
  const prefix = `${month}-G`;
  // Mongo case-insensitive uppercase sxema: code uppercase'ga aylantiriladi, shuning uchun regex'da i flag
  const rx = new RegExp(`^${prefix}\\d+$`, 'i');
  const existing = await Group.find({ code: rx }).select('code').lean();
  let maxN = 0;
  for (const g of existing) {
    const m = (g.code || '').match(/G(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxN) maxN = n;
    }
  }
  // Race-condition'ga qarshi keyingi bo'sh raqamni topamiz
  for (let i = 1; i <= 20; i++) {
    const code = `${prefix}${maxN + i}`;
    if (!(await Group.exists({ code: new RegExp(`^${code}$`, 'i') }))) return code;
  }
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}

// CREATE
router.post('/',
  [
    body('name').notEmpty().withMessage("Nom majburiy"),
    body('code').optional({ nullable:true }).isString().trim(),
    body('level').optional({ nullable:true }).isIn(['A1','A2','B1','B2','C1','C2','Beginner','Intermediate','Advanced','Olympiad']),
    body('scheduleDays').optional().isArray(),
    body('scheduleTime').optional({ nullable:true }).isString().trim(),
    body('teacher').optional({ nullable:true }).isMongoId(),
  ],
  ok, asyncHandler(async (req,res) => {
    const payload = { ...req.body };
    // Teacher o'zining guruhini yaratadi (teacherRef avtomatik)
    if (req.user.role === 'teacher') {
      if (!req.user.teacherRef) return res.status(400).json({ success:false, message:'Teacher profiliga bog\'lanmagan' });
      payload.teacher = req.user.teacherRef;
    } else if (!payload.teacher) {
      return res.status(400).json({ success:false, message:"O'qituvchi tanlanishi kerak" });
    }
    // Code har doim avtomatik — qo'lda kiritilgan bo'lsa ham e'tibor berilmaydi
    payload.code = await generateGroupCode();
    const g = await Group.create(payload);
    await g.populate('teacher','name email hue subject');
    // Bugun yoki o'tgan dars kunlari uchun avto-vazifa
    ensureLessonHomeworkForGroup(g._id).catch(() => {});
    res.status(201).json({ success:true, data:g });
  })
);

const canEditGroup = (req, group) => {
  if (req.user.role === 'admin') return true;
  return req.user.role === 'teacher' && req.user.teacherRef && String(group.teacher) === String(req.user.teacherRef);
};

// UPDATE
router.patch('/:id', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  const existing = await Group.findById(req.params.id);
  if (!existing) return res.status(404).json({ success:false, message:'Guruh topilmadi' });
  if (!canEditGroup(req, existing)) return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });

  delete req.body._id;
  if (req.user.role === 'teacher') delete req.body.teacher; // teacher boshqa o'qituvchini yozolmasin
  const g = await Group.findByIdAndUpdate(req.params.id, { $set:req.body }, { new:true, runValidators:true })
    .populate('teacher','name email hue subject');
  res.json({ success:true, data:g });
}));

// DELETE
router.delete('/:id', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  const existing = await Group.findById(req.params.id);
  if (!existing) return res.status(404).json({ success:false, message:'Guruh topilmadi' });
  if (!canEditGroup(req, existing)) return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });
  await Group.findByIdAndDelete(req.params.id);
  // Studentlarni inactive qilish (yo'qotmaslik uchun)
  await Student.updateMany({ group: req.params.id }, { $set: { status:'inactive' } });
  res.json({ success:true, message:"O'chirildi" });
}));

module.exports = router;
