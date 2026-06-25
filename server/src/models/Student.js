const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name:    { type:String, required:true, trim:true },
  hue:     { type:Number, min:0, max:360, default:200 },
  // 'pending' — eski (link orqali ulangan) o'quvchilar uchun saqlanadi;
  // qo'lda qo'shilgan o'quvchilar to'g'ridan-to'g'ri 'active' bo'ladi.
  status:  { type:String, enum:['pending','active','inactive','suspended'], default:'active', index:true },

  // Guruhga bog'lanish (asosiy guruh)
  group:   { type:mongoose.Schema.Types.ObjectId, ref:'Group', required:true, index:true },
  teacher: { type:mongoose.Schema.Types.ObjectId, ref:'Teacher', default:null, index:true },

  // Ixtiyoriy avatar (Telegram bog'liqligisiz — qo'lda kiritish mumkin)
  photoUrl:          { type:String, default:null },

  // Performance metrics
  score:      { type:Number, min:0, max:100, default:0 },
  attendance: { type:Number, min:0, max:100, default:100 },
  homeworkRate: { type:Number, min:0, max:100, default:0 },

  // 💎 Gem tizimi — har tekshirilgan vazifa uchun ortadi
  gems:         { type:Number, default:0, min:0, index:true }, // jami
  gemsThisWeek: { type:Number, default:0, min:0 },             // joriy hafta
  gemsWeekStart:{ type:Date, default:null },                   // joriy hafta dushanbasi

  phone:  { type:String, trim:true, default:null },
  notes:  { type:String, maxlength:500, default:'' },

  joinedAt: { type:Date, default:Date.now },
}, { timestamps:true });

studentSchema.index({ name:'text' });
studentSchema.index({ score:-1 });
studentSchema.index({ group:1, score:-1 });
studentSchema.index({ group:1, gems:-1 });

module.exports = mongoose.model('Student', studentSchema);
