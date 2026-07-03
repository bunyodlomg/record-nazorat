/**
 * Bot orqali Telegram xabar yuborish.
 * Bot bo'lmasa yoki xato yuz bersa, jim — backend operationi to'xtamaydi.
 */
const safeBot = () => {
  try { return require('./index'); } catch { return null; }
};

const sendTo = async (chatId, text, extra = {}) => {
  const bot = safeBot();
  if (!bot || !chatId) return false;
  try {
    await bot.telegram.sendMessage(chatId, text, { parse_mode:'Markdown', ...extra });
    return true;
  } catch (err) {
    console.warn(`Bot send fail (${chatId}):`, err.message);
    return false;
  }
};

// Markdown'dagi maxsus belgilarni escape qilish
const escapeMd = (s = '') => String(s).replace(/([_*`\[\]])/g, '\\$1');

/**
 * Rasm (Buffer) yuborish — statistika jadvali kabi generatsiya qilingan fayllar uchun.
 * Muvaffaqiyatsizlikda false qaytaradi, throw qilmaydi.
 */
const sendPhotoTo = async (chatId, buffer, caption = '') => {
  const bot = safeBot();
  if (!bot || !chatId) return false;
  try {
    await bot.telegram.sendPhoto(chatId, { source: buffer }, { caption });
    return true;
  } catch (err) {
    console.warn(`Bot photo send fail (${chatId}):`, err.message);
    return false;
  }
};

/**
 * Admin tomonidan o'qituvchiga shaxsiy xabar yoki maqtov.
 *
 * @param {string} chatId — teacher.user.telegramId
 * @param {{ kind:'message'|'praise', text:string, from:string }} payload
 */
async function sendTeacherMessage(chatId, { kind = 'message', text, from }) {
  const heading = kind === 'praise'
    ? `🌟 *Maqtov — ${escapeMd(from)} dan*`
    : `💬 *Xabar — ${escapeMd(from)} dan*`;
  return sendTo(chatId, `${heading}\n\n${escapeMd(text)}`);
}

const ROLE_LABEL = { admin:'Admin', teacher:"O'qituvchi" };

/**
 * Yangi foydalanuvchi (admin/teacher) pending bo'lganda — adminlarga xabar.
 *
 * @param {Object} user — pending User document
 */
async function notifyPending(user) {
  const User = require('../models/User');

  const role = ROLE_LABEL[user.role] || user.role;
  const usernameLine = user.telegramUsername ? `@${user.telegramUsername}` : `ID ${user.telegramId}`;

  const text =
    `🔔 *Yangi tasdiqlash so'rovi*\n\n` +
    `Ism: *${user.name}*\n` +
    `Telegram: ${usernameLine}\n` +
    `Roli: ${role}` +
    `\n\nMini App'da "Kutayotganlar" sahifasidan tasdiqlang.`;

  // Adminlarga
  const admins = await User.find({ role:'admin', status:'active', telegramId:{ $ne:null } }).select('telegramId').lean();
  for (const admin of admins) {
    if (String(admin.telegramId) === String(user.telegramId)) continue; // o'ziga yubormaslik
    await sendTo(admin.telegramId, text);
  }
}

/**
 * Foydalanuvchi tasdiqlangach unga xabar.
 *
 * @param {Object} user — User document (status='active')
 */
async function notifyApproved(user) {
  if (!user.telegramId) return;
  const role = ROLE_LABEL[user.role] || user.role;
  const text =
    `✅ *Sizning so'rovingiz tasdiqlandi!*\n\n` +
    `Endi siz tizimga *${role}* sifatida kira olasiz.\n\n` +
    `Mini App'ni ochish uchun /app yoki /start ni bosing.`;
  await sendTo(user.telegramId, text);
}

/**
 * Foydalanuvchi rad etilganida — unga xabar.
 */
async function notifyRejected(user) {
  if (!user.telegramId) return;
  const text =
    `❌ *Sizning so'rovingiz rad etildi*\n\n` +
    `Iltimos, administrator bilan bog'laning.`;
  await sendTo(user.telegramId, text);
}

module.exports = {
  notifyPending,
  notifyApproved,
  notifyRejected,
  sendTeacherMessage,
  sendPhotoTo,
};
