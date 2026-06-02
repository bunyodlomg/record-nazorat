const { Markup } = require('telegraf');
const User = require('../models/User');
const Student = require('../models/Student');
const inviteCache = require('./inviteCache');
const { startStudentJoin, startStudentJoinByInvite, completeStudentJoin, getSession, clearSession } = require('./studentJoin');
const { notifyStudentPending } = require('./notifications');
const { handleStudentMessage } = require('./studentSubmit');

/**
 * WebApp tugma — agar inviteToken berilgan bo'lsa, URL'ga ?invite=xxx
 * parametri qo'shiladi (client tomonida o'qib, server'ga yuboriladi).
 */
function webAppButton(label = 'Mini App ochish', inviteToken = null) {
  const base = process.env.WEBAPP_URL;
  if (!base) return null;
  const url = inviteToken
    ? `${base}${base.includes('?') ? '&' : '?'}invite=${encodeURIComponent(inviteToken)}`
    : base;
  return Markup.inlineKeyboard([
    [Markup.button.webApp(label, url)],
  ]);
}

const HELP_TEXT = (
  `🎓 *Record Nazorat* — o'qituvchi va o'quvchilar uchun nazorat tizimi.\n\n` +
  `*Buyruqlar:*\n` +
  `• /start — bosh sahifa\n` +
  `• /app — Mini App'ni ochish\n` +
  `• /help — yordam\n\n` +
  `Tizimga kirish uchun administrator yoki o'qituvchidan taklif link oling.`
);

