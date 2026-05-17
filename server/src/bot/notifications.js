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

const ROLE_LABEL = { admin:'Administrator', teacher:"O'qituvchi", student:"O'quvchi" };

/**
 * Yangi foydalanuvchi pending bo'lganda — tasdiqlovchi(lar)ga xabar.
 *
 * @param {Object} user — pending User document (populate'd: pendingGroupRef)
 */
async function notifyPending(user) {
  const User = require('../models/User');
  const Group = require('../models/Group');

  const role = ROLE_LABEL[user.role] || user.role;
  const usernameLine = user.telegramUsername ? `@${user.telegramUsername}` : `ID ${user.telegramId}`;

  let groupLine = '';
  let teacherTgId = null;
  if (user.role === 'student' && user.pendingGroupRef) {
    const group = await Group.findById(user.pendingGroupRef).populate('teacher', 'name');
    if (group) {
      groupLine = `\nGuruh: *${group.name}* (${group.code})`;
      if (group.teacher) {
        const teacherUser = await User.findOne({ teacherRef: group.teacher._id, status:'active' }).select('telegramId').lean();
        teacherTgId = teacherUser?.telegramId;
      }
    }
  }

  const text =
    `🔔 *Yangi tasdiqlash so'rovi*\n\n` +
    `Ism: *${user.name}*\n` +
    `Telegram: ${usernameLine}\n` +
    `Roli: ${role}` + groupLine +
    `\n\nMini App'da "Kutayotganlar" sahifasidan tasdiqlang.`;

  // Adminlarga
  const admins = await User.find({ role:'admin', status:'active', telegramId:{ $ne:null } }).select('telegramId').lean();
  for (const admin of admins) {
    if (String(admin.telegramId) === String(user.telegramId)) continue; // o'ziga yubormaslik
    await sendTo(admin.telegramId, text);
  }

  // Group teacher'iga (agar boshqa shaxs bo'lsa)
  if (teacherTgId && !admins.some(a => String(a.telegramId) === String(teacherTgId))) {
    await sendTo(teacherTgId, text);
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

/**
 * Yangi vazifa berilganida — guruhdagi o'quvchilarga.
 */
async function notifyHomeworkAssigned(homework, group, students) {
  if (!homework || !students?.length) return;
  const text =
    `📝 *Yangi vazifa*\n\n` +
    `*${homework.title}*\n` +
    (group ? `Guruh: ${group.name}\n` : '') +
    `Muddati: ${homework.dueLabel || new Date(homework.dueDate).toLocaleDateString('uz-UZ')}`;
  for (const s of students) {
    if (s.telegramId) await sendTo(s.telegramId, text);
  }
}

module.exports = {
  notifyPending,
  notifyApproved,
  notifyRejected,
  notifyHomeworkAssigned,
  sendTeacherMessage,
};
