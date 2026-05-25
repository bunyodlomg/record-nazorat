const Group      = require('../models/Group');
const Student    = require('../models/Student');
const Homework   = require('../models/Homework');
const Submission = require('../models/Submission');

const MONTHS_UZ = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
const MAX_BACKFILL_WEEKS = 8; // 2 oygacha orqaga ham yaratish (yangi guruhda bir-ikki hafta)

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }

// Dushanba sanasini topish (ISO hafta — du:1, ya:0)
function mondayOf(date) {
  const d = startOfDay(date);
  const dow = d.getDay(); // 0=ya .. 6=sh
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + delta);
  return d;
}

function fmtRange(monday) {
  const sun = new Date(monday);
  sun.setDate(sun.getDate() + 6);
  return `${monday.getDate()}–${sun.getDate()} ${MONTHS_UZ[sun.getMonth()]}`;
}

async function ensureForGroup(group) {
  if (!group || group.isActive === false) return 0;
  const N = Math.max(0, Math.min(7, group.speakingPerWeek ?? 2));
  if (!N) return 0;

  const today  = startOfDay(new Date());
  const start  = startOfDay(group.startDate || group.createdAt || today);
  const firstMonday = mondayOf(start);
  const cutoff = mondayOf(new Date(today.getTime() - MAX_BACKFILL_WEEKS * 7 * 86400000));
  const beginMonday = firstMonday > cutoff ? firstMonday : cutoff;
  const todayMonday = mondayOf(today);

  if (beginMonday > todayMonday) return 0;

  const weeks = [];
  for (let m = new Date(beginMonday); m <= todayMonday; m.setDate(m.getDate() + 7)) {
    weeks.push(new Date(m));
  }
  if (!weeks.length) return 0;

  const existing = await Homework.find({
    group: group._id,
    kind: 'speaking',
    weekStart: { $in: weeks },
  }).select('weekStart weekSeq').lean();
  const have = new Set(existing.map(h => `${new Date(h.weekStart).getTime()}_${h.weekSeq}`));

  const students = await Student.find({ group: group._id, status: 'active' }).select('_id telegramId status').lean();
  const total = Math.max(students.length, 1);

  const docs = [];
  for (const monday of weeks) {
    const due = endOfDay(new Date(monday.getTime() + 6 * 86400000)); // yakshanba 23:59
    const range = fmtRange(monday);
    for (let i = 1; i <= N; i++) {
      const key = `${monday.getTime()}_${i}`;
      if (have.has(key)) continue;
      docs.push({
        title: `Speaking · ${range} · #${i}`,
        description: '',
        group: group._id,
        teacher: group.teacher,
        dueDate: due,
        col: 'pending',
        priority: 'medium',
        total,
        kind: 'speaking',
        weekStart: monday,
        weekSeq: i,
      });
    }
  }
  if (!docs.length) return 0;

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

  // Bot orqali shu hafta'gi (joriy hafta) yangi speakinglar haqida xabar — tarixga emas
  try {
    const { notifyHomeworkAssigned } = require('../bot/notifications');
    const tgStudents = students.filter(s => s.telegramId);
    if (tgStudents.length) {
      const currentMonday = todayMonday.getTime();
      for (const hw of created) {
        if (new Date(hw.weekStart).getTime() === currentMonday) {
          notifyHomeworkAssigned(hw, group, tgStudents).catch(() => {});
        }
      }
    }
  } catch {}

  return created.length;
}

async function ensureSpeakingHomeworkForGroup(groupId) {
  const group = await Group.findById(groupId);
  if (!group) return 0;
  return ensureForGroup(group);
}

async function ensureSpeakingHomeworkForTeacher(teacherId) {
  if (!teacherId) return 0;
  const groups = await Group.find({ teacher: teacherId, isActive: true });
  let n = 0;
  for (const g of groups) n += await ensureForGroup(g);
  return n;
}

async function ensureSpeakingHomeworkForAll() {
  const groups = await Group.find({ isActive: true });
  let n = 0;
  for (const g of groups) n += await ensureForGroup(g);
  return n;
}

module.exports = {
  ensureSpeakingHomeworkForGroup,
  ensureSpeakingHomeworkForTeacher,
  ensureSpeakingHomeworkForAll,
};
