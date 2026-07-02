const express = require('express');
const { body, validationResult } = require('express-validator');
const User    = require('../models/User');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Group   = require('../models/Group');
const Invite  = require('../models/Invite');
const { protect, requireRole, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { notifyApproved, notifyRejected } = require('../bot/notifications');

const router = express.Router();

const ok = (req, res, next) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ success:false, errors:e.array() });
  next();
};

// Admin va o'qituvchilar pending users'larni boshqarishi mumkin
router.use(protect, requireActive, requireRole('admin','teacher'));

// O'qituvchi faqat o'zining guruhiga student invite'ini boshqarishi mumkin
const canManageUser = async (req, user) => {
  if (req.user.role === 'admin') return true;
  if (user.role !== 'student') return false;
  if (!req.user.teacherRef) return false;
  // Pending student bo'lsa pendingGroupRef'ga qaraymiz
  let groupId = user.pendingGroupRef;
  if (!groupId && user.studentRef) {
    const Student = require('../models/Student');
    const s = await Student.findById(user.studentRef).select('group');
    groupId = s?.group;
  }
  if (!groupId) return false;
  const group = await Group.findById(groupId).select('teacher');
  return group && String(group.teacher) === String(req.user.teacherRef);
};

// GET /api/users?status=pending
router.get('/', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.role)   filter.role   = req.query.role;

  // O'qituvchi faqat o'zining guruhi pending studentlarini ko'radi
  if (req.user.role === 'teacher') {
    if (!req.user.teacherRef) return res.json({ success:true, data:[] });
    const myGroups = await Group.find({ teacher: req.user.teacherRef }).select('_id');
    const groupIds = myGroups.map(g => g._id);
    filter.role = 'student';
    filter.pendingGroupRef = { $in: groupIds };
  }

  const users = await User.find(filter).sort('-createdAt')
    .populate('teacherRef', 'name subject hue')
    .populate('studentRef', 'name group hue')
    .populate('pendingGroupRef', 'name code');
  res.json({ success:true, data:users });
}));

// PATCH /api/users/:id/approve
router.patch('/:id/approve',
  [
    body('subject').optional({ nullable:true }).isString().trim(),
    body('groupId').optional({ nullable:true }).isString().trim(),
  ],
  ok,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success:false, message:'Foydalanuvchi topilmadi' });
    if (!(await canManageUser(req, user))) {
      return res.status(403).json({ success:false, message:'Bu foydalanuvchini siz tasdiqlay olmaysiz' });
    }
    if (user.status === 'active') return res.json({ success:true, data:user, message:'Allaqachon faol' });

    if (user.role === 'teacher' && !user.teacherRef) {
      const teacher = await Teacher.create({
        name:       user.name,
        email:      user.email || `tg-${user.telegramId}@local`,
        subject:    req.body.subject || 'General',
        status:     'active',
        hue:        160 + Math.floor(Math.random() * 80),
      });
      user.teacherRef = teacher._id;
    }

    if (user.role === 'student' && !user.studentRef) {
      const groupId = req.body.groupId || user.pendingGroupRef;
      if (!groupId) {
        return res.status(400).json({ success:false, message:"Guruh ko'rsatilmagan" });
      }
      const group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ success:false, message:'Guruh topilmadi' });

      const student = await Student.create({
        name: user.name,
        group: group._id,
        teacher: group.teacher,
        telegramId: user.telegramId,
        telegramUsername: user.telegramUsername,
        photoUrl: user.photoUrl,
        hue: 200 + Math.floor(Math.random() * 160),
        status: 'active',
      });
      user.studentRef = student._id;
      user.pendingGroupRef = null;
    }

    user.status = 'active';
    await user.save({ validateBeforeSave:false });
    await user.populate(['teacherRef', 'studentRef', 'pendingGroupRef']);

    notifyApproved(user).catch(() => {});

    res.json({ success:true, data:user });
  })
);

// PATCH /api/users/:id/reject
router.patch('/:id/reject', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success:false, message:'Foydalanuvchi topilmadi' });
  if (!(await canManageUser(req, user))) {
    return res.status(403).json({ success:false, message:'Bu foydalanuvchini siz rad eta olmaysiz' });
  }
  user.status = 'rejected';
  await user.save({ validateBeforeSave:false });

  notifyRejected(user).catch(() => {});

  res.json({ success:true, data:user });
}));

// DELETE /api/users/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success:false, message:"Faqat admin o'chira oladi" });
  }
  if (String(req.user.id) === req.params.id) {
    return res.status(400).json({ success:false, message:"O'zingizni o'chirib bo'lmaydi" });
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ success:false, message:'Foydalanuvchi topilmadi' });
  res.json({ success:true, message:"O'chirildi" });
}));

module.exports = router;
