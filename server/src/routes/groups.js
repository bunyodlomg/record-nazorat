const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Group      = require('../models/Group');
const Student    = require('../models/Student');
const Homework   = require('../models/Homework');
const Submission = require('../models/Submission');
const User       = require('../models/User');
const { sendPhotoTo } = require('../bot/notifications');
const { protect, requireRole, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { ensureLessonHomeworkForGroup } = require('../utils/ensureLessonHomework');
const { getTeacherPhotoMap } = require('../utils/teacherPhotos');

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
  // Teacher rasmlari User'da — guruh egasi rasmini qo'shamiz
  const photoMap = await getTeacherPhotoMap(data.map(g => g.teacher?._id || g.teacher));
  const enriched = data.map(g => {
    const id = String(g._id);
    const top = topMap[id];
    const tObj = g.teacher
      ? { ...(g.teacher.toObject ? g.teacher.toObject() : g.teacher), photoUrl: photoMap[String(g.teacher._id || g.teacher)] || null }
      : g.teacher;
    return {
      ...g.toObject({ virtuals:false }),
      teacher: tObj,
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

  // Teacher rasmi (User'da) — guruh egasiga qo'shamiz
  const gObj = g.toObject();
  if (gObj.teacher) {
    const tid = String(gObj.teacher._id || gObj.teacher);
    const photoMap = await getTeacherPhotoMap([tid]);
    gObj.teacher = { ...gObj.teacher, photoUrl: photoMap[tid] || null };
  }

  res.json({
    success: true,
    data: {
      ...gObj,
      studentList:         enrichedStudents,
      studentCount:        enrichedStudents.length,
      pendingStudents,
      pendingStudentCount: pendingStudents.length,
      homework:            recentHw,
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

// ── TZ yordamchisi — kun chegaralari Asia/Tashkent (UTC+5) bo'yicha ──
const TZ_MIN = 5 * 60; // UTC+5
const dayKeyTash = (date) => new Date(new Date(date).getTime() + TZ_MIN * 60000).toISOString().slice(0, 10);

// GET /api/groups/:id/submission-matrix
// Guruh ochilgan kundan (startDate) bugungacha — har dars kuni uchun
// har bir o'quvchining topshirgan/topshirmagan holati.
// Qatorlar (tbody) = sanalar, ustunlar = o'quvchilar. Admin + guruh teacher'i ko'ra oladi.
router.get('/:id/submission-matrix', param('id').isMongoId(), ok, asyncHandler(async (req, res) => {
  const g = await Group.findById(req.params.id).select('teacher startDate createdAt name offDays').lean();
  if (!g) return res.status(404).json({ success:false, message:'Guruh topilmadi' });

  // Ruxsat: admin har doim, teacher — faqat o'zining guruhi
  const teacherIdStr = String(g.teacher);
  if (req.user.role === 'teacher' && (!req.user.teacherRef || teacherIdStr !== String(req.user.teacherRef))) {
    return res.status(403).json({ success:false, message:"Ruxsat yo'q" });
  }

  const now   = new Date();
  const start = new Date(g.startDate || g.createdAt || now);
  // startDate vaqt komponenti bilan saqlangan bo'lishi mumkin (masalan 10:00).
  // O'sha kunning yarim tundagi (00:00) dars vazifasi so'rovdan chetda qolib
  // ustun kulrang "off" bo'lib chiqmasligi uchun quyi chegarani kun boshiga
  // (TZ zaxirasi bilan) tushiramiz.
  const startBound = new Date(new Date(dayKeyTash(start) + 'T00:00:00Z').getTime() - 12 * 3600 * 1000);

  const [students, homeworks] = await Promise.all([
    Student.find({ group: g._id, status: 'active' })
      .select('name hue photoUrl joinedAt createdAt').sort('name').lean(),
    Homework.find({ group: g._id, dueDate: { $gte: startBound, $lte: now } })
      .select('dueDate kind title').sort('dueDate').lean(),
  ]);

  // Vazifalarni kun bo'yicha guruhlash (faqat vazifa bo'lgan kunlar qatorga tushadi)
  const dayMap = {}; // dayKey → { key, dueDate, total }
  for (const h of homeworks) {
    const k = dayKeyTash(h.dueDate);
    (dayMap[k] ||= { key: k, dueDate: h.dueDate, total: 0 });
    dayMap[k].total += 1;
  }
  const allHwIds = homeworks.map(h => h._id);

  const submissions = allHwIds.length
    ? await Submission.find({ homework: { $in: allHwIds }, student: { $in: students.map(s => s._id) } })
        .select('homework student status').lean()
    : [];

  const hwDay = Object.fromEntries(homeworks.map(h => [String(h._id), dayKeyTash(h.dueDate)]));
  // student|dayKey → topshirilgan (submitted yoki reviewed) soni
  const doneAgg = {};
  for (const sub of submissions) {
    const dk = hwDay[String(sub.homework)];
    if (!dk) continue;
    if (sub.status === 'submitted' || sub.status === 'reviewed') {
      const ck = `${sub.student}|${dk}`;
      doneAgg[ck] = (doneAgg[ck] || 0) + 1;
    }
  }

  const WD = ['Yak', 'Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha']; // Sun..Sat
  const todayKey = dayKeyTash(now);

  // start → bugungача BARCHA kunlarni ustun qilamiz. Vazifasiz kunlar (dam olish)
  // alohida "off" holatida — jadval/rasmda kulrang ustun bo'lib chiqadi.
  const allDayKeys = [];
  {
    let d = new Date(dayKeyTash(start) + 'T00:00:00Z');
    for (let guard = 0; guard < 400; guard++) {
      const k = d.toISOString().slice(0, 10);
      allDayKeys.push(k);
      if (k >= todayKey) break;
      d = new Date(d.getTime() + 86400000);
    }
  }

  const rows = allDayKeys.map(k => {
    const dt   = new Date(k + 'T00:00:00Z'); // k allaqachon Toshkent sanasi
    const meta = dayMap[k];
    const cells = {};

    if (meta) {
      for (const s of students) {
        const joinedKey = dayKeyTash(s.joinedAt || s.createdAt || start);
        // O'quvchi shu kundan keyin qo'shilgan bo'lsa — hisobga olinmaydi
        if (joinedKey > k) { cells[String(s._id)] = { status: 'none' }; continue; }
        const done = doneAgg[`${s._id}|${k}`] || 0;
        let status;
        if (done >= meta.total)      status = 'done';
        else if (done > 0)           status = 'partial';
        else if (k > todayKey)       status = 'upcoming';
        else                         status = 'missed';
        cells[String(s._id)] = { status, done, total: meta.total };
      }
    } else {
      // Vazifasiz kun — dam olish. Butun ustun bir xil "off".
      for (const s of students) cells[String(s._id)] = { status: 'off' };
    }

    return {
      key:   k,
      dom:   dt.getUTCDate(),
      month: dt.getUTCMonth() + 1,
      dow:   WD[dt.getUTCDay()],
      off:   !meta,
      total: meta ? meta.total : 0,
      cells,
    };
  });

  // O'quvchi bo'yicha umumiy ko'rsatkich (done / baholangan kunlar)
  const summary = {};
  for (const s of students) {
    let done = 0, partial = 0, missed = 0;
    for (const r of rows) {
      const c = r.cells[String(s._id)];
      if (!c || c.status === 'none' || c.status === 'upcoming' || c.status === 'off') continue;
      if (c.status === 'done') done++;
      else if (c.status === 'partial') partial++;
      else if (c.status === 'missed') missed++;
    }
    const graded = done + partial + missed;
    summary[String(s._id)] = { done, partial, missed, rate: graded ? Math.round((done / graded) * 100) : null };
  }

  res.json({ success:true, data: {
    startDate: start,
    offDays: (g.offDays || []).map(d => dayKeyTash(d)).sort(),
    students: students.map(s => ({ _id: s._id, name: s.name, hue: s.hue, photoUrl: s.photoUrl || null })),
    rows,
    summary,
  }});
}));

// POST /api/groups/:id/matrix-image
// Statistika jadvali rasmini (client Canvas'da chizadi) bot orqali so'ragan
// foydalanuvchining O'Z Telegram chatiga guruh ma'lumotlari bilan yuboradi.
const DAY_LABELS = { mon:'Du', tue:'Se', wed:'Cho', thu:'Pay', fri:'Ju', sat:'Sha', sun:'Yak' };

router.post('/:id/matrix-image',
  param('id').isMongoId(),
  body('image').isString().notEmpty().withMessage('Rasm majburiy'),
  body('period').optional().isString().isLength({ max:120 }),
  ok,
  asyncHandler(async (req, res) => {
    const g = await Group.findById(req.params.id)
      .select('name code teacher scheduleDays').populate('teacher', 'name').lean();
    if (!g) return res.status(404).json({ success:false, message:'Guruh topilmadi' });

    // Ruxsat: admin har doim, teacher — faqat o'zining guruhi
    if (req.user.role === 'teacher' && (!req.user.teacherRef || String(g.teacher?._id) !== String(req.user.teacherRef))) {
      return res.status(403).json({ success:false, message:"Ruxsat yo'q" });
    }

    const me = await User.findById(req.user.id).select('telegramId').lean();
    if (!me?.telegramId) {
      return res.status(400).json({ success:false, message:"Telegram hisobingiz bog'lanmagan. Mini App'ni Telegram bot orqali oching." });
    }

    const m = String(req.body.image).match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return res.status(422).json({ success:false, message:"Rasm formati noto'g'ri" });
    const buffer = Buffer.from(m[1], 'base64');
    if (buffer.length > 8 * 1024 * 1024) {
      return res.status(413).json({ success:false, message:'Rasm juda katta' });
    }

    const studentCount = await Student.countDocuments({ group:g._id, status:'active' });
    const days = (g.scheduleDays || []).map(d => DAY_LABELS[d]).filter(Boolean).join(' · ');
    const sentAt = new Date().toLocaleString('uz-UZ', { timeZone:'Asia/Tashkent', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

    const caption =
      `📊 ${g.name} — vazifa statistikasi\n` +
      (g.code ? `🏷 Kod: ${g.code}\n` : '') +
      `👨‍🏫 O'qituvchi: ${g.teacher?.name || "Biriktirilmagan"}\n` +
      `👥 O'quvchilar: ${studentCount} ta\n` +
      (days ? `🗓 Dars kunlari: ${days}\n` : '') +
      (req.body.period ? `📅 Davr: ${req.body.period}\n` : '') +
      `⏰ ${sentAt}`;

    const sent = await sendPhotoTo(me.telegramId, buffer, caption);
    if (!sent) {
      return res.status(502).json({ success:false, message:"Telegram'ga yuborib bo'lmadi. Botga /start yuborganingizni tekshiring." });
    }
    res.json({ success:true, message:'Telegramga yuborildi', data:{} });
  })
);

// PATCH /api/groups/:id/off-day — sanani dam olish / mock kuni qilish yoki bekor qilish
// off:true  → sana offDays'ga qo'shiladi, o'sha kunning AVTO-dars vazifasi (+submission) o'chiriladi
// off:false → sana offDays'dan olib tashlanadi, avto-dars vazifasi qayta yaratiladi
// Real (qo'lda berilgan / speaking) vazifalarga tegilmaydi — ular o'z sanasida qoladi.
router.patch('/:id/off-day',
  [
    param('id').isMongoId(),
    body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Sana YYYY-MM-DD formatida bo\'lishi kerak'),
    body('off').isBoolean().withMessage('off qiymati boolean bo\'lishi kerak'),
  ],
  ok, asyncHandler(async (req, res) => {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success:false, message:'Guruh topilmadi' });
    if (!canEditGroup(req, group)) return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });

    // Sana komponentlaridan server-local yarim tun (ensureLessonHomework bilan bir xil konvensiya)
    const [y, mo, dd] = req.body.date.split('-').map(Number);
    const day  = new Date(y, mo - 1, dd, 0, 0, 0, 0);
    const next = new Date(day.getTime() + 86400000);
    const off  = req.body.off === true || req.body.off === 'true';

    const offDays = (group.offDays || []).filter(d => {
      const t = new Date(d); t.setHours(0, 0, 0, 0);
      return t.getTime() !== day.getTime();
    });

    if (off) {
      offDays.push(day);
      // O'sha kunning avtomatik dars vazifasini (+submissions) o'chiramiz
      const hws = await Homework.find({
        group: group._id, autoLesson: true,
        dueDate: { $gte: day, $lt: next },
      }).select('_id').lean();
      const hwIds = hws.map(h => h._id);
      if (hwIds.length) {
        await Submission.deleteMany({ homework: { $in: hwIds } });
        await Homework.deleteMany({ _id: { $in: hwIds } });
      }
    }

    group.offDays = offDays.sort((a, b) => a - b);
    await group.save();

    // Bekor qilinganda — o'sha dars kuni uchun avto-vazifani qayta yaratamiz
    if (!off) await ensureLessonHomeworkForGroup(group._id).catch(() => {});

    res.json({ success:true, message: off ? 'Dam olish kuni belgilandi' : 'Bekor qilindi', data:{ offDays: group.offDays } });
  })
);

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
