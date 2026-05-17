/**
 * Clean reset script — userlardan tashqari hamma demo datani o'chiradi
 * va admin user mavjudligini ta'minlaydi.
 *
 * Run: `npm run seed`
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose    = require('mongoose');
const Teacher     = require('../models/Teacher');
const Group       = require('../models/Group');
const Homework    = require('../models/Homework');
const ensureAdmin = require('./ensureAdmin');

async function reset() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/recordnazorat');
  console.log('🔌  Connected');

  const [t, g, h] = await Promise.all([
    Teacher.deleteMany(),
    Group.deleteMany(),
    Homework.deleteMany(),
  ]);
  console.log(`🗑️   Cleared: ${t.deletedCount} teachers, ${g.deletedCount} groups, ${h.deletedCount} homework`);

  await ensureAdmin();

  console.log('\n✨  Clean reset complete.\n');
  process.exit(0);
}

reset().catch(err => { console.error(err); process.exit(1); });
