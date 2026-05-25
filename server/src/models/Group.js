const mongoose = require('mongoose');
const crypto   = require('crypto');

const DAYS = ['mon','tue','wed','thu','fri','sat','sun'];

const groupSchema = new mongoose.Schema({
  name:       { type:String, required:true, trim:true },
  code:       { type:String, required:true, unique:true, trim:true },
  teacher:    { type:mongoose.Schema.Types.ObjectId, ref:'Teacher', required:true, index:true },
  level:      { type:String, enum:['A1','A2','B1','B2','C1','C2','Beginner','Intermediate','Advanced','Olympiad'], default:'A1' },
  scheduleDays: { type:[String], enum:DAYS, default:[] },
  scheduleTime: { type:String, default:null },
  startDate:  { type:Date, default:Date.now },
  isActive:   { type:Boolean, default:true, index:true },

  // Student'lar uchun umumiy invite token — Telegram bot orqali ulanish uchun
  // Link: https://t.me/<bot>?start=g_<token>
  inviteToken: { type:String, default:null, index:true, sparse:true, unique:true },
}, { timestamps:true, toJSON:{ virtuals:true }, toObject:{ virtuals:true } });

groupSchema.statics.generateInviteToken = function() {
  return crypto.randomBytes(10).toString('base64url'); // ~13 belgi
};

// Studentlar populated emas (alohida collection) — ammo virtual count
groupSchema.virtual('students', {
  ref: 'Student',
  localField: '_id',
  foreignField: 'group',
  count: true,
  match: { status: 'active' },
});

// Tarkibiy ma'lumotlar uchun (admin panelda kerak bo'lganda)
groupSchema.virtual('studentList', {
  ref: 'Student',
  localField: '_id',
  foreignField: 'group',
  match: { status: 'active' },
});

groupSchema.index({ name:'text', code:'text' });

module.exports = mongoose.model('Group', groupSchema);
