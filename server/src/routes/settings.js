const express = require('express');
const { body, validationResult } = require('express-validator');
const Settings = require('../models/Settings');
const { protect, requireRole, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(protect, requireActive);

const ok = (req,res,next) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ success:false, errors:e.array() });
  next();
};

// GET /api/settings — har kim o'qiy oladi (teacher ham ko'rib turishi kerak)
router.get('/', asyncHandler(async (req, res) => {
  const s = await Settings.getGlobal();
  res.json({ success:true, data: s });
}));

// PATCH /api/settings — faqat admin
router.patch('/',
  requireRole('admin'),
  [
    body('lessonGem').optional().isInt({ min:0, max:1000 }),
    body('speakingGem').optional().isInt({ min:0, max:1000 }),
  ],
  ok,
  asyncHandler(async (req, res) => {
    const s = await Settings.getGlobal();
    const fields = ['lessonGem','speakingGem'];
    for (const f of fields) if (f in req.body) s[f] = req.body[f];
    await s.save();
    res.json({ success:true, data: s });
  })
);

module.exports = router;
