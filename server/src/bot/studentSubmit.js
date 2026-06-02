/**
 * Student vazifa topshirish — bot orqali.
 *
 * Flow:
 *  - Active student botga *istalgan xabar* yuboradi (text, voice, photo, video, file...)
 *  - Bot xabarni teacherning shaxsiy chatiga forward qiladi (boshida heading bilan).
 *  - Studentning eng yaqin dueDate'li pending Submission'i `submitted` ga aylanadi.
 *  - Studentga "yuborildi" javobi.
 *  - Teacher app'dagi Vazifalar sahifasida ko'rib +/- bosadi (bot inline tugmasi yo'q).
 */
const Student    = require('../models/Student');
const Submission = require('../models/Submission');
const Group      = require('../models/Group');
const User       = require('../models/User');

/**
 * Eng yaqin dueDate'ga ega pending submission'ni topadi.
 * Speaking ham, lesson ham — farqi yo'q.
 */
async function findNextPendingSubmission(studentId) {
  const subs = await Submission.find({ student: studentId, status: 'pending' })
    .populate('homework', 'title dueDate kind')
    .lean();
  const valid = subs.filter(s => s.homework);
  if (!valid.length) return null;
  // Eng yaqin dueDate (o'tib ketganlar ham yuqorida — orqada qolgan vazifalarni avval topshirsin)
  valid.sort((a, b) => new Date(a.homework.dueDate) - new Date(b.homework.dueDate));
  return valid[0];
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dt); target.setHours(0,0,0,0);
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return 'Bugun';
  if (diff === -1) return 'Kecha';
  if (diff === 1) return 'Ertaga';
  if (diff < 0)   return `${-diff} kun oldin`;
  return dt.toLocaleDateString('uz-UZ', { day:'numeric', month:'long' });
}

/**
 * Active student xabarini qabul qilib teacher'ga forward qiladi va Submission update.
 * Qaytaradi: { handled: bool, replyText: string|null }
 */
async function handleStudentMessage(ctx, student) {
  const sub = await findNextPendingSubmission(student._id);
  if (!sub) {
    return {
      handled: true,
      replyText: "📭 Hozircha topshirilishi kerak vazifa yo'q. Yangi vazifa berilganda shu yerda xabar olasiz.",
    };
  }

  // Teacher tg id'sini topish (User.teacherRef orqali)
  const teacherUser = await User.findOne({ teacherRef: sub.teacher, role: 'teacher' })
    .select('telegramId name').lean();

  const group = await Group.findById(student.group).select('name code').lean();
  const groupLabel = group ? `${group.name} (${group.code})` : '';

  const dueLabel = fmtDate(sub.homework.dueDate);
  const kindIcon = sub.homework.kind === 'speaking' ? '🎤' : '📝';

  // Header xabar — teacherga forward'dan oldin yuboriladi
  const headerText =
    `${kindIcon} *Yangi vazifa topshirildi*\n\n` +
    `🧑‍🎓 *${student.name}*\n` +
    (groupLabel ? `👥 ${groupLabel}\n` : '') +
    `📚 *${sub.homework.title}*\n` +
    `📅 Muddat: ${dueLabel}`;

  if (teacherUser?.telegramId) {
    try {
      await ctx.telegram.sendMessage(teacherUser.telegramId, headerText, { parse_mode: 'Markdown' });
      // Studentning aynan shu xabarini teacher'ga forward qilamiz
      await ctx.telegram.forwardMessage(teacherUser.telegramId, ctx.chat.id, ctx.message.message_id);
    } catch (e) {
      console.error('[studentSubmit] forward failed:', e.message);
      // Forward ishlamasa ham — submission status'ni o'zgartiramiz
    }
  }

  // Submission status update
  await Submission.findByIdAndUpdate(sub._id, {
    status: 'submitted',
    submittedAt: new Date(),
  });
  await Submission.recomputeHomework(sub.homework._id);

  return {
    handled: true,
    replyText:
      `✅ *${sub.homework.title}* vazifasi yuborildi!\n\n` +
      `O'qituvchingiz ko'rib chiqib belgilaydi. Natija shu botga keladi.`,
  };
}

module.exports = { handleStudentMessage };
