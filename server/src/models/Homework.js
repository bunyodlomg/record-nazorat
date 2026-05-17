const mongoose = require('mongoose');

const homeworkSchema = new mongoose.Schema({
  title:       { type:String, required:true, trim:true, maxlength:200 },
  group:       { type:mongoose.Schema.Types.ObjectId, ref:'Group',   required:true, index:true },
  teacher:     { type:mongoose.Schema.Types.ObjectId, ref:'Teacher', required:true, index:true },
  col:         { type:String, enum:['pending','checking','done'], default:'pending', index:true },
  priority:    { type:String, enum:['low','medium','high'], default:'medium' },
  submissions: { type:Number, default:0, min:0 },
  total:       { type:Number, required:true, min:1 },
  progress:    { type:Number, min:0, max:100, default:0 },
  avgScore:    { type:Number, min:0, max:100, default:null },
  dueDate:     { type:Date, required:true },
  description: { type:String, maxlength:1000, default:'' },
  autoLesson:  { type:Boolean, default:false, index:true },
}, { timestamps:true, toJSON:{ virtuals:true } });

homeworkSchema.virtual('dueLabel').get(function() {
  const diff  = this.dueDate - new Date();
  const hours = Math.floor(diff / 36e5);
  if (diff < 0) {
    const d = Math.floor(-diff / 864e5);
    return d === 1 ? 'Yesterday' : `${d}d ago`;
  }
  return hours < 24 ? `${hours}h` : `${Math.floor(hours/24)}d`;
});

homeworkSchema.index({ teacher:1, col:1 });

module.exports = mongoose.model('Homework', homeworkSchema);
