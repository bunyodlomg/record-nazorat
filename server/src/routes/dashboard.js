const express    = require('express');
const Teacher    = require('../models/Teacher');
const Group      = require('../models/Group');
const Student    = require('../models/Student');
const Homework   = require('../models/Homework');
const Submission = require('../models/Submission');
const { protect, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(protect, requireActive);

// GET /api/dashboard  — barcha KPI'lar bir so'rovda
router.get('/', asyncHandler(async (req, res) => {
  const [tStats, gTotal, sTotal, hwAgg, topTeachers, submittedByTeacher] = await Promise.all([
    Teacher.aggregate([{ $group:{
      _id:null,
      total:         { $sum:1 },
      active:        { $sum:{ $cond:[{ $eq:['$status','active']   },1,0] } },
      inactive:      { $sum:{ $cond:[{ $eq:['$status','inactive'] },1,0] } },
      avgScore:      { $avg:'$score' },
      avgAttendance: { $avg:'$attendance' },
    }}]),
    Group.countDocuments({ isActive: true }),
    Student.countDocuments({ status: 'active' }),
    Homework.aggregate([{ $group:{ _id:'$col', count:{ $sum:1 } } }]),
    Teacher.find({ status:'active' }).sort('-score').limit(3).select('name subject score hue'),
    // "Tekshirilmagan" = teacher hali tasdiqlamagan (pending/submitted/returned)
    Submission.aggregate([
      { $match: { status: { $ne: 'reviewed' } } },
      { $group: { _id: '$teacher', count: { $sum: 1 } } },
    ]),
  ]);

  const totalUnchecked = submittedByTeacher.reduce((s, x) => s + x.count, 0);
  const PROBLEM_THRESHOLD = 1; // hatto 1 ta tekshirilmagan ham ko'rinsin
  const problemTeacherIds = submittedByTeacher
    .filter(x => x.count >= PROBLEM_THRESHOLD)
    .map(x => x._id);
  const problemTeachersRaw = problemTeacherIds.length
    ? await Teacher.find({ _id:{ $in:problemTeacherIds } }).select('name subject score hue groups attendance').lean()
    : [];
  const countMap = Object.fromEntries(submittedByTeacher.map(x => [String(x._id), x.count]));

  // Har problem teacher uchun tekshirilmagan o'quvchi nomlari
  let pendingStudentsByTeacher = {};
  if (problemTeacherIds.length) {
    const pendingSubs = await Submission.find({
      teacher: { $in: problemTeacherIds },
      status: { $ne: 'reviewed' },
    }).populate('student', 'name hue').populate('homework', 'title dueDate').lean();
    for (const s of pendingSubs) {
      const k = String(s.teacher);
      (pendingStudentsByTeacher[k] ||= []).push({
        studentId:   s.student?._id,
        studentName: s.student?.name || '—',
        studentHue:  s.student?.hue ?? 200,
        homeworkId:  s.homework?._id,
        homeworkTitle: s.homework?.title || '',
        dueDate:     s.homework?.dueDate || null,
      });
    }
  }

  const problemTeachers = problemTeachersRaw
    .map(t => ({
      ...t,
      pendingReview: countMap[String(t._id)] || 0,
      pendingItems:  pendingStudentsByTeacher[String(t._id)] || [],
    }))
    .sort((a, b) => b.pendingReview - a.pendingReview);

  const ts  = tStats[0]  || {};
  const hwM = Object.fromEntries((hwAgg||[]).map(h=>[h._id, h.count]));

  // Real chart data: oxirgi 7 kun ichida berilgan/tekshirilgan vazifalar
  const days = ['Du','Se','Ch','Pa','Ju','Sh','Ya'];
  const activityData = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(today);
    dayStart.setHours(0,0,0,0);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const [hwCount, doneCount] = await Promise.all([
      Homework.countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd } }),
      Homework.countDocuments({ updatedAt: { $gte: dayStart, $lt: dayEnd }, col: 'done' }),
    ]);
    activityData.push({
      day: days[dayStart.getDay() === 0 ? 6 : dayStart.getDay() - 1],
      lessons: hwCount,
      hw: doneCount,
    });
  }

  // Haftalik vazifa bajarilish trendi — oxirgi 12 hafta (real Homework ma'lumoti)
  // X-axis label: hafta boshlanish sanasi (masalan "5-Yan") — H1...H12 dan ko'ra tushunarli
  const MONTHS_UZ = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
  const attendanceTrend = [];
  for (let i = 11; i >= 0; i--) {
    const wkStart = new Date(today);
    wkStart.setHours(0,0,0,0);
    wkStart.setDate(wkStart.getDate() - i*7 - 6);
    const wkEnd = new Date(wkStart);
    wkEnd.setDate(wkEnd.getDate() + 7);

    const [created, doneInWeek] = await Promise.all([
      Homework.countDocuments({ createdAt: { $gte: wkStart, $lt: wkEnd } }),
      Homework.countDocuments({ updatedAt: { $gte: wkStart, $lt: wkEnd }, col: 'done' }),
    ]);
    const pct = created > 0 ? Math.round((doneInWeek / created) * 100) : 0;
    const label = `${wkStart.getDate()}-${MONTHS_UZ[wkStart.getMonth()]}`;
    attendanceTrend.push({ week: label, val: pct });
  }
  const hasTrendData = attendanceTrend.some(p => p.val > 0);

  res.json({ success:true, data:{
    kpis:{
      totalTeachers:    ts.total        ?? 0,
      activeTeachers:   ts.active       ?? 0,
      inactiveTeachers: ts.inactive     ?? 0,
      totalUnchecked,
      avgScore:         Math.round(ts.avgScore      ?? 0),
      avgAttendance:    Math.round(ts.avgAttendance ?? 0),
      totalGroups:      gTotal ?? 0,
      totalStudents:    sTotal ?? 0,
      hwPending:        hwM.pending  ?? 0,
      hwChecking:       hwM.checking ?? 0,
      hwDone:           hwM.done     ?? 0,
    },
    topTeachers,
    problemTeachers,
    activityData,
    attendanceTrend: hasTrendData ? attendanceTrend : [],
  }});
}));

module.exports = router;
