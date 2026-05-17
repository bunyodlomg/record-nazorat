const express  = require('express');
const { body, param, validationResult } = require('express-validator');
const Teacher  = require('../models/Teacher');
const Group    = require('../models/Group');
const User     = require('../models/User');
const { protect, requireRole, requireActive } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendTeacherMessage } = require('../bot/notifications');

const router = express.Router();
const ok = (req,res,next) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ success:false, errors:e.array() });
  next();
};

// LIST   GET /api/teachers?status=active&search=&page=1&limit=20&sort=-score
router.get('/', asyncHandler(async (req,res) => {
  const Homework = require('../models/Homework');
  const { status, search, page=1, limit=20, sort='-score' } = req.query;
  const filter = {};
  if (status && ['active','inactive','suspended'].includes(status)) filter.status = status;
  if (search) filter.$text = { $search: search };

  const skip = (Number(page)-1) * Number(limit);
  const [teachers, total] = await Promise.all([
    Teacher.find(filter).sort(sort).skip(skip).limit(Number(limit)).populate('groups','name code students').lean(),
    Teacher.countDocuments(filter),
  ]);

  const ids = teachers.map(t => t._id);

  const Submission = require('../models/Submission');
  // Parallel: linked Users + per-teacher homework breakdown + per-teacher submission counts + per-group submission status
  const [users, hwAgg, subAgg, subByGroup] = await Promise.all([
    User.find({ teacherRef: { $in: ids } })
      .select('teacherRef telegramUsername telegramId photoUrl email lastSeenAt').lean(),
    Homework.aggregate([
      { $match: { teacher: { $in: ids } } },
      { $group: { _id: { teacher:'$teacher', col:'$col' }, count: { $sum: 1 } } },
    ]),
    Submission.aggregate([
      { $match: { teacher: { $in: ids } } },
      { $group: { _id: { teacher:'$teacher', status:'$status' }, count:{ $sum:1 } } },
    ]),
    Submission.aggregate([
      { $match: { teacher: { $in: ids } } },
      { $group: { _id: { teacher:'$teacher', group:'$group', status:'$status' }, count:{ $sum:1 } } },
    ]),
  ]);

  // Har teacher uchun guruh statistikasi: total / partial (chala = kamida bitta non-reviewed bor)
  const teacherGroupStatus = {}; // teacherId → { groupId → { reviewed, pending } }
  for (const row of subByGroup) {
    const k = String(row._id.teacher);
    const g = String(row._id.group);
    (teacherGroupStatus[k] ||= {});
    (teacherGroupStatus[k][g] ||= { reviewed:0, pending:0 });
    if (row._id.status === 'reviewed') teacherGroupStatus[k][g].reviewed += row.count;
    else                                 teacherGroupStatus[k][g].pending  += row.count;
  }

  const byTeacher = Object.fromEntries(users.map(u => [String(u.teacherRef), u]));

  // hwByTeacher[teacherId] = { pending, checking, done }
  const hwByTeacher = {};
  for (const row of hwAgg) {
    const k = String(row._id.teacher);
    (hwByTeacher[k] ||= { pending:0, checking:0, done:0 })[row._id.col] = row.count;
  }

  // subsByTeacher[teacherId] = { reviewed, pending }  (pending = hammasi reviewed bo'lmagan)
  const subsByTeacher = {};
  for (const row of subAgg) {
    const k = String(row._id.teacher);
    (subsByTeacher[k] ||= { reviewed:0, pending:0 });
    if (row._id.status === 'reviewed') subsByTeacher[k].reviewed += row.count;
    else                                subsByTeacher[k].pending  += row.count;
  }

  // Status hisoblash: tekshirmagan | chala | tekshirilgan | vazifa-yoq
  const calcReviewStatus = (hw) => {
    const p = hw.pending  || 0;
    const c = hw.checking || 0;
    const d = hw.done     || 0;
    if (p + c + d === 0)            return 'no-tasks';
    if (p > 0 && c === 0 && d === 0) return 'unreviewed';
    if (p > 0)                       return 'partial';
    return 'reviewed';
  };

  const ONLINE_MS  = 2  * 60 * 1000;   // 2 daqiqa ichida ko'rilgan = online
  const RECENT_MS  = 15 * 60 * 1000;   // 15 daqiqa ichida = recently
  const now = Date.now();

  const data = teachers.map(t => {
    const u = byTeacher[String(t._id)];
    const hw = hwByTeacher[String(t._id)] || { pending:0, checking:0, done:0 };
    const total = hw.pending + hw.checking + hw.done;
    const completionRate = total > 0 ? Math.round((hw.done / total) * 100) : 0;
    const lastSeenAt = u?.lastSeenAt || null;
    const diff = lastSeenAt ? now - new Date(lastSeenAt).getTime() : Infinity;
    const presence = diff < ONLINE_MS ? 'online' : diff < RECENT_MS ? 'recent' : 'offline';
    return {
      ...t,
      score: completionRate,
      telegramUsername: u?.telegramUsername || null,
      telegramId:       u?.telegramId       || null,
      photoUrl:         u?.photoUrl         || null,
      accountEmail:     u?.email            || null,
      lastSeenAt,
      lastReviewedAt:   t.lastReviewedAt || null,
      presence,
      homework:         { ...hw, total },
      submissions:      subsByTeacher[String(t._id)] || { reviewed:0, pending:0 },
      reviewStatus:     calcReviewStatus(hw),
      groupsStats:      (() => {
        const groupsMap = teacherGroupStatus[String(t._id)] || {};
        const groupIds  = (t.groups || []).map(g => String(g._id || g));
        let partial = 0;
        for (const gid of groupIds) {
          const s = groupsMap[gid];
          if (s && s.pending > 0) partial++;
        }
        return { total: groupIds.length, partial, complete: groupIds.length - partial };
      })(),
    };
  });

  res.json({ success:true, data, pagination:{ total, page:Number(page), limit:Number(limit), pages:Math.ceil(total/Number(limit)) } });
}));

