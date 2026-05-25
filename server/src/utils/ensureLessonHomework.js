const Group      = require('../models/Group');
const Student    = require('../models/Student');
const Homework   = require('../models/Homework');
const Submission = require('../models/Submission');

const DAY_INDEX = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
const MONTHS_UZ = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
const MAX_BACKFILL_DAYS = 60;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatLessonDate(date) {
  // "16-May" formatida
  const d = new Date(date);
  return `${d.getDate()}-${MONTHS_UZ[d.getMonth()]}`;
}

async function ensureForGroup(group) {
  if (!group || group.isActive === false) return 0;
  const days = Array.isArray(group.scheduleDays) ? group.scheduleDays : [];
  if (!days.length) return 0;

  const dayIndices = days.map(d => DAY_INDEX[d]).filter(i => i !== undefined);
  if (!dayIndices.length) return 0;

  const today = startOfDay(new Date());
  const groupStart = startOfDay(group.startDate || group.createdAt || today);
  const maxBack   = startOfDay(new Date(today.getTime() - MAX_BACKFILL_DAYS * 86400000));
  const start     = groupStart > maxBack ? groupStart : maxBack;

  if (start > today) return 0;

  const lessonDates = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    if (dayIndices.includes(d.getDay())) lessonDates.push(new Date(d));
  }
  if (!lessonDates.length) return 0;

  // Mavjud homework'lar — sana bo'yicha
  const rangeStart = lessonDates[0];
  const rangeEnd   = new Date(lessonDates[lessonDates.length - 1].getTime() + 86400000);
  const existing = await Homework.find({
    group: group._id,
    autoLesson: true,
    dueDate: { $gte: rangeStart, $lt: rangeEnd },
  }).select('dueDate').lean();
  const existingDays = new Set(existing.map(h => startOfDay(h.dueDate).getTime()));

  const toCreate = lessonDates.filter(d => !existingDays.has(d.getTime()));
  if (!toCreate.length) return 0;

  const students = await Student.find({ group: group._id, status: 'active' }).select('_id telegramId status').lean();
  const total = Math.max(students.length, 1);

  const docs = toCreate.map(date => ({
    title: `${formatLessonDate(date)} — dars vazifasi`,
    description: '',
    group: group._id,
    teacher: group.teacher,
    dueDate: date,
    col: 'pending',
    priority: 'medium',
    total,
    autoLesson: true,
  }));

  const created = await Homework.insertMany(docs, { ordered: false }).catch(() => []);
  if (!created.length || !students.length) return created.length;

  const subDocs = [];
  for (const hw of created) {
    for (const s of students) {
      subDocs.push({
        homework: hw._id,
        student: s._id,
        group: hw.group,
        teacher: hw.teacher,
        status: 'pending',
      });
    }
  }
  if (subDocs.length) await Submission.insertMany(subDocs, { ordered: false }).catch(() => {});

  // Bot orqali xabar (active + telegramId bor o'quvchilarga)
  try {
    const { notifyHomeworkAssigned } = require('../bot/notifications');
    const tgStudents = students.filter(s => s.telegramId);
    if (tgStudents.length) {
      for (const hw of created) {
        notifyHomeworkAssigned(hw, group, tgStudents).catch(() => {});
      }
    }
  } catch {}

  return created.length;
}

/** Bir guruh uchun (ID bo'yicha) */
async function ensureLessonHomeworkForGroup(groupId) {
  const group = await Group.findById(groupId);
  if (!group) return 0;
  return ensureForGroup(group);
}

/** Teacher'ning barcha aktiv guruhlari uchun */
async function ensureLessonHomeworkForTeacher(teacherId) {
  if (!teacherId) return 0;
  const groups = await Group.find({ teacher: teacherId, isActive: true });
  let n = 0;
  for (const g of groups) n += await ensureForGroup(g);
  return n;
}

/** Hamma aktiv guruhlar uchun (admin) */
async function ensureLessonHomeworkForAll() {
  const groups = await Group.find({ isActive: true });
  let n = 0;
  for (const g of groups) n += await ensureForGroup(g);
  return n;
}

module.exports = {
  ensureLessonHomeworkForGroup,
  ensureLessonHomeworkForTeacher,
  ensureLessonHomeworkForAll,
};
