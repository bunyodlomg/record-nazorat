const express = require('express');
const { body, validationResult } = require('express-validator');
const Invite = require('../models/Invite');
const Group  = require('../models/Group');
const { protect, requireRole, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const ok = (req, res, next) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ success:false, errors:e.array() });
  next();
};

const buildLink = (token) => {
  const username = process.env.BOT_USERNAME;
  if (!username) return null;
  // ?start=  — bot /start invite_xxx ni qabul qiladi va invite cache'ga yoziladi.
  // Foydalanuvchi keyin Mini App tugmasini bosib kiradi.
  // BotFather'da Direct Link Mini App sozlangan bo'lsa ?startapp= ham ishlaydi.
  return `https://t.me/${username}?start=invite_${token}`;
};

router.use(protect, requireActive, requireRole('admin','teacher'));

// GET /api/invites
router.get('/', asyncHandler(async (req, res) => {
  const filter = {};
  // Teacher faqat o'zining yaratganlari va o'zining guruhi uchun student invitelarini ko'radi
  if (req.user.role === 'teacher') {
    filter.createdBy = req.user.id;
  }
  const invites = await Invite.find(filter).sort('-createdAt')
    .populate('createdBy', 'name')
    .populate('uses', 'name telegramUsername status photoUrl')
    .populate('group', 'name code');
  const data = invites.map(inv => ({
    ...inv.toObject(),
    link: buildLink(inv.token),
  }));
  res.json({ success:true, data });
}));

// POST /api/invites
router.post('/',
  [
    body('role').isIn(['admin','teacher','student']),
    body('label').optional({ nullable:true }).isString().trim().isLength({ max:80 }),
    body('groupId').optional({ nullable:true }).isString().trim(),
    body('maxUses').optional().isInt({ min:1, max:1000 }),
    body('expiresInHours').optional().isInt({ min:1, max:24*365 }),
  ],
  ok,
  asyncHandler(async (req, res) => {
    const { role, label = null, groupId = null, maxUses = 1, expiresInHours = null } = req.body;

    // Teacher faqat o'zining guruhiga student invite yarata oladi
    if (req.user.role === 'teacher') {
      if (role !== 'student') {
        return res.status(403).json({ success:false, message:"O'qituvchi faqat o'quvchilar uchun taklif yarata oladi" });
      }
      if (!groupId) {
        return res.status(400).json({ success:false, message:"Guruhni tanlang" });
      }
      const group = await Group.findById(groupId);
      if (!group || String(group.teacher) !== String(req.user.teacherRef)) {
        return res.status(403).json({ success:false, message:"Bu guruh sizniki emas" });
      }
    }

    // Admin uchun: agar student invite bo'lsa, group majburiy
    if (role === 'student' && !groupId) {
      return res.status(400).json({ success:false, message:"Student uchun guruh ko'rsatilishi kerak" });
    }
    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ success:false, message:'Guruh topilmadi' });
    }

    const invite = await Invite.create({
      token: Invite.generateToken(),
      role,
      label,
      group: groupId || null,
      maxUses,
      createdBy: req.user.id,
      expiresAt: expiresInHours ? new Date(Date.now() + expiresInHours*3600*1000) : null,
    });
    await invite.populate('group', 'name code');
    res.status(201).json({
      success:true,
      data: { ...invite.toObject(), link: buildLink(invite.token) },
    });
  })
);

// PATCH /api/invites/:id/revoke
router.patch('/:id/revoke', asyncHandler(async (req, res) => {
  const invite = await Invite.findById(req.params.id);
  if (!invite) return res.status(404).json({ success:false, message:'Topilmadi' });
  if (req.user.role !== 'admin' && String(invite.createdBy) !== String(req.user.id)) {
    return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });
  }
  invite.revokedAt = new Date();
  await invite.save();
  res.json({ success:true, data: { ...invite.toObject(), link: buildLink(invite.token) } });
}));

// DELETE /api/invites/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const invite = await Invite.findById(req.params.id);
  if (!invite) return res.status(404).json({ success:false, message:'Topilmadi' });
  if (req.user.role !== 'admin' && String(invite.createdBy) !== String(req.user.id)) {
    return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });
  }
  await Invite.findByIdAndDelete(req.params.id);
  res.json({ success:true, message:"O'chirildi" });
}));

module.exports = router;
