const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  homework: { type:mongoose.Schema.Types.ObjectId, ref:'Homework', required:true, index:true },
  student:  { type:mongoose.Schema.Types.ObjectId, ref:'Student',  required:true, index:true },
  group:    { type:mongoose.Schema.Types.ObjectId, ref:'Group',    required:true, index:true },
  teacher:  { type:mongoose.Schema.Types.ObjectId, ref:'Teacher',  required:true, index:true },

  // pending   — o'quvchi hali ish bermagan
  // submitted — o'quvchi topshirgan, teacher hali tekshirmagan
  // reviewed  — teacher tekshirgan va tasdiqlagan
  // returned  — teacher qaytarib bergan (qayta ishlash uchun)
  status: { type:String, enum:['pending','submitted','reviewed','returned'], default:'pending', index:true },

  score:    { type:Number, min:0, max:100, default:null },
  feedback: { type:String, maxlength:500,  default:'' },

  submittedAt: { type:Date, default:null },
  reviewedAt:  { type:Date, default:null },

  // Reviewed bo'lganda berilgan 💎 qiymati — qaytarilsa olib qo'yish uchun saqlanadi
  gemsAwarded: { type:Number, default:0, min:0 },
}, { timestamps:true });

// Bir vazifaga bir o'quvchidan faqat bitta submission
submissionSchema.index({ homework:1, student:1 }, { unique:true });
submissionSchema.index({ homework:1, status:1 });

// Vazifa progress, col va avgScore ni Submission'lardan qayta hisoblash
submissionSchema.statics.recomputeHomework = async function(homeworkId) {
  const Homework = mongoose.model('Homework');
  const id = typeof homeworkId === 'string' ? new mongoose.Types.ObjectId(homeworkId) : homeworkId;
  const [counts, scoreAgg] = await Promise.all([
    this.aggregate([
      { $match: { homework: id } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    this.aggregate([
      { $match: { homework: id, status: 'reviewed', score: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$score' } } },
    ]),
  ]);
  const map = Object.fromEntries(counts.map(c => [c._id, c.n]));
  const pending   = map.pending   || 0;
  const submitted = map.submitted || 0;
  const reviewed  = map.reviewed  || 0;
  const returned  = map.returned  || 0;
  const total = pending + submitted + reviewed + returned;

  let col = 'pending';
  if (total > 0 && reviewed === total)    col = 'done';
  else if (reviewed > 0 || submitted > 0) col = 'checking';

  const avgScore = scoreAgg[0]?.avg != null ? Math.round(scoreAgg[0].avg) : null;

  await Homework.findByIdAndUpdate(id, {
    total,
    submissions: reviewed,
    progress:    total > 0 ? Math.round((reviewed / total) * 100) : 0,
    avgScore,
    col,
  });
};

module.exports = mongoose.model('Submission', submissionSchema);
