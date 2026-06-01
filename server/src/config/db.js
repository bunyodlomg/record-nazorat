const mongoose    = require('mongoose');
const ensureAdmin = require('./ensureAdmin');

// Eski `inviteToken_1` (sparse+unique, null bilan) indexini drop qilamiz —
// yangi schema partialFilterExpression bilan index yaratadi.
async function fixGroupInviteTokenIndex() {
  try {
    const groups = mongoose.connection.db.collection('groups');
    // Avval barcha null/empty tokenlarni unset qilamiz, aks holda yangi index ham xato berishi mumkin
    await groups.updateMany(
      { $or: [{ inviteToken: null }, { inviteToken: '' }] },
      { $unset: { inviteToken: 1 } },
    );
    const indexes = await groups.indexes();
    const old = indexes.find(i => i.name === 'inviteToken_1');
    // Eski index'da partialFilterExpression yo'q — uni drop qilamiz, Mongoose qaytadan yaratadi
    if (old && !old.partialFilterExpression) {
      await groups.dropIndex('inviteToken_1');
      console.log('🔧  Group.inviteToken: eski index drop qilindi');
    }
  } catch (err) {
    // index yo'q bo'lsa yoki collection hali yaratilmagan bo'lsa — ignore
    if (!/ns not found|index not found/i.test(err.message || '')) {
      console.warn('⚠️   inviteToken index fix:', err.message);
    }
  }
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅  MongoDB: ${conn.connection.host}`);
    await fixGroupInviteTokenIndex();
    await ensureAdmin();
  } catch (err) {
    console.error('❌  MongoDB failed:', err.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => console.warn('⚠️   MongoDB disconnected'));

module.exports = connectDB;
