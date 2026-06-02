/**
 * Avto-eslatma: o'qituvchiga submission'larni tekshirishni eslatish.
 *
 * Shartlar:
 *   - Submission.status === 'submitted'
 *   - Submission.submittedAt < (now - REVIEW_REMINDER_DAYS)
 *   - Teacher.lastRemindedAt < (now - 24h) — dedupe
 *
 * Telegram xabar @Record_Nazorat_Bot orqali yuboriladi.
 */
const Submission = require('../models/Submission');
const Teacher    = require('../models/Teacher');
const User       = require('../models/User');

const REMINDER_DAYS = Number(process.env.REVIEW_REMINDER_DAYS || 2);
const REMIND_COOLDOWN_MS = 23 * 60 * 60 * 1000; // 23 soat (kuniga 1 ga yaqin)

const safeBot = () => {
  try { return require('./index'); } catch { return null; }
};

const escapeMd = (s = '') => String(s).replace(/([_*`\[\]])/g, '\\$1');

async function sendReminderTo(chatId, payload) {
  const bot = safeBot();
  if (!bot || !chatId) return false;
  const { teacherName, count, oldest } = payload;
  const oldestText = oldest != null
    ? `Eng eskisi: *${oldest} kun* avval topshirilgan.\n`
    : '';
  const text =
    `⏰ *Eslatma — vazifalarni belgilash*\n\n` +
    `Salom, ${escapeMd(teacherName)}!\n` +
    `Sizda *${count} ta* o'quvchi vazifasi ${REMINDER_DAYS}+ kundan beri belgilanmagan.\n` +
    oldestText +
    `\nIltimos, Mini App'ni ochib "Vazifalarim" bo'limidan belgilang.`;
  try {
    await bot.telegram.sendMessage(chatId, text, { parse_mode:'Markdown' });
    return true;
  } catch (err) {
    console.warn(`Reminder send fail (${chatId}):`, err.message);
    return false;
  }
}

async function checkOverdueAndRemind() {
  const threshold = new Date(Date.now() - REMINDER_DAYS * 24 * 60 * 60 * 1000);
  const cooldown  = new Date(Date.now() - REMIND_COOLDOWN_MS);

  // Per-teacher: nechta tekshirilmagan submission borligini hisoblash + eng eski submittedAt
  const agg = await Submission.aggregate([
    { $match: {
        status: 'submitted',
        submittedAt: { $lt: threshold },
    }},
    { $group: {
        _id: '$teacher',
        count: { $sum: 1 },
        oldest: { $min: '$submittedAt' },
    }},
  ]);
  if (!agg.length) return { sent: 0, candidates: 0 };

  const teacherIds = agg.map(x => x._id);

  // Cooldown'dan o'tgan teacher'larni topish
  const candidates = await Teacher.find({
    _id: { $in: teacherIds },
    status: 'active',
    $or: [
      { lastRemindedAt: null },
      { lastRemindedAt: { $lt: cooldown } },
    ],
  }).select('name').lean();
  const eligibleIds = new Set(candidates.map(t => String(t._id)));
  if (!eligibleIds.size) return { sent: 0, candidates: 0 };

  // Eligible teacherlarning Telegram chatId'larini topish
  const users = await User.find({
    teacherRef: { $in: candidates.map(t => t._id) },
    status: 'active',
    telegramId: { $ne: null },
  }).select('teacherRef telegramId').lean();
  const tgByTeacher = Object.fromEntries(users.map(u => [String(u.teacherRef), u.telegramId]));

  const aggMap = Object.fromEntries(agg.map(x => [String(x._id), x]));
  const now = Date.now();

  let sent = 0;
  for (const t of candidates) {
    const chatId = tgByTeacher[String(t._id)];
    if (!chatId) continue;
    const row = aggMap[String(t._id)];
    if (!row) continue;
    const oldestDays = Math.floor((now - new Date(row.oldest).getTime()) / (24 * 60 * 60 * 1000));
    const ok = await sendReminderTo(chatId, {
      teacherName: t.name,
      count: row.count,
      oldest: oldestDays,
    });
    if (ok) {
      await Teacher.updateOne({ _id: t._id }, { $set: { lastRemindedAt: new Date() } }).catch(() => {});
      sent++;
    }
  }
  return { sent, candidates: candidates.length };
}

/**
 * Reminder loop. Har soatda tekshiradi.
 * Birinchi run — server boot'idan keyin 5 daqiqa kutib boshlaydi.
 */
function startReminderLoop() {
  if (process.env.REMINDERS_DISABLED === 'true') {
    console.log('⏰ Reminders disabled by env');
    return;
  }
  const INTERVAL = 60 * 60 * 1000; // 1 soat
  const FIRST_DELAY = 5 * 60 * 1000; // 5 daqiqa boot'dan keyin
  setTimeout(async function tick() {
    try {
      const { sent, candidates } = await checkOverdueAndRemind();
      if (sent > 0) console.log(`⏰ Reminders: ${sent}/${candidates} o'qituvchiga yuborildi`);
    } catch (err) {
      console.error('⏰ Reminder error:', err.message);
    }
    setTimeout(tick, INTERVAL);
  }, FIRST_DELAY);
  console.log(`⏰ Reminder loop yoqildi (har soatda, ${REMINDER_DAYS} kun threshold)`);
}

module.exports = { checkOverdueAndRemind, startReminderLoop };
