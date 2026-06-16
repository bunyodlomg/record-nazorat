const User = require('../models/User');

/**
 * Teacher rasmi `User` modelida saqlanadi (Telegram login orqali), `Teacher`'da emas.
 * Berilgan Teacher id'lar uchun { teacherId: photoUrl } map qaytaradi.
 * Display endpointlar (dashboard, groups, homework, calendar, leaderboard) shuni ishlatadi.
 *
 * @param {Array<string|ObjectId>} teacherIds
 * @returns {Promise<Object<string,string|null>>}
 */
async function getTeacherPhotoMap(teacherIds = []) {
  const ids = [...new Set(teacherIds.filter(Boolean).map(String))];
  if (!ids.length) return {};
  const users = await User.find({ teacherRef: { $in: ids } })
    .select('teacherRef photoUrl telegramUsername').lean();
  const map = {};
  for (const u of users) {
    if (u.teacherRef) map[String(u.teacherRef)] = u.photoUrl || null;
  }
  return map;
}

module.exports = { getTeacherPhotoMap };
