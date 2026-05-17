const mongoose = require('mongoose');
const crypto   = require('crypto');

const inviteSchema = new mongoose.Schema({
  token:     { type:String, required:true, unique:true, index:true },
  role:      { type:String, enum:['admin','teacher','student'], required:true },
  label:     { type:String, default:null, trim:true },
  createdBy: { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },

  // Student invite uchun: qaysi guruhga qo'shiladi
  group:     { type:mongoose.Schema.Types.ObjectId, ref:'Group', default:null, index:true },

  // single-use yoki ko'p marta — default single-use
  maxUses:   { type:Number, default:1, min:1 },
  uses:      [{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],

  expiresAt: { type:Date, default:null },
  revokedAt: { type:Date, default:null },
}, { timestamps:true });

inviteSchema.virtual('isUsed').get(function() {
  return this.uses.length >= this.maxUses;
});
inviteSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});
inviteSchema.virtual('isRevoked').get(function() {
  return !!this.revokedAt;
});
inviteSchema.virtual('isValid').get(function() {
  return !this.isUsed && !this.isExpired && !this.isRevoked;
});

inviteSchema.set('toJSON', { virtuals:true });
inviteSchema.set('toObject', { virtuals:true });

inviteSchema.statics.generateToken = function() {
  return crypto.randomBytes(16).toString('base64url');
};

module.exports = mongoose.model('Invite', inviteSchema);
