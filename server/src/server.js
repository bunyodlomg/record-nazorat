require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');

connectDB();

const app = express();
// ngrok / reverse proxy ortida ishlash uchun
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy:false, crossOriginEmbedderPolicy:false }));

// CORS — Telegram WebApp uchun ham ochiq.
// Production'da CLIENT_URL ni cheklang yoki origin'lar listini sozlang.
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CLIENT_URL || '*')
  .split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    // Telegram WebApp / ngrok / vercel kabi proxy/tunnel'lar uchun
    if (/\.(ngrok|trycloudflare|vercel|netlify|tg\.dev|t\.me)/.test(origin)) return cb(null, true);
    cb(null, true); // dev mode'da hammasini ruxsat berish
  },
  credentials: true,
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
}));
// Ilova ko'p polling qiladi (notifications/dashboard/homework har 10-12s), shuning
// uchun limit yuqori. Auth va health'ni cheklamaymiz (429 kirishni bloklamasin).
app.use(rateLimit({
  windowMs: 15*60*1000,
  max: Number(process.env.RATE_LIMIT_MAX || 5000),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path.startsWith('/api/auth'),
}));
app.use(express.json({ limit:'10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/invites',     require('./routes/invites'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/teachers',    require('./routes/teachers'));
app.use('/api/groups',      require('./routes/groups'));
app.use('/api/students',    require('./routes/students'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/homework',    require('./routes/homework'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/calendar',    require('./routes/calendar'));
app.use('/api/settings',    require('./routes/settings'));

app.get('/health', (_req, res) => res.json({ status:'ok', ts:new Date() }));
app.use((_req, res) => res.status(404).json({ success:false, message:'Route not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n  🎓 Record Nazorat API  →  http://localhost:${PORT}\n`);
});

// Telegram bot — long polling rejimida ishlaydi
const bot = require('./bot');
if (bot) {
  (async () => {
    try {
      await bot.telegram.setMyCommands([
        { command:'start', description:'Bosh sahifa' },
        { command:'app',   description:"Mini App'ni ochish" },
        { command:'me',    description:'Mening profilim' },
        { command:'help',  description:'Yordam' },
      ]);
      // launch() polling boshlanganida pseudo-resolve qiladi (Telegraf docs)
      bot.launch();
      console.log(`🤖  Bot @${process.env.BOT_USERNAME} ishga tushdi`);

      // Avto-eslatma loop (vazifa tekshirish kechikishi)
      require('./bot/reminders').startReminderLoop();
    } catch (err) {
      console.error('❌  Bot launch:', err.message);
    }
  })();

  process.once('SIGINT',  () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('unhandledRejection', err => { console.error(err); server.close(() => process.exit(1)); });
