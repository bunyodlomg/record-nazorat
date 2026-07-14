const mongoose = require('mongoose');

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

  // Dam olish / mock kunlari — jadvaldagi dars kuni bo'lsa ham shu sanalarda
  // avtomatik dars vazifasi yaratilmaydi va "topshirmagan" deb hisoblanmaydi.
  // Har sana kunning boshi (00:00, server-local) ko'rinishida saqlanadi.
  offDays:    { type:[Date], default:[] },

  // Haftalik speaking vazifalar soni — har dushanba auto-yaratiladi (dueDate=yakshanba)
  speakingPerWeek: { type:Number, default:2, min:0, max:7 },
}, { timestamps:true, toJSON:{ virtuals:true }, toObject:{ virtuals:true } });

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
