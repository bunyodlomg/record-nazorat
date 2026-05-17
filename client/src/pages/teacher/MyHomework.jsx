import { useState, useEffect } from 'react';
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

function Card({ it, tab, onOpen }) {
  const pending = Math.max((it.total || 0) - (it.submissions || 0), 0);
  return (
    <motion.div className="card"
      layout
      initial={{ opacity:0, y:6 }}
      animate={{ opacity:1, y:0 }}
      exit={{ opacity:0, scale:0.95 }}
      transition={{ type:'spring', stiffness:300, damping:30 }}
      onClick={() => onOpen?.(it)}
      style={{ padding:13, marginBottom:9, cursor:'pointer' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6, flexWrap:'wrap' }}>
        {it.group?.code && (
          <span style={{ fontSize:10.5, fontFamily:'var(--mono)', color:'var(--text-2)', background:'var(--bg-subtle)', padding:'2px 7px', borderRadius:5 }}>
            {it.group.code}
          </span>
        )}
        {it.group?.name && (
          <span style={{ fontSize:11.5, color:'var(--text-2)', fontWeight:500 }}>{it.group.name}</span>
        )}
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-3)', display:'inline-flex', alignItems:'center', gap:3 }}>
          <Icon name="clock" size={11}/> {formatDueDate(it.dueDate)}
        </span>
      </div>

      <div style={{ fontSize:13.5, fontWeight:600, marginBottom:9, lineHeight:1.35 }}>{it.title}</div>

      {/* Progress bar */}
      {it.total > 0 && (
        <div style={{ marginBottom:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5, fontSize:11.5 }}>
            <span style={{ color:'var(--text-2)' }}>
              {tab === 'done'
                ? <>Hamma o'quvchi tekshirildi · <strong style={{ color:'var(--primary-l)' }}>{it.total}/{it.total}</strong></>
                : <>Tekshirilmagan: <strong style={{ color:'var(--amber)' }}>{pending}</strong> <span style={{ color:'var(--text-3)' }}>· tekshirilgan {it.submissions || 0}/{it.total}</span></>}
            </span>
            {it.avgScore != null && tab === 'done' && (
              <span style={{ fontSize:11, color:'var(--primary-l)', fontWeight:600 }}>Ø {it.avgScore}%</span>
            )}
          </div>
          <div className="prog" style={{ height:5 }}>
            <div className={`prog-fill ${tab === 'done' ? '' : 'accent'}`}
              style={{
                width:`${it.total > 0 ? Math.round(((it.submissions || 0) / it.total) * 100) : 0}%`,
                background: tab === 'done' ? 'var(--primary)' : 'var(--amber)',
              }}/>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function MyHomework({ onOpenHomework }) {
  const { user } = useAuth();
  const teacherId = user?.teacherRef?._id || user?.teacherRef;
  const [tab, setTab] = useState('pending');

  const { data, loading, error, refetch } = useFetch(
    () => teacherId ? api.homework.list({ teacherId, limit:200 }) : Promise.resolve({ data:[] }),
    [teacherId]
  );

  // Real-time uchun har 10s da auto-refresh
  useEffect(() => {
    const t = setInterval(() => refetch(), 10_000);
    return () => clearInterval(t);
  }, [refetch]);

  if (loading) return <div className="page"><Spinner/></div>;
  if (error)   return <div className="page"><ErrorBox message={error} onRetry={refetch}/></div>;

  const items = Array.isArray(data) ? data : (data?.data ?? []);
  // 2 holat: tekshirilmagan (col !== 'done') | tekshirilgan (col === 'done')
  const counts = {
    pending: items.filter(i => i.col !== 'done').length,
    done:    items.filter(i => i.col === 'done').length,
  };
  const tabItems = items.filter(i =>
    tab === 'pending' ? i.col !== 'done' : i.col === 'done',
  );

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

      <div className="tabs" style={{ marginBottom:14 }}>
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

      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
          transition={{ duration:0.2 }}>
          {tabItems.length === 0 ? (
            <div style={{ padding:'50px 20px', textAlign:'center', color:'var(--text-3)' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>{tab === 'pending' ? '✅' : '📭'}</div>
              <div style={{ fontSize:13.5, color:'var(--text-2)' }}>
                {tab === 'pending'
                  ? "Tekshirilmagan vazifa yo'q"
                  : "Tugatilgan vazifalar yo'q"}
              </div>
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
