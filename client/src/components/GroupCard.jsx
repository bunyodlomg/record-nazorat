import { motion } from 'framer-motion';
import { Icon } from './ui.jsx';
import { listItem } from './Feedback.jsx';

const GROUP_GRADS = [
  'linear-gradient(165deg,#60a5fa,#4f46e5)', // G1 — blue→indigo
  'linear-gradient(165deg,#a78bfa,#7c3aed)', // G2 — violet
  'linear-gradient(165deg,#34d399,#059669)', // G3 — emerald
  'linear-gradient(165deg,#fbbf24,#f59e0b)', // G4 — amber
  'linear-gradient(165deg,#fb7185,#e11d48)', // G5 — rose
  'linear-gradient(165deg,#38bdf8,#0891b2)', // G6 — cyan
];

const DAYS = { mon:'Du', tue:'Se', wed:'Ch', thu:'Pa', fri:'Ju', sat:'Sh', sun:'Ya' };
export const groupDayLabels = (days = []) => (days || []).map(d => DAYS[d]).filter(Boolean).join(' · ');

/* badge raqami — avval guruh NOMIDAGI raqamdan (masalan "IELTS GROUP 11" → 11),
   bo'lmasa avto-koddan ("Iyun-G9" → 9). sub = oy (koddan). */
function codeParts(code = '', name = '') {
  const s = String(code || '');
  const nameNum = String(name || '').match(/(\d+)(?!.*\d)/); // nomdagi oxirgi raqam
  const codeM   = s.match(/G\s*(\d+)/i);
  const num = nameNum ? parseInt(nameNum[1], 10) : (codeM ? parseInt(codeM[1], 10) : 0);
  const big = num ? `G${num}` : (s.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'GR');
  const sub = s.replace(/-?G\s*\d+/i, '').replace(/[-_]+/g, ' ').trim().toUpperCase();
  return { num, big, sub };
}

/**
 * Yagona guruh kartasi — admin va o'qituvchi panellari uchun.
 * @param onEdit/onRemove — berilsa, mos amal tugmalari ko'rinadi
 * @param showTeacher     — mas'ul o'qituvchi qatorini ko'rsatish (admin: true)
 */
export default function GroupCard({ g, onOpenGroup, onOpenTeacher, onEdit, onRemove, showTeacher = true }) {
  const { num, big, sub } = codeParts(g.code, g.name);
  const grad = GROUP_GRADS[((num || 1) - 1) % GROUP_GRADS.length];
  const days = groupDayLabels(g.scheduleDays);
  const active = g.isActive !== false;
  const studentCount = typeof g.studentCount === 'number'
    ? g.studentCount
    : (Array.isArray(g.students) ? g.students.length : 0);

  return (
    <motion.div className="gcard card card-hov" variants={listItem}
      whileHover={{ y:-3 }}
      onClick={() => onOpenGroup?.(g._id)}
      style={{ cursor: onOpenGroup ? 'pointer' : 'default' }}>

      <div className="gcard-side" style={{ background:grad }}>
        <span className="gcard-star"><Icon name="star" size={12}/></span>
        <div className="gcard-code">{big}</div>
        {sub && <div className="gcard-codesub">{sub}</div>}
      </div>

      <div className="gcard-main">
        <div className="gcard-r1">
          <div className="gcard-name">{g.name}</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }} onClick={e => e.stopPropagation()}>
            <span className={`chip ${active ? 'chip-success' : 'chip-neutral'}`}>
              <span style={{ width:6, height:6, borderRadius:'50%', background: active ? '#34d399' : 'var(--text-3)', display:'inline-block' }}/>
              {active ? 'Faol' : 'Yopilgan'}
            </span>
            {onEdit && (
              <button className="btn btn-ghost btn-icon" style={{ width:28, height:28 }} onClick={() => onEdit(g)} title="Tahrirlash"><Icon name="settings" size={13}/></button>
            )}
            {onRemove && (
              <button className="btn btn-ghost btn-icon" style={{ width:28, height:28, color:'var(--rose)' }} onClick={() => onRemove(g)} title="O'chirish"><Icon name="trash" size={13}/></button>
            )}
          </div>
        </div>

        {showTeacher && g.teacher && (
          <button className="gcard-meta"
            onClick={e => { e.stopPropagation(); onOpenTeacher?.(g.teacher._id); }}
            style={{ background:'transparent', padding:0, cursor: onOpenTeacher ? 'pointer' : 'default' }}>
            <Icon name="teachers" size={13} color="var(--text-3)"/>
            <span className="txt">{g.teacher?.name || "Mas'ul biriktirilmagan"}</span>
          </button>
        )}

        {days && (
          <div className="gcard-meta">
            <Icon name="calendar" size={13} color="var(--text-3)"/>
            <span className="txt">{days}{g.scheduleTime ? ` · ${g.scheduleTime}` : ''}</span>
          </div>
        )}

        <div className="gcard-foot">
          <span className="gcard-foot-lbl"><Icon name="user" size={13} color="var(--text-3)"/> O'quvchilar</span>
          <span className="gcard-count">{studentCount}</span>
          <div style={{ flex:1 }}/>
          {g.topStudent ? (
            <span className="chip chip-accent" title={`Eng ko'p olmos: ${g.topStudent.name}`}>
              🏆 {g.topStudent.gems}
            </span>
          ) : g.totalGems > 0 ? (
            <span className="chip chip-accent"><Icon name="gem" size={11}/> {g.totalGems}</span>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
