import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CAN_HOVER } from '../utils/device.js';
import { Icon, Avatar } from '../components/ui.jsx';
import { Spinner, ErrorBox, listContainer, listItem } from '../components/Feedback.jsx';
import PageHero from '../components/PageHero.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useStickyState } from '../hooks/useStickyState.js';
import api from '../services/api.js';

const TABS = [
  { id:'pending', label:'Kutilmoqda',  icon:'clock', tone:'warning' },
  { id:'done',    label:'Belgilangan', icon:'check', tone:'success' },
];
const TONE = {
  warning:['var(--amber-bg)','var(--amber)'],
  success:['var(--primary-bg)','var(--primary-l)'],
};

export function TeacherRow({ t, tab, onOpenTeacher }) {
  const subs = t.submissions || { reviewed:0, pending:0 };
  const total = subs.reviewed + subs.pending;
  const pct = total > 0 ? Math.round((subs.reviewed / total) * 100) : 0;
  const focus = tab === 'pending' ? subs.pending : subs.reviewed;
  const focusColor = tab === 'pending' ? 'var(--amber)' : 'var(--primary-l)';
  const focusBg    = tab === 'pending' ? 'var(--amber-bg)' : 'var(--primary-bg)';
  const gs = t.groupsStats || { total:0, partial:0, complete:0 };

  return (
    <motion.button
      variants={listItem}
      whileHover={!CAN_HOVER ? undefined : { y:-2 }}
      whileTap={{ scale:0.99 }}
      onClick={() => onOpenTeacher(t._id)}
      className="card card-hov"
      style={{
        padding:'12px 13px',
        display:'flex', alignItems:'center', gap:11,
        textAlign:'left', width:'100%', cursor:'pointer',
        marginBottom:9,
      }}>
      <div style={{ position:'relative', flexShrink:0 }}>
        <Avatar name={t.name} hue={t.hue} size="sm" photoUrl={t.photoUrl}/>
        {t.presence === 'online' && (
          <span style={{
            position:'absolute', bottom:-1, right:-1, width:10, height:10, borderRadius:'50%',
            background:'#10b981', border:'2px solid var(--bg-card)',
          }}/>
        )}
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {t.name}
        </div>
        <div style={{ fontSize:11.5, color:'var(--text-3)', marginTop:2, display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
          {gs.total > 0 ? (
            <>
              <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                <Icon name="groups" size={10}/>
                <strong style={{ color:'var(--text-2)' }}>{gs.total}</strong> guruh
              </span>
              {gs.partial > 0 && (
                <span style={{ color:'var(--amber)', fontWeight:600 }}>· {gs.partial} chala</span>
              )}
              {gs.complete > 0 && gs.partial === 0 && (
                <span style={{ color:'var(--primary-l)', fontWeight:600 }}>· hammasi to'liq</span>
              )}
            </>
          ) : (
            <span>Guruh yo'q</span>
          )}
          {total > 0 && <span style={{ color:'var(--text-3)' }}>· {subs.reviewed}/{total}</span>}
        </div>
        {total > 0 && (
          <div className="prog" style={{ height:4, marginTop:6 }}>
            <div className="prog-fill"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? 'var(--primary)' : 'var(--amber)',
              }}/>
          </div>
        )}
      </div>

      <span style={{
        background: focus > 0 ? focusBg : 'var(--bg-subtle)',
        color: focus > 0 ? focusColor : 'var(--text-3)',
        fontSize:13, fontWeight:700, padding:'5px 11px', borderRadius:9,
        flexShrink:0, minWidth:44, textAlign:'center',
      }}>
        {focus}
      </span>

      <Icon name="chevronRight" size={13} color="var(--text-3)" style={{ flexShrink:0 }}/>
    </motion.button>
  );
}

