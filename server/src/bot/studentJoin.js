/**
 * Bot orqali student qo'shish flow:
 * 1. User /start g_<token> bilan keladi
 * 2. Token guruhga to'g'ri kelsa, session ochiladi (awaiting_name)
 * 3. User ismni yozadi → pending Student yaratiladi
 * 4. Teacher'ga bot orqali xabar boradi
 *
 * Session in-memory Map'da saqlanadi — bot qayta yuklansa yo'qoladi (foydalanuvchi
 * yana /start g_<token> qila oladi). 30 daqiqalik TTL.
 */
const Group   = require('../models/Group');
const Student = require('../models/Student');

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 daqiqa
const sessions = new Map(); // tgId -> { groupId, expiresAt }

function setSession(tgId, groupId) {
  sessions.set(String(tgId), {
    groupId: String(groupId),
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

function getSession(tgId) {
  const s = sessions.get(String(tgId));
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    sessions.delete(String(tgId));
    return null;
  }
  return s;
}

function clearSession(tgId) {
  sessions.delete(String(tgId));
}

// Davriy tozalash
setInterval(() => {
  const now = Date.now();
  for (const [tgId, s] of sessions) {
    if (s.expiresAt < now) sessions.delete(tgId);
  }
}, 5 * 60 * 1000).unref?.();

/**
 * Token bo'yicha guruhni topish va bot session ochish.
 * Qaytarish: { group } yoki { error }
 */
async function startStudentJoin(tgId, token) {
  const group = await Group.findOne({ inviteToken: token, isActive: true })
    .populate('teacher', 'name')
    .lean();
  if (!group) return { error: "Bu havola yaroqsiz yoki guruh o'chirilgan." };

  // Avval shu Telegram bilan bu guruhga qo'shilganmi?
  const existing = await Student.findOne({
    telegramId: String(tgId),
    group: group._id,
  }).lean();

  if (existing) {
    const label = existing.status === 'pending'
      ? "⏳ Siz allaqachon ro'yxatdan o'tdingiz — o'qituvchi tasdiqlashini kuting."
      : existing.status === 'active'
      ? "✅ Siz allaqachon ushbu guruhdasiz."
      : "❌ Sizning ro'yxatga olinishingiz to'xtatilgan.";
    return { alreadyJoined: true, message: label, group };
  }

  setSession(tgId, group._id);
  return { group };
}

/**
 * Ism qabul qilish va pending Student yaratish.
 * Qaytarish: { student, group, teacherTgId } yoki { error }
 */
async function completeStudentJoin(tgId, name, telegramProfile = {}) {
  const session = getSession(tgId);
  if (!session) return { error: "Sessiya tugadi. /start ni yana bosing." };

  const trimmed = (name || '').trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    return { error: "Iltimos, to'liq ism familyangizni 2-80 belgi oralig'ida yozing." };
  }

  const group = await Group.findById(session.groupId);
  if (!group || !group.isActive) {
    clearSession(tgId);
    return { error: "Guruh topilmadi yoki o'chirilgan." };
  }

  // Bir Telegram bir guruhda faqat bir marta
  const exists = await Student.findOne({
    telegramId: String(tgId),
    group: group._id,
  }).lean();
  if (exists) {
    clearSession(tgId);
    return { error: "Siz allaqachon ushbu guruhga ulanasiz." };
  }

  const student = await Student.create({
    name: trimmed,
    group: group._id,
    teacher: group.teacher,
    status: 'pending',
    hue: Math.floor(Math.random() * 360),
    telegramId: String(tgId),
    telegramUsername:  telegramProfile.username  || null,
    telegramFirstName: telegramProfile.first_name || null,
    telegramLastName:  telegramProfile.last_name  || null,
    photoUrl:          telegramProfile.photo_url  || null,
    joinedViaBot: true,
  });
  clearSession(tgId);

  // Teacher'ning Telegram'iga xabar uchun chatId
  const User = require('../models/User');
  const teacherUser = await User.findOne({
    teacherRef: group.teacher,
    status: 'active',
    telegramId: { $ne: null },
  }).select('telegramId').lean();

  return {
    student,
    group,
    teacherTgId: teacherUser?.telegramId || null,
  };
}

module.exports = {
  startStudentJoin,
  completeStudentJoin,
  getSession,
  clearSession,
};
