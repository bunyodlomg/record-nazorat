const express  = require('express');
const { body, param, validationResult } = require('express-validator');
const Submission = require('../models/Submission');
const Teacher    = require('../models/Teacher');
const Group      = require('../models/Group');
const Student    = require('../models/Student');
const Homework   = require('../models/Homework');
const { protect, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(protect, requireActive);

const ok = (req,res,next) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ success:false, errors:e.array() });
  next();
};

// ── TZ yordamchilari — kun chegaralari Asia/Tashkent (UTC+5) bo'yicha ──
const TZ_MIN = 5 * 60; // UTC+5
// Berilgan instant qaysi Tashkent kuniga tegishli — 'YYYY-MM-DD'
const dayKey = (date) => new Date(new Date(date).getTime() + TZ_MIN * 60000).toISOString().slice(0, 10);

// GRID  GET /api/submissions/grid?range=week|month&groupId=
// Har o'quvchi uchun kunma-kun: topshirgan (green) / topshirmagan (red) holati.
router.get('/grid', asyncHandler(async (req, res) => {
  const range = req.query.range === 'month' ? 30 : 7;

  // ── Guruh doirasi (teacher faqat o'zini, admin hammasini yoki tanlangan guruhni) ──
  let groupIds;
  if (req.user.role === 'teacher') {
    if (!req.user.teacherRef) return res.json({ success:true, data:{ range, days:[], students:[] } });
    const groups = await Group.find({ teacher: req.user.teacherRef }).select('_id').lean();
    groupIds = groups.map(g => g._id);
  } else if (req.user.role === 'admin') {
    const groups = await Group.find(req.query.groupId ? { _id: req.query.groupId } : {}).select('_id').lean();
    groupIds = groups.map(g => g._id);
  } else {
    return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });
  }
  if (req.query.groupId) groupIds = groupIds.filter(id => String(id) === String(req.query.groupId));

  // ── Kun ro'yxati (Tashkent yarim tunlari) ──
  const now = new Date();
  const tashNow = new Date(now.getTime() + TZ_MIN * 60000);
  // Bugungi Tashkent yarim tunining UTC instanti
  const todayMidnightUTC = new Date(
    Date.UTC(tashNow.getUTCFullYear(), tashNow.getUTCMonth(), tashNow.getUTCDate()) - TZ_MIN * 60000
  );
  const startUTC = new Date(todayMidnightUTC.getTime() - (range - 1) * 864e5);
  const endUTC   = new Date(todayMidnightUTC.getTime() + 864e5); // bugun tugashi (exclusive)

  const WD = ['Yak', 'Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha']; // Sun..Sat
  const days = [];
  for (let i = 0; i < range; i++) {
    const instant = new Date(startUTC.getTime() + i * 864e5);
    const shifted = new Date(instant.getTime() + TZ_MIN * 60000); // Tashkent ko'rinishi
    days.push({
      key:    dayKey(instant),
      dom:    shifted.getUTCDate(),
      month:  shifted.getUTCMonth() + 1,
      dow:    WD[shifted.getUTCDay()],
      weekend: shifted.getUTCDay() === 0 || shifted.getUTCDay() === 6,
      isToday: i === range - 1,
    });
  }
  const dayKeys = days.map(d => d.key);

  if (groupIds.length === 0) return res.json({ success:true, data:{ range, days, students:[] } });

  // ── Ma'lumotlar: o'quvchilar, vazifalar (oraliqda), submissionlar ──
  const [students, homeworks] = await Promise.all([
    Student.find({ group: { $in: groupIds }, status: 'active' })
      .select('name hue photoUrl group').populate('group', 'name code').sort('name').lean(),
    Homework.find({ group: { $in: groupIds }, dueDate: { $gte: startUTC, $lt: endUTC } })
      .select('group dueDate').lean(),
  ]);

  // group+day → vazifalar soni
  const hwByGroupDay = {}; // 'groupId|dayKey' → count
  const hwIds = [];
  for (const h of homeworks) {
    hwIds.push(h._id);
    const k = `${h.group}|${dayKey(h.dueDate)}`;
    hwByGroupDay[k] = (hwByGroupDay[k] || 0) + 1;
  }

  const submissions = hwIds.length
    ? await Submission.find({ homework: { $in: hwIds }, student: { $in: students.map(s => s._id) } })
        .select('homework student status').lean()
    : [];

  // Vazifa → uning guruh|kun kaliti (submissionni to'g'ri kunga bog'lash uchun)
  const hwMeta = Object.fromEntries(homeworks.map(h => [String(h._id), { group: String(h.group), key: dayKey(h.dueDate) }]));
  // student|day → { total, done }   (done = submitted yoki reviewed)
  const cellAgg = {};
  for (const sub of submissions) {
    const meta = hwMeta[String(sub.homework)];
    if (!meta) continue;
    const ck = `${sub.student}|${meta.key}`;
    (cellAgg[ck] ||= { done: 0 });
    if (sub.status === 'submitted' || sub.status === 'reviewed') cellAgg[ck].done += 1;
  }

  const todayKey = dayKeys[dayKeys.length - 1];

  const studentRows = students.map(s => {
    let done = 0, missed = 0, partial = 0;
    const cells = days.map(d => {
      const total = hwByGroupDay[`${s.group?._id || s.group}|${d.key}`] || 0;
      if (total === 0) return { status: 'none' };
      const ok = cellAgg[`${s._id}|${d.key}`]?.done || 0;
      let status;
      if (ok >= total)      { status = 'done';    done++; }
      else if (ok > 0)      { status = 'partial'; partial++; }
      else if (d.key > todayKey) status = 'upcoming';
      else                  { status = 'missed';  missed++; }
      return { status, done: ok, total };
    });
    const graded = done + partial + missed;
    return {
      _id: s._id, name: s.name, hue: s.hue, photoUrl: s.photoUrl || null,
      group: s.group,
      cells,
      stats: { done, partial, missed, rate: graded ? Math.round((done / graded) * 100) : null },
    };
  });

  res.json({ success:true, data:{ range, days, students: studentRows } });
}));

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

    // Gem berish/qaytarib olish + bot xabari
    let gemInfo = null;
    let hwForGem = null;
    if (status !== undefined) {
      try {
        const Homework = require('../models/Homework');
        const { applyGemForSubmission } = require('../utils/gemAward');
        hwForGem = await Homework.findById(sub.homework).populate('group','name').select('title group kind').lean();
        gemInfo = await applyGemForSubmission(sub, hwForGem);
      } catch (e) { /* sukut */ }
    }

    if (status === 'reviewed' || status === 'returned') {
      Teacher.updateOne({ _id: sub.teacher }, { $set: { lastReviewedAt: new Date() } }).catch(() => {});

      // Student'ga bot orqali xabar (gem ma'lumotlari bilan)
      try {
        const Student  = require('../models/Student');
        const { notifyHomeworkReviewed } = require('../bot/notifications');
        const st = gemInfo?.studentTgId
          ? { telegramId: gemInfo.studentTgId, name: gemInfo.studentName, status: 'active' }
          : await Student.findById(sub.student).select('telegramId name status').lean();
        if (st?.telegramId && st.status === 'active') {
          notifyHomeworkReviewed({
            studentTgId: st.telegramId,
            studentName: st.name,
            homeworkTitle: hwForGem?.title,
            groupName: hwForGem?.group?.name,
            status: sub.status,
            score: sub.score,
            feedback: sub.feedback,
            gemDelta:  gemInfo?.delta || 0,
            totalGems: gemInfo?.totalGems || 0,
          }).catch(() => {});
        }
      } catch {}
    }

    const updated = await Submission.findById(sub._id)
      .populate('student','name hue photoUrl telegramUsername').lean();
    res.json({ success:true, data: updated, gem: gemInfo });
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

    // Gem awarding — har submission alohida hisoblanadi
    const gemResults = [];
    try {
      const Homework = require('../models/Homework');
      const { applyGemForSubmission } = require('../utils/gemAward');
      const subDocs = await Submission.find(filter);
      const hwIdsList = [...new Set(subDocs.map(s => String(s.homework)))];
      const hwList = await Homework.find({ _id:{ $in:hwIdsList } }).populate('group','name').select('title group kind').lean();
      const hwMap = Object.fromEntries(hwList.map(h => [String(h._id), h]));
      for (const sd of subDocs) {
        const hw = hwMap[String(sd.homework)];
        const info = await applyGemForSubmission(sd, hw);
        gemResults.push({ subId: String(sd._id), studentId: String(sd.student), hw, info });
      }
    } catch {}

    if (status === 'reviewed' || status === 'returned') {
      const teacherIds = [...new Set(subs.map(s => String(s.teacher)))];
      Teacher.updateMany({ _id:{ $in:teacherIds } }, { $set:{ lastReviewedAt:new Date() } }).catch(() => {});

      // Bot xabarlari — gem ma'lumotlari bilan
      try {
        const { notifyHomeworkReviewed } = require('../bot/notifications');
        for (const r of gemResults) {
          if (r.info?.studentTgId) {
            notifyHomeworkReviewed({
              studentTgId: r.info.studentTgId,
              studentName: r.info.studentName,
              homeworkTitle: r.hw?.title,
              groupName: r.hw?.group?.name,
              status,
              gemDelta:  r.info.delta || 0,
              totalGems: r.info.totalGems || 0,
            }).catch(() => {});
          }
        }
      } catch {}
    }

    res.json({ success:true, updated: subs.length });
  })
);

module.exports = router;
