const express    = require('express');
const Group      = require('../models/Group');
const Submission = require('../models/Submission');
const { protect, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(protect, requireActive);

const DAY_MAP = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };

const fmtKey = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

/**
 * GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Admin   → har kun uchun submission statistikasi (reviewedCount, submittedCount, returnedCount).
 *           Maqsad: shu kunda nechta tekshirilgan, nechta tekshirilmagan ko'rinsin.
 * Teacher → o'zining darsi bor kunlari (group.scheduleDays bo'yicha hafta-hafta).
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

  if (isAdmin) {
    // Admin rejimi: har kun uchun submission statistikasi (ixtiyoriy teacherId filter)
    const baseFilter = {
      $or: [
        { reviewedAt:  { $gte: rangeStart, $lte: rangeEnd } },
        { submittedAt: { $gte: rangeStart, $lte: rangeEnd } },
      ],
    };
    if (req.query.teacherId) {
      const mongoose = require('mongoose');
      try {
        baseFilter.teacher = new mongoose.Types.ObjectId(req.query.teacherId);
      } catch { /* invalid id — filter ignored */ }
    }
    const subs = await Submission.find(baseFilter).select('status reviewedAt submittedAt').lean();

    const stats = {}; // { 'YYYY-MM-DD': { reviewed, submitted, returned } }
    const bump = (key, field) => {
      (stats[key] ||= { reviewed:0, submitted:0, returned:0 })[field]++;
    };
    for (const s of subs) {
      // Tekshirilgan
      if (s.reviewedAt && s.reviewedAt >= rangeStart && s.reviewedAt <= rangeEnd) {
        const k = fmtKey(new Date(s.reviewedAt));
        if (s.status === 'reviewed') bump(k, 'reviewed');
        else if (s.status === 'returned') bump(k, 'returned');
      }
      // Topshirilgan (lekin tekshirilmagan)
      if (s.submittedAt && s.submittedAt >= rangeStart && s.submittedAt <= rangeEnd && s.status === 'submitted') {
        const k = fmtKey(new Date(s.submittedAt));
        bump(k, 'submitted');
      }
    }

    for (const [key, v] of Object.entries(stats)) {
      // "Qaytarilgan" ham teacher tomonidan ko'rib chiqilgan deb hisoblanadi
      const reviewed  = (v.reviewed || 0) + (v.returned || 0);
      const submitted = v.submitted || 0;
      if (reviewed)  push(key, { type:'stats-reviewed', count:reviewed,  tone:'green', title:`${reviewed} tekshirildi`,  time:'' });
      if (submitted) push(key, { type:'stats-pending',  count:submitted, tone:'amber', title:`${submitted} kutilmoqda`,  time:'' });
    }

    return res.json({ success:true, data: byDate, mode:'admin' });
  }

  // Teacher rejimi: faqat darsi bor kunlari (group lessons)
  if (!req.user.teacherRef) {
    return res.json({ success:true, data:{}, mode:'teacher' });
  }
  const groups = await Group.find({ teacher: req.user.teacherRef, isActive:true })
    .populate('teacher', 'name').lean();

  for (const g of groups) {
    if (!g.scheduleDays?.length || !g.scheduleTime) continue;
    const days = g.scheduleDays.map(d => DAY_MAP[d]).filter(d => d !== undefined);
    if (!days.length) continue;

    const cur = new Date(rangeStart);
    while (cur <= rangeEnd) {
      if (days.includes(cur.getDay())) {
        push(fmtKey(cur), {
          type:     'lesson',
          title:    g.name,
          time:     g.scheduleTime,
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
