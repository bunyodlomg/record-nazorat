const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  name:           { type:String, required:true, trim:true },
  email:          { type:String, required:true, unique:true, lowercase:true, trim:true },
  phone:          { type:String, trim:true },
  subject:        { type:String, default:'Ingliz tili', trim:true },
  status:         { type:String, enum:['active','inactive','suspended'], default:'active', index:true },
  score:          { type:Number, min:0, max:100, default:0 },
  attendance:     { type:Number, min:0, max:100, default:0 },
  hue:            { type:Number, min:0, max:360, default:200 },
  rank:           { type:Number, default:null },
  joined:         { type:Date, default:Date.now },
  lastReviewedAt: { type:Date, default:null, index:true },
  lastRemindedAt: { type:Date, default:null },
  bio:            { type:String, maxlength:500, default:'' },
  groups:         [{ type:mongoose.Schema.Types.ObjectId, ref:'Group' }],
}, { timestamps:true, toJSON:{ virtuals:true }, toObject:{ virtuals:true } });

teacherSchema.index({ name:'text', subject:'text', email:'text' });
teacherSchema.index({ score:-1 });

module.exports = mongoose.model('Teacher', teacherSchema);
