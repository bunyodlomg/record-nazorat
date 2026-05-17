const mongoose    = require('mongoose');
const ensureAdmin = require('./ensureAdmin');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅  MongoDB: ${conn.connection.host}`);
    await ensureAdmin();
  } catch (err) {
    console.error('❌  MongoDB failed:', err.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => console.warn('⚠️   MongoDB disconnected'));

module.exports = connectDB;