// STATS  GET /api/teachers/stats
router.get('/stats', asyncHandler(async (req,res) => {
  const [agg, top] = await Promise.all([
    Teacher.aggregate([{ $group:{
      _id:null,
      total:{ $sum:1 }, active:{ $sum:{ $cond:[{ $eq:['$status','active']},1,0] }},
      avgScore:{ $avg:'$score' },
    }}]),
    Teacher.find({ status:'active' }).sort('-score').limit(3).select('name subject score hue'),
  ]);
  const Submission = require('../models/Submission');
  const totalUnchecked = await Submission.countDocuments({ status:'submitted' });
  const s = agg[0]||{};
  res.json({ success:true, data:{ total:s.total??0, active:s.active??0, inactive:(s.total??0)-(s.active??0), avgScore:Math.round(s.avgScore??0), totalUnchecked, top } });
}));

// GET ONE  GET /api/teachers/:id
router.get('/:id', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  const Student  = require('../models/Student');
  const Homework = require('../models/Homework');

  const t = await Teacher.findById(req.params.id).lean();
  if (!t) return res.status(404).json({ success:false, message:'Teacher not found' });

  const [linked, groups] = await Promise.all([
    User.findOne({ teacherRef: t._id }).select('telegramUsername telegramId photoUrl email').lean(),
    Group.find({ teacher: t._id }).sort('-isActive name').lean(),
  ]);

  const Submission = require('../models/Submission');
  const groupIds = groups.map(g => g._id);
  const [students, hwAgg, pendingSubs] = await Promise.all([
    Student.find({ group: { $in: groupIds }, status: 'active' })
      .select('name hue group score attendance homeworkRate telegramUsername photoUrl').sort('-score').lean(),
    Homework.aggregate([
      { $match: { teacher: t._id } },
      { $group: { _id:'$col', count:{ $sum:1 } } },
    ]),
    Submission.find({ teacher: t._id, status: { $ne: 'reviewed' } })
      .populate('student', 'name hue photoUrl')
      .populate('homework', 'title dueDate')
      .lean(),
  ]);

  const studentsByGroup = students.reduce((acc, s) => {
    const k = String(s.group);
    (acc[k] ||= []).push(s);
    return acc;
  }, {});

  // Har guruh ichida: tekshirilmagan o'quvchilar bo'yicha aggregate (studentName, count, eng eski dueDate)
  // pendingByGroup[groupId] = Map(studentId => { student, pendingCount, oldestDue, latestHw })
  const pendingByGroup = {};
  for (const sub of pendingSubs) {
    if (!sub.student || !sub.group) continue;
    const gk = String(sub.group);
    const sk = String(sub.student._id);
    (pendingByGroup[gk] ||= new Map());
    const ex = pendingByGroup[gk].get(sk);
    const due = sub.homework?.dueDate ? new Date(sub.homework.dueDate) : null;
    if (ex) {
      ex.pendingCount++;
      if (due && (!ex.oldestDue || due < ex.oldestDue)) {
        ex.oldestDue = due;
        ex.latestHwTitle = sub.homework?.title || ex.latestHwTitle;
      }
    } else {
      pendingByGroup[gk].set(sk, {
        student: sub.student,
        pendingCount: 1,
        oldestDue: due,
        latestHwTitle: sub.homework?.title || '',
      });
    }
  }

  const groupsWithStudents = groups.map(g => {
    const gk = String(g._id);
    const pendingMap = pendingByGroup[gk] || new Map();
    const pendingStudents = Array.from(pendingMap.values())
      .sort((a, b) => b.pendingCount - a.pendingCount)
      .map(p => ({
        _id:          p.student._id,
        name:         p.student.name,
        hue:          p.student.hue ?? 200,
        photoUrl:     p.student.photoUrl || null,
        pendingCount: p.pendingCount,
        latestHwTitle: p.latestHwTitle,
        oldestDue:    p.oldestDue,
      }));
    return {
      ...g,
      students: studentsByGroup[gk] || [],
      studentCount: (studentsByGroup[gk] || []).length,
      pendingStudents,
      pendingCount: pendingStudents.reduce((s, p) => s + p.pendingCount, 0),
      isComplete:   pendingStudents.length === 0,
    };
  });

  const hwCounts = hwAgg.reduce((a,c) => (a[c._id] = c.count, a), {});
  const homework = {
    pending:  hwCounts.pending  || 0,
    checking: hwCounts.checking || 0,
    done:     hwCounts.done     || 0,
    total:    (hwCounts.pending||0)+(hwCounts.checking||0)+(hwCounts.done||0),
  };
  const completionRate = homework.total > 0 ? Math.round((homework.done / homework.total) * 100) : 0;

  // Review status
  let reviewStatus = 'no-tasks';
  if (homework.total > 0) {
    if (homework.pending > 0 && homework.checking === 0 && homework.done === 0) reviewStatus = 'unreviewed';
    else if (homework.pending > 0) reviewStatus = 'partial';
    else reviewStatus = 'reviewed';
  }

  res.json({ success:true, data:{
    ...t,
    score: completionRate,
    telegramUsername: linked?.telegramUsername || null,
    telegramId:       linked?.telegramId       || null,
    photoUrl:         linked?.photoUrl         || null,
    accountEmail:     linked?.email            || null,
    groups: groupsWithStudents,
    homework,
    reviewStatus,
    stats: {
      totalStudents: students.length,
      activeGroups:  groups.filter(g => g.isActive).length,
      totalGroups:   groups.length,
      homework,
    },
  }});
}));

