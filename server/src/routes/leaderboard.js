const express = require('express');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Group   = require('../models/Group');
const User    = require('../models/User');
const { protect, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(protect, requireActive);

// GET /api/leaderboard/teachers
router.get('/teachers', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const teachers = await Teacher.find({ status: 'active' }).sort('-score').limit(limit).lean();

  // Teacher modelida photoUrl yo'q — u User'da. Bog'langan User'lardan rasmni qo'shamiz.
  const ids = teachers.map(t => t._id);
  const users = await User.find({ teacherRef: { $in: ids } })
    .select('teacherRef photoUrl telegramUsername').lean();
  const byTeacher = Object.fromEntries(users.map(u => [String(u.teacherRef), u]));
  const data = teachers.map(t => ({
    ...t,
    photoUrl:         byTeacher[String(t._id)]?.photoUrl         || null,
    telegramUsername: byTeacher[String(t._id)]?.telegramUsername || null,
  }));

  res.json({ success:true, data });
}));

// GET /api/leaderboard/students?groupId=&sortBy=gems|score
// Default: gems (yangi reyting o'lchovi). Eski 'score'ga ham qo'llanishi mumkin.
router.get('/students', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const sortBy = req.query.sortBy === 'score' ? '-score' : '-gems';
  const filter = { status: 'active' };
  if (req.query.groupId) filter.group = req.query.groupId;
  // Teacher faqat o'zining studentlari
  if (req.user.role === 'teacher' && req.user.teacherRef) {
    const groups = await Group.find({ teacher: req.user.teacherRef }).select('_id');
    filter.group = { $in: groups.map(g => g._id) };
  }
  const students = await Student.find(filter).sort(sortBy).limit(limit)
    .populate('group', 'name code')
    .populate('teacher', 'name hue');
  res.json({ success:true, data: students });
}));

// GET /api/leaderboard/groups  — guruhlar bo'yicha o'rtacha
router.get('/groups', asyncHandler(async (req, res) => {
  const matchStage = {};
  if (req.user.role === 'teacher' && req.user.teacherRef) {
    matchStage.teacher = req.user.teacherRef;
  }

  const groups = await Group.find(matchStage).populate('teacher','name hue subject');
  const groupIds = groups.map(g => g._id);

  const stats = await Student.aggregate([
    { $match: { group: { $in: groupIds }, status: 'active' } },
    { $group: {
      _id: '$group',
      avgScore:      { $avg: '$score' },
      avgAttendance: { $avg: '$attendance' },
      totalGems:     { $sum: '$gems' },
      avgGems:       { $avg: '$gems' },
      count:         { $sum: 1 },
    }},
  ]);
  const map = Object.fromEntries(stats.map(s => [String(s._id), s]));
  const data = groups.map(g => ({
    _id: g._id,
    name: g.name,
    code: g.code,
    level: g.level,
    teacher: g.teacher,
    studentCount: map[String(g._id)]?.count || 0,
    avgScore:      Math.round(map[String(g._id)]?.avgScore      || 0),
    avgAttendance: Math.round(map[String(g._id)]?.avgAttendance || 0),
    totalGems:     Math.round(map[String(g._id)]?.totalGems     || 0),
    avgGems:       Math.round(map[String(g._id)]?.avgGems       || 0),
  })).sort((a, b) => b.totalGems - a.totalGems);

  res.json({ success:true, data });
}));

module.exports = router;
