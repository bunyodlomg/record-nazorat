const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler } = require('./errorHandler');

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ success:false, message:'No token provided' });

  let decoded;
  try {
    decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ success:false, message:msg });
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive)
    return res.status(401).json({ success:false, message:'User no longer exists' });

  req.user = { id:user._id, role:user.role, name:user.name, email:user.email, teacherRef:user.teacherRef, status:user.status };

  // lastSeenAt — har 30 sekundda yangilanadi (DB write'ni cheklash uchun)
  const now = Date.now();
  const last = user.lastSeenAt ? user.lastSeenAt.getTime() : 0;
  if (now - last > 30_000) {
    User.updateOne({ _id:user._id }, { $set:{ lastSeenAt:new Date(now) } }).catch(() => {});
  }
  next();
});

// Faqat status === 'active' bo'lgan foydalanuvchilarga ruxsat
const requireActive = (req, res, next) => {
  if (req.user?.status !== 'active') {
    return res.status(403).json({ success:false, message:'Hisob hali tasdiqlanmagan', status:req.user?.status });
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role))
    return res.status(403).json({ success:false, message:'Insufficient permissions' });
  next();
};

// Teacher faqat o'zining datalarini ko'ra oladi
const selfOrAdmin = asyncHandler(async (req, res, next) => {
  if (req.user.role === 'admin') return next();
  const teacherId = req.params.id || req.params.teacherId;
  if (req.user.teacherRef?.toString() !== teacherId)
    return res.status(403).json({ success:false, message:'Access denied' });
  next();
});

module.exports = { protect, requireRole, selfOrAdmin, requireActive };
