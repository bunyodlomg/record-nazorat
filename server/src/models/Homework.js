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

  // Vazifa turi: 'lesson' — dars vazifasi (kunlik), 'speaking' — haftalik speaking kvota
  kind:        { type:String, enum:['lesson','speaking'], default:'lesson', index:true },
  // Speaking uchun haftaning boshi (dushanba) — bir guruh+hafta+ketma-ket raqam uniq
  weekStart:   { type:Date, default:null, index:true },
  weekSeq:     { type:Number, default:null, min:1, max:10 },
}, { timestamps:true, toJSON:{ virtuals:true } });

// Speaking unique: (group, weekStart, weekSeq) bir guruh hafta-da ikki marta yaratilmasin
homeworkSchema.index(
  { group:1, weekStart:1, weekSeq:1 },
  { unique:true, partialFilterExpression: { kind:'speaking' } },
);

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
