const mongoose = require('mongoose');

/**
 * Singleton settings document — global tizim sozlamalari.
 * Faqat bitta document bo'ladi (key: 'global').
 */
const settingsSchema = new mongoose.Schema({
  key: { type:String, required:true, unique:true, default:'global' },

  // Gem qiymatlari (har tekshirilgan vazifa uchun o'quvchiga beriladi)
  lessonGem:   { type:Number, default:5,  min:0, max:1000 },
  speakingGem: { type:Number, default:10, min:0, max:1000 },
}, { timestamps:true });

// Singleton getter — hech qachon null qaytarmaydi
settingsSchema.statics.getGlobal = async function() {
  let doc = await this.findOne({ key:'global' });
  if (!doc) doc = await this.create({ key:'global' });
  return doc;
};

module.exports = mongoose.model('Settings', settingsSchema);
