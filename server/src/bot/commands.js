const { Markup } = require('telegraf');
const User = require('../models/User');
const inviteCache = require('./inviteCache');

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
  // /start (default) yoki /start invite_xxx
  bot.start(async (ctx) => {
    const tgId = String(ctx.from.id);
    const startPayload = ctx.startPayload; // 'invite_xxx' ko'rinishida

    // Agar invite token bor bo'lsa — cache'ga yozamiz (WebApp ochganda
    // start_param kelmasa, shu cache'dan o'qiymiz)
    if (startPayload && startPayload.startsWith('invite_')) {
      inviteCache.set(tgId, startPayload);
    }

    // User bazada borligini tekshiramiz
    const user = await User.findOne({ telegramId: tgId }).lean();

    let text;
    if (user) {
      const roleLabel = user.role === 'admin' ? 'Administrator' :
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
    const roleLabel = user.role === 'admin' ? 'Administrator' :
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

  // Boshqa har qanday matn — yordamga yo'naltir
  bot.on('message', async (ctx) => {
    if (!ctx.message?.text || ctx.message.text.startsWith('/')) return;
    const kb = webAppButton('🚀 Mini App ochish');
    await ctx.reply(
      'Mini App orqali tizimni boshqarishingiz mumkin. /help — yordam',
      kb || {}
    );
  });
};
