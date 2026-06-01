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

  // Haftalik speaking vazifalar soni — har dushanba auto-yaratiladi (dueDate=yakshanba)
  speakingPerWeek: { type:Number, default:2, min:0, max:7 },

  // Student'lar uchun umumiy invite token — Telegram bot orqali ulanish uchun
  // Link: https://t.me/<bot>?start=g_<token>
  // Eslatma: unique index quyida partialFilterExpression bilan beriladi
  // (default:null + sparse:true kombinatsiyasi MongoDB'da duplicate-null xatosini keltirib chiqaradi).
  inviteToken: { type:String },
}, { timestamps:true, toJSON:{ virtuals:true }, toObject:{ virtuals:true } });

// Bo'sh / null tokenlar — index'ga tushmasin. Faqat string qiymatlar uchun unique.
groupSchema.index(
  { inviteToken: 1 },
  { unique: true, partialFilterExpression: { inviteToken: { $type: 'string' } } },
);

// Bo'sh string yoki null kelsa — field umuman saqlanmasin (undefined).
groupSchema.pre('save', function(next) {
  if (this.inviteToken === null || this.inviteToken === '') this.inviteToken = undefined;
  next();
});

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
