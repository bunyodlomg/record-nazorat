const User = require('../models/User');

/**
 * Birinchi admin'ni mavjudligini ta'minlaydi.
 *  1) TELEGRAM_ADMIN_ID — Telegram orqali kiruvchi admin (parolsiz)
 *     Hech qanday ism qo'yilmaydi — birinchi marta WebApp ochilganda Telegram'dan keladi.
 *  2) ADMIN_EMAIL/ADMIN_PASSWORD — browser orqali kiruvchi admin (fallback)
 *     Faqat ADMIN_EMAIL env'da berilgan bo'lsa yaratiladi.
 */
async function ensureAdmin() {
  const tgId = process.env.TELEGRAM_ADMIN_ID;

  // 1) Telegram admin
  if (tgId) {
    const tgAdmin = await User.findOne({ telegramId: String(tgId) });
    if (tgAdmin) {
      let dirty = false;
      if (tgAdmin.role   !== 'admin')  { tgAdmin.role   = 'admin';  dirty = true; }
      if (tgAdmin.status !== 'active') { tgAdmin.status = 'active'; dirty = true; }
      if (dirty) await tgAdmin.save({ validateBeforeSave:false });
    } else {
      await User.create({
        name: 'Administrator',
        role: 'admin',
        status: 'active',
        telegramId: String(tgId),
      });
      console.log(`✅  Telegram admin tayyor: id=${tgId}`);
    }
  }

  // 2) Email admin (faqat ADMIN_EMAIL berilgan bo'lsa)
  if (process.env.ADMIN_EMAIL) {
    const email = process.env.ADMIN_EMAIL.toLowerCase();
    const exists = await User.findOne({ email });
    if (!exists) {
      await User.create({
        name: process.env.ADMIN_NAME || 'Administrator',
        email,
        password: process.env.ADMIN_PASSWORD || 'admin123',
        role: 'admin',
        status: 'active',
      });
      console.log(`✅  Email admin yaratildi: ${email}`);
    }
  }
}

module.exports = ensureAdmin;
