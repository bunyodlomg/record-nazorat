const express    = require('express');
const mongoose   = require('mongoose');
const Group      = require('../models/Group');
const Submission = require('../models/Submission');
const Homework   = require('../models/Homework');
const Teacher    = require('../models/Teacher');
const { protect, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(protect, requireActive);

const DAY_MAP = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };

const fmtKey = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

/**
 * GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD&teacherId=
 *
 * Admin   → har kun uchun har teacher bo'yicha breakdown:
 *           - kun ichida shu teacher nechta vazifa berdi (homework.createdAt yoki dueDate)
 *           - nechta tekshirildi / qoldi
 * Teacher → o'zining darsi bor kunlari (group.scheduleDays bo'yicha hafta-hafta).
 *           scheduleTime ixtiyoriy — bo'lmasa "Dars" sifatida ko'rsatiladi.
 */
router.get('/events', asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';

  const from = req.query.from ? new Date(req.query.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to   = req.query.to   ? new Date(req.query.to)   : new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59);
  if (isNaN(from) || isNaN(to)) {
    return res.status(400).json({ success:false, message:'Invalid from/to' });
  }
  const rangeStart = new Date(from); rangeStart.setHours(0,0,0,0);
  const rangeEnd   = new Date(to);   rangeEnd.setHours(23,59,59,999);

  const byDate = {};
  const push = (key, ev) => { (byDate[key] ||= []).push(ev); };

  // ── ADMIN REJIM: har teacher uchun har kun submission breakdown ──
  if (isAdmin) {
    // Submission filter — kun oralig'idagi yaratilgan/tekshirilgan/topshirilgan
    let teacherFilter = null;
    if (req.query.teacherId) {
      try { teacherFilter = new mongoose.Types.ObjectId(req.query.teacherId); } catch {}
    }

    // 1) Homework yaratilganlar (kun-by-kun, per-teacher) — "berildi"
    const hwFilter = { dueDate: { $gte: rangeStart, $lte: rangeEnd } };
    if (teacherFilter) hwFilter.teacher = teacherFilter;
    const homeworks = await Homework.find(hwFilter).select('teacher dueDate total submissions').lean();

    // 2) Submission reviewedAt / submittedAt kun bo'yicha
    const subFilter = {
      $or: [
        { reviewedAt:  { $gte: rangeStart, $lte: rangeEnd } },
        { submittedAt: { $gte: rangeStart, $lte: rangeEnd } },
      ],
    };
    if (teacherFilter) subFilter.teacher = teacherFilter;
    const subs = await Submission.find(subFilter).select('teacher status reviewedAt submittedAt').lean();

    // 3) Teacher info
    const teachers = await Teacher.find({}).select('name hue').lean();
    const teacherMap = Object.fromEntries(teachers.map(t => [String(t._id), t]));

    // Aggregate: stats[date][teacherId] = { assigned, reviewed, pending }
    const stats = {};
    const bump = (key, tid, field, val = 1) => {
      stats[key] ||= {};
      stats[key][tid] ||= { assigned:0, reviewed:0, pending:0 };
      stats[key][tid][field] += val;
    };

    for (const hw of homeworks) {
      const k = fmtKey(new Date(hw.dueDate));
      bump(k, String(hw.teacher), 'assigned', hw.total || 0);
    }
    for (const s of subs) {
      const tid = String(s.teacher);
      if (s.reviewedAt && s.reviewedAt >= rangeStart && s.reviewedAt <= rangeEnd) {
        const k = fmtKey(new Date(s.reviewedAt));
        if (s.status === 'reviewed' || s.status === 'returned') bump(k, tid, 'reviewed');
      }
      if (s.submittedAt && s.submittedAt >= rangeStart && s.submittedAt <= rangeEnd && s.status === 'submitted') {
        const k = fmtKey(new Date(s.submittedAt));
        bump(k, tid, 'pending');
      }
    }

    // Plus — agar dueDate o'tib ketgan + tekshirilmagan submission'lar ham "kech qoldi" sifatida hisoblansin
    // Buni "pending" hisobiga qo'shsak adashish kelib chiqadi — alohida 'overdue' qilamiz
    // Hozircha soddalashtirib pending ichida qoldiramiz.

    // byDate'ga teacher-day eventlar qo'shamiz
    for (const [date, perTeacher] of Object.entries(stats)) {
      for (const [tid, v] of Object.entries(perTeacher)) {
        const t = teacherMap[tid];
        if (!t) continue;
        // assigned-reviewed = qolgan tekshirilmaganlar (shu kun vazifalari)
        const remaining = Math.max((v.assigned || 0) - (v.reviewed || 0), 0);
        push(date, {
          type: 'teacher-day',
          teacherId: tid,
          teacherName: t.name,
          hue: t.hue,
          assigned: v.assigned || 0,
          reviewed: v.reviewed || 0,
          pending:  v.pending  || 0,
          remaining,
          tone: remaining > 0 ? 'amber' : 'green',
        });
      }
    }

    return res.json({ success:true, data: byDate, mode:'admin' });
  }

  // ── TEACHER REJIM: o'zining dars kunlari ──
  if (!req.user.teacherRef) {
    return res.json({ success:true, data:{}, mode:'teacher' });
  }
  const groups = await Group.find({ teacher: req.user.teacherRef, isActive:true })
    .populate('teacher', 'name').lean();

  for (const g of groups) {
    if (!g.scheduleDays?.length) continue; // scheduleTime endi majburiy emas
    const days = g.scheduleDays.map(d => DAY_MAP[d]).filter(d => d !== undefined);
    if (!days.length) continue;

    const cur = new Date(rangeStart);
    while (cur <= rangeEnd) {
      if (days.includes(cur.getDay())) {
        push(fmtKey(cur), {
          type:     'lesson',
          title:    g.name,
          time:     g.scheduleTime || '',
          tone:     'green',
          subtitle: g.code || '',
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  for (const k of Object.keys(byDate)) {
    byDate[k].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  res.json({ success:true, data: byDate, mode:'teacher' });
}));

module.exports = router;