module.exports = function attach(bot) {
  // /start (default) yoki /start invite_xxx yoki /start g_<token>
  bot.start(async (ctx) => {
    const tgId = String(ctx.from.id);
    const startPayload = ctx.startPayload; // 'invite_xxx' yoki 'g_xxx'

    // ── 1) STUDENT INVITE (g_<token>) — Mini App emas, faqat bot orqali ulanish
    if (startPayload && startPayload.startsWith('g_')) {
      const token = startPayload.slice(2);
      const result = await startStudentJoin(tgId, token, ctx.from);
      if (result.error) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }
      if (result.alreadyJoined) {
        await ctx.replyWithMarkdown(`${result.message}\n\nGuruh: *${result.group.name}* (${result.group.code})`);
        return;
      }
      const teacherName = result.group.teacher?.name || "O'qituvchi";
      await ctx.replyWithMarkdown(
        `🎓 *${result.group.name}* (${result.group.code}) guruhiga xush kelibsiz!\n\n` +
        `O'qituvchi: *${teacherName}*\n\n` +
        `Iltimos, *to'liq ism familyangizni* yozing.\n` +
        `Masalan: \`Ali Valiyev\``
      );
      return;
    }

    // ── 2) INVITE TOKEN (invite_<token>) — student bo'lsa studentJoin, aks holda Mini App cache
    if (startPayload && startPayload.startsWith('invite_')) {
      const token = startPayload.slice('invite_'.length);
      const result = await startStudentJoinByInvite(tgId, token);
      if (result.error) {
        await ctx.reply(`❌ ${result.error}`);
        return;
      }
      if (result.alreadyJoined) {
        await ctx.replyWithMarkdown(`${result.message}\n\nGuruh: *${result.group.name}* (${result.group.code})`);
        return;
      }
      if (result.group) {
        // Student invite muvaffaqiyatli — ism so'raymiz
        const teacherName = result.group.teacher?.name || "O'qituvchi";
        await ctx.replyWithMarkdown(
          `🎓 *${result.group.name}* (${result.group.code}) guruhiga xush kelibsiz!\n\n` +
          `O'qituvchi: *${teacherName}*\n\n` +
          `Iltimos, *to'liq ism familyangizni* yozing.\n` +
          `Masalan: \`Ali Valiyev\``
        );
        return;
      }
      // notStudent: admin/teacher invite — Mini App cache + flow davom etadi
      inviteCache.set(tgId, startPayload);
    }

    // User bazada borligini tekshiramiz
    const user = await User.findOne({ telegramId: tgId }).lean();

    let text;
    if (user) {
      const roleLabel = user.role === 'admin' ? 'Admin' :
                        user.role === 'teacher' ? "O'qituvchi" :
                        user.role === 'student' ? "O'quvchi" : 'Foydalanuvchi';
      const statusLabel = user.status === 'active' ? '✅ Faol' :
                          user.status === 'pending' ? '⏳ Tasdiqlash kutilmoqda' :
                          user.status === 'rejected' ? '❌ Rad etilgan' : user.status;
      text = (
        `👋 Salom, *${user.name}*!\n\n` +
        `Roli: *${roleLabel}*\n` +
        `Holat: ${statusLabel}\n\n` +
        `Tizimga kirish uchun pastdagi tugmani bosing.`
      );
    } else if (startPayload && startPayload.startsWith('invite_')) {
      text = (
        `🎉 *Record Nazorat'ga xush kelibsiz!*\n\n` +
        `Sizga taklif link yuborilgan. Tizimga kirish uchun pastdagi tugmani bosing — ` +
        `ma'lumotlaringiz administrator yoki o'qituvchi tomonidan tasdiqlanadi.`
      );
    } else {
      text = (
        `🎓 *Record Nazorat'ga xush kelibsiz!*\n\n` +
        `Bu — o'qituvchi va o'quvchilar uchun nazorat tizimi.\n\n` +
        `⚠️ Tizimga kirish uchun *administrator yoki o'qituvchidan taklif link* olishingiz kerak.\n\n` +
        `Yordam uchun: /help`
      );
    }

    // Agar invite token bor — URL'ga qo'shamiz (client URL search'dan o'qiydi)
    const inviteToken = (startPayload && startPayload.startsWith('invite_'))
      ? startPayload : null;
    const kb = webAppButton('🚀 Mini App ochish', inviteToken);
    await ctx.replyWithMarkdown(text, kb || {});
  });

  // /app — WebApp tugmasi
  bot.command('app', async (ctx) => {
    const kb = webAppButton('🚀 Mini App ochish');
    if (!kb) {
      await ctx.reply("WebApp URL sozlanmagan. Administrator bilan bog'laning.");
      return;
    }
    await ctx.reply('Mini App\'ni ochish uchun tugmani bosing:', kb);
  });

  // /help
  bot.help(async (ctx) => {
    const kb = webAppButton('🚀 Mini App ochish');
    await ctx.replyWithMarkdown(HELP_TEXT, kb || {});
  });

  // /me — foydalanuvchi profili
  bot.command('me', async (ctx) => {
    const tgId = String(ctx.from.id);
    const user = await User.findOne({ telegramId: tgId }).lean();
    if (!user) {
      await ctx.reply("Siz hali tizimda ro'yxatdan o'tmagansiz. /start ni bosing.");
      return;
    }
    const roleLabel = user.role === 'admin' ? 'Admin' :
                      user.role === 'teacher' ? "O'qituvchi" :
                      user.role === 'student' ? "O'quvchi" : 'Foydalanuvchi';
    const statusLabel = user.status === 'active' ? '✅ Faol' :
                        user.status === 'pending' ? '⏳ Tasdiqlash kutilmoqda' :
                        user.status === 'rejected' ? '❌ Rad etilgan' : user.status;
    const text = (
      `👤 *Profil*\n\n` +
      `Ism: *${user.name}*\n` +
      `Roli: *${roleLabel}*\n` +
      `Holat: ${statusLabel}\n` +
      (user.telegramUsername ? `Username: @${user.telegramUsername}\n` : '') +
      `ID: \`${tgId}\``
    );
    await ctx.replyWithMarkdown(text);
  });

  // Boshqa har qanday xabar — text yoki media (voice/photo/video/file):
  bot.on('message', async (ctx) => {
    const text = ctx.message?.text;
    // /command bo'lsa o'tkazib yuboramiz (yuqorida bot.command bilan handle qilingan)
    if (text && text.startsWith('/')) return;
    const tgId = String(ctx.from.id);

    // ── 1) Student join sessiyasi (ism kutilmoqda — faqat text)
    if (text) {
      const session = getSession(tgId);
      if (session) {
        const result = await completeStudentJoin(tgId, text.trim(), ctx.from);
        if (result.error) {
          await ctx.reply(`❌ ${result.error}`);
          return;
        }
        await ctx.replyWithMarkdown(
          `✅ *${result.student.name}*, ro'yxatdan o'tdingiz!\n\n` +
          `Guruh: *${result.group.name}* (${result.group.code})\n` +
          `Holat: ⏳ *O'qituvchi tasdiqlashini kuting*\n\n` +
          `Tasdiqlangach, vazifa va baholaringiz haqida shu botga xabar keladi.`
        );
        if (result.teacherTgId) {
          notifyStudentPending(result.teacherTgId, {
            studentName: result.student.name,
            groupName:   result.group.name,
            groupCode:   result.group.code,
            telegramUsername: ctx.from.username || null,
          }).catch(() => {});
        }
        return;
      }
    }

    // ── 2) Student bo'lsa — pending/active holatga qarab
    const student = await Student.findOne({ telegramId: tgId }).lean();
    if (student) {
      if (student.status === 'pending') {
        await ctx.reply("⏳ O'qituvchi tasdiqlashini kuting. Tasdiqlangach xabarlar shu botga keladi.");
        return;
      }
      if (student.status === 'active') {
        // Vazifa topshirish — har qanday xabar (text yoki media) teacher'ga forward qilinadi
        try {
          const res = await handleStudentMessage(ctx, student);
          if (res?.replyText) {
            await ctx.replyWithMarkdown(res.replyText);
          }
        } catch (e) {
          console.error('[bot] student submit error:', e);
          await ctx.reply("Yuborishda xatolik. Birozdan keyin qaytadan urinib ko'ring.");
        }
        return;
      }
      // rejected / inactive
      await ctx.reply("Sizning hisobingiz faol emas. O'qituvchingiz bilan bog'laning.");
      return;
    }

    // ── 3) Boshqa hollar (admin/teacher yoki noma'lum) — faqat textga javob
    if (text) {
      const kb = webAppButton('🚀 Mini App ochish');
      await ctx.reply(
        'Mini App orqali tizimni boshqarishingiz mumkin. /help — yordam',
        kb || {}
      );
    }
  });
};
