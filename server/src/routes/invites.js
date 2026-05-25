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
  // ?start=invite_xxx — bot /start invite_xxx orqali qabul qiladi.
  // admin/teacher → invite cache → Mini App login flow.
  // student → bot ichida ism so'rab, pending Student yaratiladi.
  return `https://t.me/${username}?start=invite_${token}`;
};

// Admin va teacher har xil ruxsatlar bilan kira oladi (rol tekshiruvi har endpoint'da)
router.use(protect, requireActive, requireRole('admin', 'teacher'));

// GET /api/invites — teacher faqat o'zinikini ko'radi
router.get('/', asyncHandler(async (req, res) => {
  const filter = req.user.role === 'teacher' ? { createdBy: req.user.id } : {};
  const invites = await Invite.find(filter).sort('-createdAt')
    .populate('createdBy', 'name')
    .populate('uses', 'name telegramUsername status photoUrl')
    .populate('studentUses', 'name telegramUsername status photoUrl hue')
    .populate('group', 'name code');
  const data = invites.map(inv => ({
    ...inv.toObject(),
    link: buildLink(inv.token),
  }));
  res.json({ success:true, data });
}));

// POST /api/invites
//  - admin: admin yoki teacher yoki student rolli invite yarata oladi
//  - teacher: faqat student rolli (o'z guruhi uchun)
router.post('/',
  [
    body('role').isIn(['admin','teacher','student']).withMessage("Rol noto'g'ri"),
    body('label').optional({ nullable:true }).isString().trim().isLength({ max:80 }),
    body('group').optional({ nullable:true }).isMongoId(),
    body('maxUses').optional().isInt({ min:1, max:1000 }),
    body('expiresInHours').optional().isInt({ min:1, max:24*365 }),
  ],
  ok,
  asyncHandler(async (req, res) => {
    const { role, label = null, group: groupId = null, maxUses = 1, expiresInHours = null } = req.body;

    // Teacher rol ruxsati: faqat student
    if (req.user.role === 'teacher' && role !== 'student') {
      return res.status(403).json({ success:false, message:"O'qituvchi faqat o'quvchi uchun taklif yarata oladi" });
    }

    // Student rolli invite uchun group majburiy
    let group = null;
    if (role === 'student') {
      if (!groupId) return res.status(422).json({ success:false, message:"O'quvchi uchun guruh tanlash kerak" });
      group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ success:false, message:"Guruh topilmadi" });
      // Teacher faqat o'z guruhi uchun
      if (req.user.role === 'teacher' && (!req.user.teacherRef || String(group.teacher) !== String(req.user.teacherRef))) {
        return res.status(403).json({ success:false, message:"Bu guruh sizga tegishli emas" });
      }
    }

    const invite = await Invite.create({
      token: Invite.generateToken(),
      role,
      label,
      group: group?._id || null,
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

const canManageInvite = (req, invite) => {
  if (req.user.role === 'admin') return true;
  return String(invite.createdBy) === String(req.user.id);
};

// PATCH /api/invites/:id/revoke
router.patch('/:id/revoke', asyncHandler(async (req, res) => {
  const invite = await Invite.findById(req.params.id);
  if (!invite) return res.status(404).json({ success:false, message:'Topilmadi' });
  if (!canManageInvite(req, invite)) return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });
  invite.revokedAt = new Date();
  await invite.save();
  res.json({ success:true, data: { ...invite.toObject(), link: buildLink(invite.token) } });
}));

// DELETE /api/invites/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const invite = await Invite.findById(req.params.id);
  if (!invite) return res.status(404).json({ success:false, message:'Topilmadi' });
  if (!canManageInvite(req, invite)) return res.status(403).json({ success:false, message:'Ruxsat yo\'q' });
  await Invite.findByIdAndDelete(req.params.id);
  res.json({ success:true, message:"O'chirildi" });
}));

module.exports = router;