// CREATE  POST /api/teachers
router.post('/',
  [body('name').notEmpty().trim(), body('email').isEmail().normalizeEmail()],
  ok, asyncHandler(async (req,res) => {
    const payload = { ...req.body };
    if (!payload.subject) payload.subject = 'Ingliz tili';
    const t = await Teacher.create(payload);
    res.status(201).json({ success:true, data:t });
  })
);

// UPDATE  PATCH /api/teachers/:id
router.patch('/:id', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  delete req.body._id;
  const t = await Teacher.findByIdAndUpdate(req.params.id, { $set:req.body }, { new:true, runValidators:true });
  if (!t) return res.status(404).json({ success:false, message:'Teacher not found' });
  res.json({ success:true, data:t });
}));

// DELETE  DELETE /api/teachers/:id
router.delete('/:id', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  const t = await Teacher.findByIdAndDelete(req.params.id);
  if (!t) return res.status(404).json({ success:false, message:'Teacher not found' });
  await Group.updateMany({ teacher:req.params.id }, { $unset:{ teacher:1 } });
  res.json({ success:true, message:'Deleted' });
}));

// ACTIVITY  GET /api/teachers/:id/activity
// Real activity log — Homework collection'idan oxirgi hodisalar
router.get('/:id/activity', param('id').isMongoId(), ok, asyncHandler(async (req,res) => {
  const Homework = require('../models/Homework');

  const recent = await Homework.find({ teacher: req.params.id })
    .sort('-updatedAt').limit(8)
    .populate('group', 'name')
    .lean();

  const fmtTime = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return 'hozir';
    if (m < 60)  return `${m} daqiqa oldin`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h} soat oldin`;
    const day = Math.floor(h / 24);
    if (day < 7) return `${day} kun oldin`;
    return new Date(d).toLocaleDateString('uz-UZ');
  };

  const data = recent.map(hw => ({
    time:   fmtTime(hw.updatedAt),
    action: hw.col === 'done'     ? 'Vazifani tekshirdi'
          : hw.col === 'checking' ? 'Vazifa tekshiruvda'
          :                         'Vazifa berdi',
    detail: `${hw.title}${hw.group?.name ? ` · ${hw.group.name}` : ''}`,
    tone:   hw.col === 'done' ? 'success' : 'info',
  }));

  res.json({ success:true, data });
}));

// MESSAGE  POST /api/teachers/:id/message  — admin yozadi, bot teacher'ga yuboradi
router.post('/:id/message',
  protect, requireActive, requireRole('admin'),
  param('id').isMongoId(),
  body('text').isString().trim().isLength({ min:1, max:1500 }),
  body('kind').optional().isIn(['message','praise']),
  ok,
  asyncHandler(async (req, res) => {
    const teacher = await Teacher.findById(req.params.id).select('name');
    if (!teacher) return res.status(404).json({ success:false, message:'Teacher not found' });

    const linked = await User.findOne({ teacherRef: teacher._id }).select('telegramId').lean();
    if (!linked?.telegramId) {
      return res.status(400).json({ success:false, message:"O'qituvchining Telegram akkaunti topilmadi" });
    }

    const sent = await sendTeacherMessage(linked.telegramId, {
      kind:    req.body.kind || 'message',
      text:    req.body.text,
      from:    req.user.name,
    });
    if (!sent) return res.status(502).json({ success:false, message:'Telegram orqali yuborib bo\'lmadi' });

    res.json({ success:true, message:'Yuborildi' });
  })
);

module.exports = router;
