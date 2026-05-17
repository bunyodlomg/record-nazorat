const express  = require('express');
const Homework = require('../models/Homework');
const User     = require('../models/User');
const Student  = require('../models/Student');
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(protect);

const fmtTime = (d) => {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'hozir';
  if (m < 60)  return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} soat oldin`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day} kun oldin`;
  return new Date(d).toLocaleDateString('uz-UZ');
};

const HW_LABEL = {
  pending:  'Yangi vazifa berildi',
  checking: 'Vazifa tekshiruvga olindi',
  done:     'Vazifa tekshirildi',
};
const HW_ICON = { pending:'plus', checking:'sparkles', done:'check' };
const HW_TONE = { pending:'info', checking:'warning', done:'success' };

// GET /api/notifications  → recent activity feed
router.get('/', asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const limit   = Math.min(Number(req.query.limit) || 20, 50);

  const filter = isAdmin ? {} : { teacher: req.user.teacherRef };
  // Auto-yaratilgan pending vazifalarni feed'dan chiqarib tashlaymiz (juda ko'p signal)
  filter.$nor = [{ autoLesson: true, col: 'pending' }];
  const recentHw = await Homework.find(filter)
    .sort('-updatedAt')
    .limit(limit)
    .populate('group',   'name code')
    .populate('teacher', 'name')
    .lean();

  const items = recentHw.map(hw => ({
    id:       `hw-${hw._id}`,
    type:     `homework_${hw.col}`,
    title:    HW_LABEL[hw.col] || 'Vazifa yangilandi',
    subtitle: `${hw.title}${hw.group?.name ? ` · ${hw.group.name}` : ''}${isAdmin && hw.teacher?.name ? ` · ${hw.teacher.name}` : ''}`,
    time:     fmtTime(hw.updatedAt),
    ts:       hw.updatedAt,
    icon:     HW_ICON[hw.col] || 'homework',
    tone:     HW_TONE[hw.col] || 'info',
  }));

  // Admin uchun pending users ham
  if (isAdmin) {
    const pendingUsers = await User.find({ status: 'pending' })
      .sort('-createdAt').limit(10)
      .select('name role createdAt').lean();
    for (const u of pendingUsers) {
      items.push({
        id:       `user-${u._id}`,
        type:     'user_pending',
        title:    'Yangi ro\'yxatdan o\'tdi',
        subtitle: `${u.name} · ${u.role === 'teacher' ? "o'qituvchi" : u.role === 'student' ? "o'quvchi" : 'admin'} (tasdiqlash kerak)`,
        time:     fmtTime(u.createdAt),
        ts:       u.createdAt,
        icon:     'users',
        tone:     'accent',
      });
    }

    // Recent students (oxirgi 7 kun)
    const since = new Date(Date.now() - 7*24*3600*1000);
    const newStudents = await Student.find({ createdAt: { $gte: since } })
      .sort('-createdAt').limit(8)
      .populate('group', 'name')
      .select('name createdAt group').lean();
    for (const s of newStudents) {
      items.push({
        id:       `student-${s._id}`,
        type:     'student_joined',
        title:    "Yangi o'quvchi qo'shildi",
        subtitle: `${s.name}${s.group?.name ? ` · ${s.group.name}` : ''}`,
        time:     fmtTime(s.createdAt),
        ts:       s.createdAt,
        icon:     'users',
        tone:     'success',
      });
    }
  }

  // Sort by ts desc, dedup by id, slice limit
  items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const unique = [];
  const seen = new Set();
  for (const it of items) {
    if (!seen.has(it.id)) { seen.add(it.id); unique.push(it); }
    if (unique.length >= limit) break;
  }

  res.json({ success:true, data: unique });
}));

module.exports = router;
