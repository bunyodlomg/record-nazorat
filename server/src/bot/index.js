const { Telegraf } = require('telegraf');

const token = process.env.BOT_TOKEN;
let bot = null;

if (!token) {
  console.warn("⚠️   BOT_TOKEN .env da yo'q — bot ishga tushmaydi");
} else {
  bot = new Telegraf(token);

  bot.catch((err, ctx) => {
    console.error(`Bot error in ${ctx?.updateType}:`, err.message);
  });

  require('./commands')(bot);
}

module.exports = bot;
