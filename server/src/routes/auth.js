const express = require('express');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User    = require('../models/User');
const Invite  = require('../models/Invite');
const { asyncHandler } = require('../middleware/errorHandler');
const { protect } = require('../middleware/auth');
const { verifyInitData } = require('../utils/verifyTelegram');
const { notifyPending } = require('../bot/notifications');
const inviteCache = require('../bot/inviteCache');

const router = express.Router();

const signToken = (user) => jwt.sign(
  { id: user._id, role: user.role, name: user.name, email: user.email, teacherRef: user.teacherRef, status: user.status },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

const ok = (req, res, next) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ success:false, errors:e.array() });
  next();
};

// POST /api/auth/login (browser/email)
router.post('/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  ok,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password').populate('teacherRef', 'name subject hue score attendance');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success:false, message:'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success:false, message:'Account is deactivated' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ success:false, message:'Account is not approved', status:user.status });
    }
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave:false });
    const token = signToken(user);
    res.json({ success:true, token, data: user });
  })
);

// POST /api/auth/telegram — Mini App initData orqali login/register
router.post('/telegram', asyncHandler(async (req, res) => {
  const { initData, startParam } = req.body || {};
  const ttl = parseInt(process.env.TELEGRAM_INITDATA_TTL || '86400', 10);

  const v = verifyInitData(initData, process.env.BOT_TOKEN, ttl);
  if (!v.ok) return res.status(401).json({ success:false, message:`Telegram auth failed: ${v.error}` });

  const tgId = String(v.user.id);
  // Telegram'dan kelgan start_param yoki bot orqali kelgan invite cache'idan
  const cachedToken = inviteCache.get(tgId);
  const param = startParam || v.startParam || cachedToken;

  console.log(`[telegram-auth] tgId=${tgId} startParam=${JSON.stringify(startParam)} verifiedParam=${JSON.stringify(v.startParam)} cached=${JSON.stringify(cachedToken)} resolved=${JSON.stringify(param)}`);

  let user = await User.findOne({ telegramId: tgId }).populate('teacherRef', 'name subject hue score attendance');

  // Mavjud user bo'lsa — Telegram profilini sinxronlashtirish
  if (user) {
    const fullName = [v.user.first_name, v.user.last_name].filter(Boolean).join(' ').trim()
                  || v.user.username || user.name;
    let dirty = false;
    // Default 'Administrator' yoki bo'sh nomni Telegram nomiga almashtirish
    if (!user.firstName || (user.name === 'Administrator' && fullName !== 'Administrator')) {
      user.name = fullName; dirty = true;
    } else if (fullName && fullName !== user.name && (v.user.first_name || v.user.last_name)) {
      user.name = fullName; dirty = true;
    }
    if (v.user.first_name && user.firstName        !== v.user.first_name) { user.firstName        = v.user.first_name; dirty = true; }
    if (v.user.last_name  && user.lastName         !== v.user.last_name)  { user.lastName         = v.user.last_name;  dirty = true; }
    if (v.user.username   && user.telegramUsername !== v.user.username)   { user.telegramUsername = v.user.username;   dirty = true; }
    if (v.user.photo_url  && user.photoUrl         !== v.user.photo_url)  { user.photoUrl         = v.user.photo_url;  dirty = true; }
    if (dirty) await user.save({ validateBeforeSave:false });
  }

  // Birinchi marta — yangi user. Faqat invite link orqali (admin/teacher rollari uchun)
  // yoki TELEGRAM_ADMIN_ID hard-coded admin sifatida kira oladi.
  if (!user) {
    let invite = null;
    if (param && param.startsWith('invite_')) {
      const token = param.slice('invite_'.length);
      invite = await Invite.findOne({ token });
      if (!invite || !invite.isValid) {
        return res.status(403).json({ success:false, message:'Taklif link yaroqsiz yoki muddati tugagan' });
      }
    } else {
      const isHardcodedAdmin = process.env.TELEGRAM_ADMIN_ID && tgId === String(process.env.TELEGRAM_ADMIN_ID);
      if (!isHardcodedAdmin) {
        return res.status(403).json({ success:false, message:"Sizga ruxsat berilmagan. Administratordan taklif link oling." });
      }
    }

    const baseName = [v.user.first_name, v.user.last_name].filter(Boolean).join(' ').trim() || v.user.username || `User ${tgId}`;
    const isHardAdmin = process.env.TELEGRAM_ADMIN_ID && tgId === String(process.env.TELEGRAM_ADMIN_ID);
    const role = invite ? invite.role : 'admin';
    const status = invite ? 'pending' : (isHardAdmin ? 'active' : 'pending');

    user = await User.create({
      name: baseName,
      role,
      status,
      telegramId: tgId,
      telegramUsername: v.user.username || null,
      firstName: v.user.first_name || null,
      lastName:  v.user.last_name  || null,
      photoUrl:  v.user.photo_url  || null,
      inviteRef: invite?._id || null,
    });

    if (invite) {
      invite.uses.push(user._id);
      await invite.save();
      inviteCache.consume(tgId);
    }

    if (user.status === 'pending') {
      notifyPending(user).catch(() => {});
    }
  }

  if (!user.isActive) {
    return res.status(403).json({ success:false, message:'Account is deactivated' });
  }
  if (user.status === 'rejected') {
    return res.status(403).json({ success:false, message:'Sizning so\'rovingiz rad etilgan', status:'rejected' });
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave:false });

  const token = signToken(user);
  if (user.status === 'pending') {
    return res.status(202).json({ success:true, token, data:user, status:'pending' });
  }
  res.json({ success:true, token, data:user, status:'active' });
}));

// GET /api/auth/me
router.get('/me', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).populate('teacherRef', 'name subject hue score attendance groups');
  if (!user) return res.status(404).json({ success:false, message:'User not found' });
  res.json({ success:true, data: user });
}));

// PATCH /api/auth/me
router.patch('/me', protect, asyncHandler(async (req, res) => {
  const { name, avatar } = req.body;
  const user = await User.findByIdAndUpdate(req.user.id, { name, avatar }, { new:true, runValidators:true });
  res.json({ success:true, data: user });
}));

// POST /api/auth/change-password
router.post('/change-password', protect,
  [body('oldPassword').notEmpty(), body('newPassword').isLength({ min:6 })],
  ok,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('+password');
    if (!(await user.comparePassword(req.body.oldPassword))) {
      return res.status(401).json({ success:false, message:'Old password incorrect' });
    }
    user.password = req.body.newPassword;
    await user.save();
    res.json({ success:true, message:'Password changed' });
  })
);

module.exports = router;
