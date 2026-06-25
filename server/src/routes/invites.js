const express = require('express');
const { body, validationResult } = require('express-validator');
const Invite = require('../models/Invite');
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
  return `https://t.me/${username}?start=invite_${token}`;
};

// Taklif linklar faqat admin/teacher hisoblarini tizimga kiritish uchun (admin yaratadi)
router.use(protect, requireActive, requireRole('admin'));

// GET /api/invites
router.get('/', asyncHandler(async (req, res) => {
  const invites = await Invite.find({}).sort('-createdAt')
    .populate('createdBy', 'name')
    .populate('uses', 'name telegramUsername status photoUrl');
  const data = invites.map(inv => ({
    ...inv.toObject(),
    link: buildLink(inv.token),
  }));
  res.json({ success:true, data });
}));

// POST /api/invites — admin yangi admin yoki o'qituvchi hisobi uchun taklif yaratadi
router.post('/',
  [
    body('role').isIn(['admin','teacher']).withMessage("Rol noto'g'ri"),
    body('label').optional({ nullable:true }).isString().trim().isLength({ max:80 }),
    body('maxUses').optional().isInt({ min:1, max:1000 }),
    body('expiresInHours').optional().isInt({ min:1, max:24*365 }),
  ],
  ok,
  asyncHandler(async (req, res) => {
    const { role, label = null, maxUses = 1, expiresInHours = null } = req.body;

    const invite = await Invite.create({
      token: Invite.generateToken(),
      role,
      label,
      maxUses,
      createdBy: req.user.id,
      expiresAt: expiresInHours ? new Date(Date.now() + expiresInHours*3600*1000) : null,
    });
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
  invite.revokedAt = new Date();
  await invite.save();
  res.json({ success:true, data: { ...invite.toObject(), link: buildLink(invite.token) } });
}));

// DELETE /api/invites/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const invite = await Invite.findById(req.params.id);
  if (!invite) return res.status(404).json({ success:false, message:'Topilmadi' });
  await Invite.findByIdAndDelete(req.params.id);
  res.json({ success:true, message:"O'chirildi" });
}));

module.exports = router;
