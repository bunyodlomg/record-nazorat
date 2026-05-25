const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name:    { type:String, required:true, trim:true },
  hue:     { type:Number, min:0, max:360, default:200 },
  // 'pending' — bot orqali ulangan, lekin teacher hali tasdiqlamagan
  status:  { type:String, enum:['pending','active','inactive','suspended'], default:'active', index:true },

  // Guruhga bog'lanish (asosiy guruh)
  group:   { type:mongoose.Schema.Types.ObjectId, ref:'Group', required:true, index:true },
  teacher: { type:mongoose.Schema.Types.ObjectId, ref:'Teacher', default:null, index:true },

  // Telegram'dan keladigan ma'lumotlar — bot orqali ulangan student'lar uchun
  telegramId:        { type:String, default:null, index:true, sparse:true },
  telegramUsername:  { type:String, default:null, trim:true },
  telegramFirstName: { type:String, default:null, trim:true },
  telegramLastName:  { type:String, default:null, trim:true },
  photoUrl:          { type:String, default:null },
  joinedViaBot:      { type:Boolean, default:false },

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
