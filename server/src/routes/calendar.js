const express    = require('express');
const mongoose   = require('mongoose');
const Group      = require('../models/Group');
const Submission = require('../models/Submission');
const Homework   = require('../models/Homework');
const Teacher    = require('../models/Teacher');
const { getTeacherPhotoMap } = require('../utils/teacherPhotos');
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

    // 1) Kun oralig'ida MUDDATI kelgan vazifalar (per-teacher, dueDate bo'yicha)
    const hwFilter = { dueDate: { $gte: rangeStart, $lte: rangeEnd } };
    if (teacherFilter) hwFilter.teacher = teacherFilter;
    const homeworks = await Homework.find(hwFilter).select('teacher dueDate').lean();
    const hwIds = homeworks.map(h => h._id);

    // 2) SHU vazifalarning submission'lari — status bo'yicha (dueDate o'lchamiga bog'lab).
    //    Muhim: "belgilandi" ni submission.reviewedAt kuni bo'yicha emas, vazifa dueDate'i
    //    bo'yicha sanaymiz — aks holda belgilandi > berildi bo'lib >100% chiqadi.
    const subAgg = hwIds.length ? await Submission.aggregate([
      { $match: { homework: { $in: hwIds } } },
      { $group: { _id: { homework:'$homework', status:'$status' }, count:{ $sum:1 } } },
    ]) : [];
    const hwTotal = {}, hwReviewed = {};
    for (const row of subAgg) {
      const hid = String(row._id.homework);
      hwTotal[hid] = (hwTotal[hid] || 0) + row.count;
      if (row._id.status === 'reviewed') hwReviewed[hid] = (hwReviewed[hid] || 0) + row.count;
    }

    // 3) Teacher info
    const teachers = await Teacher.find({}).select('name hue').lean();
    const photoMap = await getTeacherPhotoMap(teachers.map(t => t._id));
    const teacherMap = Object.fromEntries(
      teachers.map(t => [String(t._id), { ...t, photoUrl: photoMap[String(t._id)] || null }])
    );

    // Aggregate: stats[date][teacherId] = { assigned, reviewed }
    const stats = {};
    const bump = (key, tid, field, val = 1) => {
      stats[key] ||= {};
      stats[key][tid] ||= { assigned:0, reviewed:0 };
      stats[key][tid][field] += val;
    };

    for (const hw of homeworks) {
      const k = fmtKey(new Date(hw.dueDate));
      const tid = String(hw.teacher);
      const hid = String(hw._id);
      bump(k, tid, 'assigned', hwTotal[hid] || 0);
      bump(k, tid, 'reviewed', hwReviewed[hid] || 0);
    }

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
          photoUrl: t.photoUrl || null,
          assigned: v.assigned || 0,
          reviewed: v.reviewed || 0,
          pending:  remaining,
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

  const groupMap = Object.fromEntries(groups.map(g => [String(g._id), g]));

  // Lesson event'lari — har dars kuni
  for (const g of groups) {
    if (!g.scheduleDays?.length) continue;
    const days = g.scheduleDays.map(d => DAY_MAP[d]).filter(d => d !== undefined);
    if (!days.length) continue;

    // Dam olish / mock kunlari — bu sanalarda dars ko'rsatilmaydi
    const offSet = new Set((g.offDays || []).map(d => {
      const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime();
    }));

    // Guruh boshlanish sanasi — bundan oldingi kunlarda dars bo'lmaydi.
    // startDate (boshlanish) yoki createdAt (yaratilgan) — qaysi biri bo'lsa.
    const groupStart = new Date(g.startDate || g.createdAt || rangeStart);
    groupStart.setHours(0, 0, 0, 0);

    // Boshlash nuqtasi: rangeStart va groupStart dan kechrog'i
    const cur = new Date(Math.max(rangeStart.getTime(), groupStart.getTime()));
    cur.setHours(0, 0, 0, 0);
    while (cur <= rangeEnd) {
      const curKey = new Date(cur); curKey.setHours(0, 0, 0, 0);
      if (days.includes(cur.getDay()) && !offSet.has(curKey.getTime())) {
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

  // Speaking vazifalari — dueDate kuni event sifatida (lesson kabi)
  const groupIds = groups.map(g => g._id);
  if (groupIds.length) {
    const speakingHw = await Homework.find({
      group:   { $in: groupIds },
      kind:    'speaking',
      dueDate: { $gte: rangeStart, $lte: rangeEnd },
    }).select('group title dueDate weekSeq').lean();

    for (const hw of speakingHw) {
      const g = groupMap[String(hw.group)];
      if (!g) continue;
      push(fmtKey(new Date(hw.dueDate)), {
        type:     'speaking',
        title:    g.name,
        time:     '',
        tone:     'amber',
        subtitle: `🎤 Speaking #${hw.weekSeq || ''}`.trim(),
      });
    }
  }

  for (const k of Object.keys(byDate)) {
    byDate[k].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  res.json({ success:true, data: byDate, mode:'teacher' });
}));

module.exports = router;
