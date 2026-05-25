const Settings = require('../models/Settings');
const Student  = require('../models/Student');

// Joriy hafta dushanbasi
function mondayOfThisWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=ya .. 6=sh
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + delta);
  return d;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/**
 * Submission status o'zgarganda Student.gems'ni to'g'rilaydi.
 * - reviewed   bo'lsa: settings'dan kind bo'yicha qiymat olib studentga qo'shiladi
 * - reviewed'dan boshqa: avval berilgani (sub.gemsAwarded) olib qo'yiladi
 *
 * Idempotent — necha marta chaqirilsa ham faqat farq qiladi.
 *
 * @param {Submission} sub — yangilangan submission (saqlangan)
 * @param {{kind?:string}} homework — vazifa (kind: 'lesson' | 'speaking')
 * @returns {{ delta:number, totalGems:number, weekGems:number, studentTgId:string|null, studentName:string|null }}
 */
async function applyGemForSubmission(sub, homework) {
  if (!sub || !sub.student) return { delta:0, totalGems:0, weekGems:0, studentTgId:null, studentName:null };

  const settings = await Settings.getGlobal();
  const kind = (homework?.kind === 'speaking') ? 'speaking' : 'lesson';
  const value = kind === 'speaking' ? (settings.speakingGem || 0) : (settings.lessonGem || 0);

  const prevAwarded = sub.gemsAwarded || 0;
  const nextAwarded = sub.status === 'reviewed' ? value : 0;
  const delta = nextAwarded - prevAwarded;

  if (delta === 0) {
    const st = await Student.findById(sub.student).select('gems gemsThisWeek telegramId name status').lean();
    return {
      delta: 0,
      totalGems: st?.gems || 0,
      weekGems: st?.gemsThisWeek || 0,
      studentTgId: st?.telegramId || null,
      studentName: st?.name || null,
    };
  }

  sub.gemsAwarded = nextAwarded;
  await sub.save();

  // Student'da week tracker'ni yangilash (hafta o'zgargan bo'lsa reset)
  const student = await Student.findById(sub.student).select('gems gemsThisWeek gemsWeekStart telegramId name status');
  if (!student) return { delta:0, totalGems:0, weekGems:0, studentTgId:null, studentName:null };

  const monday = mondayOfThisWeek();
  let weekCur = student.gemsThisWeek || 0;
  if (!student.gemsWeekStart || !sameDay(student.gemsWeekStart, monday)) {
    weekCur = 0; // yangi hafta
    student.gemsWeekStart = monday;
  }

  student.gems         = Math.max(0, (student.gems || 0) + delta);
  student.gemsThisWeek = Math.max(0, weekCur + delta);
  await student.save();

  return {
    delta,
    totalGems: student.gems,
    weekGems: student.gemsThisWeek,
    studentTgId: student.telegramId,
    studentName: student.name,
  };
}

module.exports = { applyGemForSubmission };
