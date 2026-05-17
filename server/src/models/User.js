const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:     { type:String, required:true, trim:true },
  email:    { type:String, lowercase:true, trim:true, sparse:true, unique:true },
  password: { type:String, select:false },
  role:     { type:String, enum:['admin','teacher','student'], default:'teacher', index:true },
  status:   { type:String, enum:['pending','active','rejected'], default:'pending', index:true },
  teacherRef: { type:mongoose.Schema.Types.ObjectId, ref:'Teacher', default:null },
  studentRef: { type:mongoose.Schema.Types.ObjectId, ref:'Student', default:null },
  pendingGroupRef: { type:mongoose.Schema.Types.ObjectId, ref:'Group', default:null },

  // Telegram auth
  telegramId:       { type:String, default:null, index:true, sparse:true, unique:true },
  telegramUsername: { type:String, default:null, trim:true },
  firstName:        { type:String, default:null, trim:true },
  lastName:         { type:String, default:null, trim:true },
  photoUrl:         { type:String, default:null },
  inviteRef:        { type:mongoose.Schema.Types.ObjectId, ref:'Invite', default:null },

  avatar:     { type:String, default:null },
  isActive:   { type:Boolean, default:true },
  lastLogin:  { type:Date,    default:null },
  lastSeenAt: { type:Date,    default:null, index:true },
}, { timestamps:true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(plain) {
  if (!this.password) return false;
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
