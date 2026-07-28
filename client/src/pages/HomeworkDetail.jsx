import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '../components/ui.jsx';
import { Spinner, ErrorBox } from '../components/Feedback.jsx';
import { StudentRow } from '../components/SubmissionsModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useStickyState } from '../hooks/useStickyState.js';
import { sfx } from '../hooks/useSound.js';
import api from '../services/api.js';

const TABS = [
  { id:'pending',  label:'Kutilmoqda',  icon:'clock', tone:'warning' },
  { id:'reviewed', label:'Belgilangan', icon:'check', tone:'success' },
];
const TONE = {
  warning:['var(--amber-bg)','var(--amber)'],
  success:['var(--primary-bg)','var(--primary-l)'],
};

function formatLessonDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dt); target.setHours(0,0,0,0);
  const diffDays = Math.round((target - today) / 86400000);
  if (diffDays === 0) return 'Bugun';
  if (diffDays === -1) return 'Kecha';
  if (diffDays === 1) return 'Ertaga';
  if (diffDays < 0)  return `${-diffDays} kun oldin`;
  return dt.toLocaleDateString('uz-UZ', { day:'numeric', month:'long' });
}

export default function HomeworkDetailPage({ homeworkId, onBack }) {
  const { user } = useAuth();
  const isAdmin   = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const myTeacherId = user?.teacherRef?._id || user?.teacherRef;

  const [hw, setHw]             = useState(null);
  const [subs, setSubs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [tab, setTab]           = useStickyState(`hw:${homeworkId}:tab`, 'pending');
  const [search, setSearch]     = useState('');
  const [busy, setBusy]         = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [hwRes, subsRes] = await Promise.all([
        api.homework.get(homeworkId),
        api.homework.submissions(homeworkId),
      ]);
      setHw(hwRes?.data || hwRes);
      setSubs(subsRes?.data || subsRes || []);
    } catch (e) {
      setError(e.message || 'Yuklashda xatolik');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (homeworkId) load(); /* eslint-disable-next-line */ }, [homeworkId]);

  const hwTeacherId = hw?.teacher?._id || hw?.teacher;
  const canEdit = isAdmin || (isTeacher && String(myTeacherId) === String(hwTeacherId));

  const update = async (id, data) => {
    setBusy(true);
    try {
      await api.submissions.update(id, data);
      await load();
    } finally { setBusy(false); }
  };

  const clearSelect = () => setSelectedIds(new Set());

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    sfx.click?.();
  };

  const bulkApply = async (status) => {
    const ids = [...selectedIds];
    if (ids.length === 0 || busy) return;
    setBusy(true);
    try {
      await api.submissions.bulk(ids, status);
      status === 'returned' ? sfx.error?.() : sfx.success?.();
      await load();
      clearSelect();
    } finally { setBusy(false); }
  };

  // 2-holat: reviewed | pending (qolgan hamma)
  const counts = useMemo(() => {
    let reviewed = 0, pending = 0;
    for (const s of subs) {
      if (s.status === 'reviewed') reviewed++;
      else pending++;
    }
    return { reviewed, pending };
  }, [subs]);

  const filtered = useMemo(() => {
    let list = subs.filter(s =>
      tab === 'reviewed' ? s.status === 'reviewed' : s.status !== 'reviewed',
    );
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s => (s.student?.name || '').toLowerCase().includes(q));
    }
    return list;
  }, [subs, tab, search]);

  if (loading) return <div className="page"><Spinner/></div>;
  if (error)   return <div className="page"><ErrorBox message={error} onRetry={load}/></div>;
  if (!hw)     return null;

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.28 }}>

      {/* Sodda hero — back + title */}
      <div className="page-hd" style={{ marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, minWidth:0, flex:1 }}>
          <button className="btn btn-ghost btn-icon"
            onClick={onBack} title="Ortga"
            style={{ flexShrink:0 }}>
            <Icon name="chevronLeft" size={14}/>
          </button>
          <div style={{ minWidth:0, flex:1 }}>
            <h1 className="page-title" style={{ fontSize:20, lineHeight:1.2, marginBottom:3 }}>
              {hw.title}
            </h1>
            <div style={{ fontSize:12, color:'var(--text-2)' }}>
              {hw.group?.name || ''}
              {hw.group?.code && <span style={{ color:'var(--text-3)' }}> · {hw.group.code}</span>}
              {hw.dueDate && <> · <span>{formatLessonDate(hw.dueDate)}</span></>}
            </div>
          </div>
        </div>
      </div>

      {/* 2 ta tab */}
      <div className="tabs" style={{ marginBottom:12 }}>
        {TABS.map(t => {
          const [bg, color] = TONE[t.tone];
          const isActive = tab === t.id;
          const n = t.id === 'reviewed' ? counts.reviewed : counts.pending;
          return (
            <button key={t.id} className={`tab ${isActive?'active':''}`} onClick={() => { setTab(t.id); clearSelect(); }}>
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

      {/* Umumiy hisob + hammasini tanlash */}
      {canEdit && subs.length > 0 && (
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
          padding:'8px 10px 8px 13px', marginBottom:9,
          background:'var(--bg-subtle)', borderRadius:12,
          border:'1px solid var(--border)',
          fontSize:12.5, color:'var(--text-2)',
        }}>
          <span>{counts.reviewed} / {subs.length} belgilandi</span>
          {filtered.length > 0 && (
            <button className="btn btn-ghost" style={{ height:30, fontSize:12 }}
              onClick={() => {
                const allSel = filtered.every(s => selectedIds.has(s._id));
                setSelectedIds(allSel ? new Set() : new Set(filtered.map(s => s._id)));
              }}>
              {filtered.every(s => selectedIds.has(s._id))
                ? 'Tanlovni bekor qilish'
                : `Hammasini tanlash (${filtered.length})`}
            </button>
          )}
        </div>
      )}

      {/* Qidiruv — faqat 5+ student bo'lsa */}
      {subs.length > 5 && (
        <div className="sw" style={{ marginBottom:10 }}>
          <Icon name="search" size={13} color="var(--text-3)"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="O'quvchi qidirish..."/>
        </div>
      )}

      {/* O'quvchilar ro'yxati */}
      {!canEdit && (
        <div style={{ padding:'10px 12px', marginBottom:10, fontSize:12, color:'var(--text-3)',
          background:'var(--amber-bg)', borderRadius:9, border:'1px solid var(--amber)',
        }}>
          Sizning vazifangiz emas — tahrirlash mumkin emas.
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ padding:'40px 0', textAlign:'center', color:'var(--text-3)' }}>
          <div style={{ fontSize:32, marginBottom:6 }}>
            {tab === 'reviewed' ? '📭' : '✅'}
          </div>
          <div style={{ fontSize:13, color:'var(--text-2)' }}>
            {search
              ? "Topilmadi"
              : tab === 'reviewed'
                ? "Hali belgilangan o'quvchi yo'q"
                : "Hamma o'quvchi belgilangan 🎉"}
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
          style={{ display:'flex', flexDirection:'column', gap:7 }}>
          <AnimatePresence initial={false}>
            {filtered.map(sub => (
              <StudentRow key={sub._id} sub={sub} onUpdate={update} canEdit={canEdit} busy={busy}
                selectMode selected={selectedIds.has(sub._id)} onSelectToggle={toggleSelect}/>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Tanlangan o'quvchilar — pastdagi saqlash paneli */}
      <AnimatePresence>
        {canEdit && selectedIds.size > 0 && (
          <motion.div
            initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:80, opacity:0 }}
            transition={{ duration:0.22, ease:[0.22,1,0.36,1] }}
            style={{
              position:'sticky', bottom:12, zIndex:20,
              marginTop:12, display:'flex', alignItems:'center', gap:8,
              padding:'10px 12px', borderRadius:14,
              background:'var(--bg-card)', border:'1px solid var(--border-md)',
              boxShadow:'0 8px 30px rgba(0,0,0,0.18)',
            }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', flexShrink:0 }}>
              {selectedIds.size} tanlandi
            </span>
            <div style={{ flex:1 }}/>
            <button className="btn btn-ghost" disabled={busy}
              style={{ color:'var(--rose)' }}
              onClick={() => bulkApply('returned')}>
              <Icon name="alert" size={13} style={{ marginRight:5, verticalAlign:-2 }}/>
              Qaytarish
            </button>
            <button className="btn btn-primary" disabled={busy}
              onClick={() => bulkApply('reviewed')}>
              <Icon name="check" size={13} style={{ marginRight:5, verticalAlign:-2 }}/>
              {busy ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
