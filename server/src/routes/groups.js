const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Group      = require('../models/Group');
const Student    = require('../models/Student');
const Homework   = require('../models/Homework');
const Submission = require('../models/Submission');
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

const buildStudentInviteLink = (token) => {
  const username = process.env.BOT_USERNAME;
  if (!username || !token) return null;
  return `https://t.me/${username}?start=g_${token}`;
};

// LIST
router.get('/', asyncHandler(async (req,res) => {
  const { teacherId, level, isActive='true', page=1, limit=50 } = req.query;
  // isActive: 'true' → faol guruhlar (default), 'false' → yopilganlar, 'all' → hammasi
  const filter = {};
  if (isActive === 'true')  filter.isActive = true;
  if (isActive === 'false') filter.isActive = false;
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

  // Students count va top gem oluvchi har bir guruh uchun
  const groupIds = data.map(g => g._id);
  const [counts, topStudents] = await Promise.all([
    Student.aggregate([
      { $match: { group: { $in: groupIds }, status: 'active' } },
      { $group: { _id: '$group', n: { $sum: 1 }, totalGems: { $sum: '$gems' } } },
    ]),
    // Har guruh uchun eng yuqori gem oluvchi (gems > 0)
    Student.aggregate([
      { $match: { group: { $in: groupIds }, status: 'active', gems: { $gt: 0 } } },
      { $sort: { group: 1, gems: -1 } },
      { $group: { _id: '$group', topName: { $first: '$name' }, topGems: { $first: '$gems' }, topHue: { $first: '$hue' }, topId: { $first: '$_id' } } },
    ]),
  ]);
  const countMap = Object.fromEntries(counts.map(c => [String(c._id), c]));
  const topMap   = Object.fromEntries(topStudents.map(t => [String(t._id), t]));
  const enriched = data.map(g => {
    const id = String(g._id);
    const top = topMap[id];
    return {
      ...g.toObject({ virtuals:false }),
      teacher: g.teacher,
      studentCount: countMap[id]?.n || 0,
      totalGems:    countMap[id]?.totalGems || 0,
      topStudent:   top ? { _id: top.topId, name: top.topName, gems: top.topGems, hue: top.topHue } : null,
    };
  });

  res.json({ success:true, data: enriched, pagination:{ total, page:Number(page), limit:Number(limit) } });
}));

// GET ONE — to'liq guruh ma'lumoti: students + pending + homework + stats + invite link
router.get('/:id', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  const g = await Group.findById(req.params.id).populate('teacher','name email hue subject phone telegramUsername');
  if (!g) return res.status(404).json({ success:false, message:'Guruh topilmadi' });

  // Ko'rish ruxsati: admin har doim, teacher — faqat o'zining guruhi
  const teacherIdStr = String(g.teacher?._id || g.teacher);
  if (req.user.role === 'teacher' && (!req.user.teacherRef || teacherIdStr !== String(req.user.teacherRef))) {
    return res.status(403).json({ success:false, message:"Ruxsat yo'q" });
  }

  const [activeStudents, pendingStudents, recentHw, pendingSubAgg, gemAgg] = await Promise.all([
    Student.find({ group: g._id, status:'active' }).sort('-gems -score').lean(),
    Student.find({ group: g._id, status:'pending' }).sort('-createdAt').lean(),
    Homework.find({ group: g._id }).sort('-dueDate').limit(20).lean(),
    Submission.aggregate([
      { $match: { group: g._id } },
      { $group: { _id: '$student', pending: { $sum: { $cond: [{ $ne: ['$status', 'reviewed'] }, 1, 0] } } } },
    ]),
    Student.aggregate([
      { $match: { group: g._id, status:'active' } },
      { $group: { _id: null, totalGems: { $sum: '$gems' }, avgScore: { $avg: '$score' } } },
    ]),
  ]);

  const pendMap = Object.fromEntries(pendingSubAgg.map(p => [String(p._id), p.pending]));
  const enrichedStudents = activeStudents.map(s => ({
    ...s,
    pendingSubmissions: pendMap[String(s._id)] || 0,
  }));

  const completedHw = recentHw.filter(h => h.col === 'done').length;
  const pendingHw   = recentHw.filter(h => h.col !== 'done').length;

  // Invite link — guruhga avval generatsiya qilingan token bo'lsa
  const inviteLink = g.inviteToken ? buildStudentInviteLink(g.inviteToken) : null;

  res.json({
    success: true,
    data: {
      ...g.toObject(),
      studentList:         enrichedStudents,
      studentCount:        enrichedStudents.length,
      pendingStudents,
      pendingStudentCount: pendingStudents.length,
      homework:            recentHw,
      inviteLink,
      stats: {
        totalGems:   gemAgg?.[0]?.totalGems || 0,
        avgScore:    Math.round(gemAgg?.[0]?.avgScore || 0),
        totalHw:     recentHw.length,
        completedHw,
        pendingHw,
      },
    },
  });
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
    body('speakingPerWeek').optional().isInt({ min:0, max:7 }),
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

// GET /api/groups/:id/invite-link — joriy token (yo'q bo'lsa yaratiladi)
router.get('/:id/invite-link', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  const g = await Group.findById(req.params.id);
  if (!g) return res.status(404).json({ success:false, message:'Guruh topilmadi' });
  if (!canEditGroup(req, g)) return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });

  if (!g.inviteToken) {
    g.inviteToken = Group.generateInviteToken();
    await g.save();
  }
  res.json({ success:true, data: { token: g.inviteToken, link: buildStudentInviteLink(g.inviteToken) } });
}));

// POST /api/groups/:id/invite-link/rotate — yangi token (eski link bekor)
router.post('/:id/invite-link/rotate', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  const g = await Group.findById(req.params.id);
  if (!g) return res.status(404).json({ success:false, message:'Guruh topilmadi' });
  if (!canEditGroup(req, g)) return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });

  g.inviteToken = Group.generateInviteToken();
  await g.save();
  res.json({ success:true, data: { token: g.inviteToken, link: buildStudentInviteLink(g.inviteToken) } });
}));

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

// DELETE — guruh + bog'liq o'quvchilar + vazifalar + submissionlar hammasi o'chiriladi (cascade)
router.delete('/:id', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  const existing = await Group.findById(req.params.id);
  if (!existing) return res.status(404).json({ success:false, message:'Guruh topilmadi' });
  if (!canEditGroup(req, existing)) return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });

  const groupId = existing._id;
  const [subRes, hwRes, stRes] = await Promise.all([
    Submission.deleteMany({ group: groupId }),
    Homework.deleteMany({ group: groupId }),
    Student.deleteMany({ group: groupId }),
  ]);
  await Group.findByIdAndDelete(groupId);

  res.json({
    success: true,
    message: "O'chirildi",
    data: {
      students:    stRes.deletedCount  || 0,
      homework:    hwRes.deletedCount  || 0,
      submissions: subRes.deletedCount || 0,
    },
  });
}));

module.exports = router;
