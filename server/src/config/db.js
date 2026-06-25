const mongoose    = require('mongoose');
const ensureAdmin = require('./ensureAdmin');

// Eski `inviteToken_1` indexini va guruhlardagi inviteToken maydonini butunlay olib tashlaymiz —
// o'quvchilar endi invite link orqali qo'shilmaydi.
async function fixGroupInviteTokenIndex() {
  try {
    const groups = mongoose.connection.db.collection('groups');
    // Barcha inviteToken maydonlarini olib tashlaymiz (link orqali ulanish bekor qilindi)
    await groups.updateMany(
      { inviteToken: { $exists: true } },
      { $unset: { inviteToken: 1 } },
    );
    const indexes = await groups.indexes();
    const old = indexes.find(i => i.name === 'inviteToken_1');
    if (old) {
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

// O'quvchilarning Telegram ma'lumotlarini olib tashlaymiz — o'quvchilar endi
// o'qituvchi tomonidan qo'lda boshqariladi, Telegram bog'liqligi kerak emas.
// Mavjud o'quvchilar saqlanadi, faqat kerakli ma'lumotlari qoladi.
async function cleanupStudentTelegramData() {
  try {
    const students = mongoose.connection.db.collection('students');
    const res = await students.updateMany(
      { $or: [
        { telegramId:        { $exists: true } },
        { telegramUsername:  { $exists: true } },
        { telegramFirstName: { $exists: true } },
        { telegramLastName:  { $exists: true } },
        { joinedViaBot:      { $exists: true } },
      ]},
      { $unset: {
        telegramId: 1, telegramUsername: 1, telegramFirstName: 1,
        telegramLastName: 1, joinedViaBot: 1,
      }},
    );
    if (res.modifiedCount) {
      console.log(`🔧  Student Telegram ma'lumotlari tozalandi: ${res.modifiedCount} ta`);
    }
    // Eski telegramId indexini ham olib tashlaymiz
    try { await students.dropIndex('telegramId_1'); } catch { /* index yo'q — ignore */ }
  } catch (err) {
    if (!/ns not found/i.test(err.message || '')) {
      console.warn('⚠️   Student telegram cleanup:', err.message);
    }
  }
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅  MongoDB: ${conn.connection.host}`);
    await fixGroupInviteTokenIndex();
    await cleanupStudentTelegramData();
    await ensureAdmin();
  } catch (err) {
    console.error('❌  MongoDB failed:', err.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => console.warn('⚠️   MongoDB disconnected'));

module.exports = connectDB;
