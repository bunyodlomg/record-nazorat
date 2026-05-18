import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '../../components/ui.jsx';
import { Spinner, ErrorBox } from '../../components/Feedback.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const TABS = [
  { id:'pending', label:'Tekshirilmagan', icon:'clock', tone:'warning' },
  { id:'done',    label:'Tekshirilgan',   icon:'check', tone:'success' },
];
const TONE = {
  warning:['var(--amber-bg)','var(--amber)'],
  success:['var(--primary-bg)','var(--primary-l)'],
};

const dateKey = (d) => {
  const x = new Date(d);
  if (isNaN(x)) return '';
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
};
const todayKey = () => dateKey(new Date());

function formatDueDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dt); target.setHours(0,0,0,0);
  const diffDays = Math.round((target - today) / 86400000);
  if (diffDays === 0) return 'Bugun';
  if (diffDays === -1) return 'Kecha';
  if (diffDays === 1) return 'Ertaga';
  if (diffDays < 0) return `${-diffDays} kun oldin`;
  return dt.toLocaleDateString('uz-UZ', { day:'numeric', month:'short' });
}

/* List-style card — HomeworkDetail tekshirish UI'dan butunlay farqli
   (chap tomonda kitob icon, o'ng tomonda progress ring) */
function Card({ it, tab, onOpen }) {
  const total = it.total || 0;
  const reviewed = it.submissions || 0;
  const pending = Math.max(total - reviewed, 0);
  const ratio = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  const isDone = tab === 'done';
  const accent = isDone ? 'var(--primary)' : 'var(--amber)';
  const accentBg = isDone ? 'var(--primary-bg)' : 'var(--amber-bg)';
  const accentLight = isDone ? 'var(--primary-l)' : 'var(--amber)';

  // Progress ring
  const R = 16, C = 2 * Math.PI * R;

  return (
    <motion.div
      layout
      initial={{ opacity:0, y:6 }}
      animate={{ opacity:1, y:0 }}
      exit={{ opacity:0, scale:0.96 }}
      transition={{ type:'spring', stiffness:300, damping:30 }}
      onClick={() => onOpen?.(it)}
      whileTap={{ scale:0.99 }}
      style={{
        display:'flex', alignItems:'center', gap:12,
        padding:'13px 14px', marginBottom:9,
        background:'var(--bg-card)',
        borderRadius:14, border:'1px solid var(--border)',
        borderLeft: `4px solid ${accent}`,
        cursor:'pointer',
        boxShadow:'var(--shadow-xs)',
      }}>
      {/* Kitob ikoni — vazifaga aniq ishora */}
      <div style={{
        width:42, height:42, flexShrink:0, borderRadius:12,
        background: accentBg, color: accentLight,
        display:'grid', placeItems:'center',
        border: `1px solid ${accent}33`,
      }}>
        <Icon name="book" size={20}/>
      </div>

      {/* Kontent */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          fontSize:13.5, fontWeight:600, marginBottom:3, lineHeight:1.3,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{it.title}</div>
        <div style={{
          fontSize:11, color:'var(--text-3)',
          display:'flex', gap:5, alignItems:'center', flexWrap:'wrap',
        }}>
          {it.group?.name && (
            <span style={{ color:'var(--text-2)', fontWeight:500 }}>{it.group.name}</span>
          )}
          <span>·</span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
            <Icon name="clock" size={10}/> {formatDueDate(it.dueDate)}
          </span>
          {total > 0 && (
            <>
              <span>·</span>
              <span>
                <strong style={{ color: accentLight }}>
                  {isDone ? `${total}/${total}` : `${pending}/${total}`}
                </strong>
                <span style={{ marginLeft:3 }}>
                  {isDone ? 'tekshirildi' : 'qoldi'}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Progress ring */}
      <div style={{ position:'relative', width:38, height:38, flexShrink:0 }}>
        <svg width="38" height="38" viewBox="0 0 38 38">
          <circle cx="19" cy="19" r={R} fill="none" stroke="var(--border)" strokeWidth="3"/>
          <circle cx="19" cy="19" r={R} fill="none"
            stroke={accent} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${(ratio/100)*C} ${C}`}
            transform="rotate(-90 19 19)"
            style={{ transition:'stroke-dasharray 0.5s ease' }}/>
        </svg>
        <span style={{
          position:'absolute', inset:0, display:'grid', placeItems:'center',
          fontSize:9.5, fontWeight:700, color: accentLight,
          fontVariantNumeric:'tabular-nums',
        }}>{ratio}%</span>
      </div>
    </motion.div>
  );
}

export default function MyHomework({ onOpenHomework }) {
  const { user } = useAuth();
  const teacherId = user?.teacherRef?._id || user?.teacherRef;
  const [tab, setTab] = useState('pending');
  // "Tekshirilgan" tab uchun sana filter — kechagi va bugungi aralashmasligi uchun
  const [pickedDate, setPickedDate] = useState(todayKey());

  const { data, loading, error, refetch } = useFetch(
    () => teacherId ? api.homework.list({ teacherId, limit:200 }) : Promise.resolve({ data:[] }),
    [teacherId]
  );

  // Real-time uchun har 10s da silent auto-refresh (loading state'siz)
  useEffect(() => {
    const t = setInterval(() => refetch({ silent: true }), 10_000);
    return () => clearInterval(t);
  }, [refetch]);

  if (loading) return <div className="page"><Spinner/></div>;
  if (error)   return <div className="page"><ErrorBox message={error} onRetry={refetch}/></div>;

  const items = Array.isArray(data) ? data : (data?.data ?? []);
  const counts = {
    pending: items.filter(i => i.col !== 'done').length,
    done:    items.filter(i => i.col === 'done').length,
  };

  // Tab + sana filter
  const tabItems = useMemo(() => {
    return items.filter(i => {
      if (tab === 'pending') return i.col !== 'done';
      if (i.col !== 'done') return false;
      // done tab — sana filter
      if (!pickedDate) return true;
      return dateKey(i.dueDate) === pickedDate;
    });
  }, [items, tab, pickedDate]);

  // Tekshirilgan tab uchun ko'rinadigan sanalar (helper)
  const doneDates = useMemo(() => {
    const set = new Set();
    items.forEach(i => { if (i.col === 'done') set.add(dateKey(i.dueDate)); });
    return Array.from(set).sort().reverse();
  }, [items]);

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.32 }}>
      <div className="page-hd">
        <div>
          <h1 className="page-title">Vazifalarim</h1>
          <div className="page-sub">
            {counts.pending > 0
              ? `${counts.pending} ta vazifa tekshirilishi kerak`
              : "Hammasi tekshirildi 🎉"}
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom:12 }}>
        {TABS.map(t => {
          const [bg, color] = TONE[t.tone];
          const isActive = tab === t.id;
          return (
            <button key={t.id} className={`tab ${isActive?'active':''}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={12} style={{ marginRight:5, verticalAlign:-1, color: isActive ? '#fff' : color }}/>
              {t.label}
              {counts[t.id] > 0 && (
                <span style={{
                  marginLeft:6, padding:'1px 7px', borderRadius:8,
                  background: isActive ? 'rgba(255,255,255,0.22)' : bg,
                  color: isActive ? '#fff' : color,
                  fontSize:10.5, fontWeight:700,
                }}>{counts[t.id]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sana filter — faqat "Tekshirilgan" tabda */}
      {tab === 'done' && (
        <motion.div
          initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
          style={{
            display:'flex', alignItems:'center', gap:8, marginBottom:12,
            padding:'10px 12px', background:'var(--bg-subtle)', borderRadius:11,
            border:'1px solid var(--border)', flexWrap:'wrap',
          }}>
          <Icon name="calendar" size={13} color="var(--primary-l)"/>
          <span style={{ fontSize:12, color:'var(--text-2)', fontWeight:500 }}>Sana:</span>
          <input
            type="date"
            value={pickedDate}
            onChange={e => setPickedDate(e.target.value)}
            style={{
              padding:'5px 9px', borderRadius:7,
              background:'var(--bg-card)', border:'1px solid var(--border)',
              color:'var(--text)', fontSize:12, fontFamily:'var(--mono)',
              colorScheme:'dark',
            }}/>
          <button
            onClick={() => setPickedDate(todayKey())}
            disabled={pickedDate === todayKey()}
            style={{
              padding:'5px 9px', borderRadius:7, fontSize:11.5,
              background: pickedDate === todayKey() ? 'transparent' : 'var(--primary-bg)',
              color: pickedDate === todayKey() ? 'var(--text-3)' : 'var(--primary-l)',
              border:'1px solid var(--border)', cursor: pickedDate === todayKey() ? 'default' : 'pointer',
              fontWeight:600,
            }}>
            Bugun
          </button>
          {pickedDate && (
            <button
              onClick={() => setPickedDate('')}
              style={{
                padding:'5px 9px', borderRadius:7, fontSize:11.5,
                background:'transparent', color:'var(--text-3)',
                border:'1px solid var(--border)', cursor:'pointer',
              }}>
              Hammasi
            </button>
          )}
          <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:'auto' }}>
            {tabItems.length} ta vazifa
          </span>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={tab + pickedDate}
          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
          transition={{ duration:0.2 }}>
          {tabItems.length === 0 ? (
            <div style={{ padding:'50px 20px', textAlign:'center', color:'var(--text-3)' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>{tab === 'pending' ? '✅' : '📭'}</div>
              <div style={{ fontSize:13.5, color:'var(--text-2)' }}>
                {tab === 'pending'
                  ? "Tekshirilmagan vazifa yo'q"
                  : (pickedDate
                      ? "Bu kuni tekshirilgan vazifa yo'q"
                      : "Tugatilgan vazifalar yo'q")}
              </div>
              {tab === 'done' && pickedDate && doneDates.length > 0 && (
                <div style={{ fontSize:11.5, color:'var(--text-3)', marginTop:8 }}>
                  Eng yaqin sana: {formatDueDate(doneDates[0])}
                </div>
              )}
            </div>
          ) : (
            <AnimatePresence>
              {tabItems.map(it => (
                <Card key={it._id} it={it} tab={tab}
                  onOpen={() => onOpenHomework?.(it._id)}/>
              ))}
            </AnimatePresence>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