export default function HomeworkPage({ onOpenHomework, onOpenTeacher }) {
  const [tab, setTab] = useStickyState('homework-page:tab', 'pending');

  const { data, loading, error, refetch } = useFetch(() => api.teachers.list({ limit:200 }));

  // Real-time uchun 12s poll
  useEffect(() => {
    const t = setInterval(() => refetch({ silent: true }), 12_000);
    return () => clearInterval(t);
  }, [refetch]);

  const teachers = useMemo(() => {
    const list = Array.isArray(data) ? data : (data?.data ?? []);
    return list.filter(t => t.status === 'active');
  }, [data]);

  const totals = useMemo(() => {
    let pending = 0, reviewed = 0;
    for (const t of teachers) {
      const s = t.submissions || {};
      pending  += s.pending  || 0;
      reviewed += s.reviewed || 0;
    }
    return { pending, reviewed };
  }, [teachers]);

  // Sort: tab=pending → ko'p kutmoqdalar yuqorida
  //       tab=done → ko'p belgilanganlar yuqorida
  const sorted = useMemo(() => {
    const list = [...teachers];
    if (tab === 'pending') {
      list.sort((a, b) => (b.submissions?.pending || 0) - (a.submissions?.pending || 0));
    } else {
      list.sort((a, b) => (b.submissions?.reviewed || 0) - (a.submissions?.reviewed || 0));
    }
    return list;
  }, [teachers, tab]);

  // Tab uchun filter: pending tab — faqat pending > 0; done tab — hammasi
  const filtered = useMemo(() => {
    if (tab === 'pending') return sorted.filter(t => (t.submissions?.pending || 0) > 0);
    return sorted.filter(t => (t.submissions?.reviewed || 0) > 0);
  }, [sorted, tab]);

  if (loading) return <div className="page"><Spinner/></div>;
  if (error)   return <div className="page"><ErrorBox message={error} onRetry={refetch}/></div>;

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.32 }}>
      <PageHero
        title="Vazifalar"
        subtitle={totals.pending > 0
          ? `${totals.pending} ta tekshiruv kutmoqda`
          : 'Hammasi belgilangan — ajoyib!'}
        emoji="📚"
        stats={[
          { value: totals.pending,                  label:'Kutilmoqda',   icon:'clock',    bg:'var(--amber-bg)',       color:'var(--amber)' },
          { value: totals.reviewed,                 label:'Belgilangan',  icon:'check',    bg:'var(--primary-bg)',     color:'var(--primary)' },
          { value: teachers.length,                 label:"O'qituvchilar",icon:'teachers', bg:'rgba(16,185,129,0.14)', color:'#059669' },
          { value: totals.pending + totals.reviewed,label:'Jami',         icon:'homework', bg:'var(--accent-bg)',      color:'var(--accent)' },
        ]}
      />

      <div className="tabs" style={{ marginBottom:14 }}>
        {TABS.map(t => {
          const [bg, color] = TONE[t.tone];
          const isActive = tab === t.id;
          const n = t.id === 'pending' ? totals.pending : totals.reviewed;
          return (
            <button key={t.id} className={`tab ${isActive?'active':''}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={12} style={{ marginRight:5, verticalAlign:-1, color: isActive ? '#fff' : color }}/>
              {t.label}
              {n > 0 && (
                <span style={{
                  marginLeft:6, padding:'1px 7px', borderRadius:8,
                  background: isActive ? 'rgba(255,255,255,0.22)' : bg,
                  color: isActive ? '#fff' : color,
                  fontSize:10.5, fontWeight:700,
                }}>{n}</span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
          transition={{ duration:0.2 }}>
          {filtered.length === 0 ? (
            <div style={{ padding:'50px 20px', textAlign:'center', color:'var(--text-3)' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>
                {tab === 'pending' ? '✅' : '📭'}
              </div>
              <div style={{ fontSize:13.5, color:'var(--text-2)' }}>
                {tab === 'pending'
                  ? "Hamma o'qituvchi belgilab bo'lgan 🎉"
                  : "Hali belgilangan vazifa yo'q"}
              </div>
            </div>
          ) : (
            <motion.div variants={listContainer} initial="hidden" animate="show">
              {filtered.map(t => (
                <TeacherRow key={t._id} t={t} tab={tab}
                  onOpenTeacher={onOpenTeacher || (() => {})}/>
              ))}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
