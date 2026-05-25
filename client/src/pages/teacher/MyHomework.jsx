import { useState, useEffect, useMemo } from 'react';
import { Icon } from '../../components/ui.jsx';
import { Spinner, ErrorBox } from '../../components/Feedback.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const TABS = [
  { id:'pending', label:'Topshirilgan',  icon:'clock', tone:'warning' },
  { id:'done',    label:'Baholangan',    icon:'check', tone:'success' },
];
const KINDS = [
  { id:'lesson',   label:'Kunlik vazifalar', icon:'book' },
  { id:'speaking', label:'🎤 Speaking' },
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
  return dt.toLocaleDateString('uz-UZ', { day:'numeric', month:'long' });
}

/* Katta bo'sh karta — vazifa-fokusli dizayn (HomeworkDetail tekshirish UI'dan tubdan farqli).
   Motion yo'q — polling'da miltillamasligi uchun. */
function HomeworkCard({ it, tab, onOpen }) {
  const total    = it.total || 0;
  const reviewed = it.submissions || 0;
  const pending  = Math.max(total - reviewed, 0);
  const ratio    = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  const isDone   = tab === 'done';
  const isSpeak  = it.kind === 'speaking';
  const accent   = isDone ? 'var(--primary)'   : 'var(--amber)';
  const accentL  = isDone ? 'var(--primary-l)' : 'var(--amber)';
  const accentBg = isDone ? 'var(--primary-bg)': 'var(--amber-bg)';

  return (
    <div
      onClick={() => onOpen?.(it)}
      style={{
        padding:'18px 18px 16px',
        marginBottom:12,
        background:'var(--bg-card)',
        borderRadius:16,
        border:'1px solid var(--border)',
        borderLeft: `4px solid ${accent}`,
        cursor:'pointer',
        boxShadow:'var(--shadow-xs)',
      }}>
      {/* Yuqori qator: ikon + title + sana */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:13, marginBottom:16 }}>
        <div style={{
          width:50, height:50, borderRadius:14, flexShrink:0,
          background: accentBg, color: accentL,
          display:'grid', placeItems:'center',
          border:`1px solid ${accent}33`,
          fontSize: isSpeak ? 26 : undefined,
        }}>
          {isSpeak ? '🎤' : <Icon name="book" size={24}/>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{
            fontSize:16, fontWeight:700, marginBottom:4, lineHeight:1.25,
            color:'var(--text)',
            overflow:'hidden', display:'-webkit-box',
            WebkitLineClamp:2, WebkitBoxOrient:'vertical',
          }}>{it.title}</div>
          <div style={{
            fontSize:12, color:'var(--text-3)',
            display:'flex', alignItems:'center', gap:6, flexWrap:'wrap',
          }}>
            {it.group?.name && (
              <span style={{ color:'var(--text-2)', fontWeight:500 }}>{it.group.name}</span>
            )}
            {it.group?.name && <span>·</span>}
            <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
              <Icon name="clock" size={11}/> {formatDueDate(it.dueDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Katta progress lenta */}
      {total > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{
            height:10, borderRadius:6,
            background:'var(--bg-subtle)',
            overflow:'hidden',
            border:'1px solid var(--border)',
          }}>
            <div style={{
              height:'100%', width:`${ratio}%`,
              background: isDone
                ? `linear-gradient(90deg, var(--primary), var(--primary-l))`
                : `linear-gradient(90deg, var(--amber), #fde68a)`,
              borderRadius:5,
              transition:'width 0.4s ease',
            }}/>
          </div>
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            marginTop:8, fontSize:13,
          }}>
            <span style={{ color:'var(--text-2)', fontWeight:500 }}>
              {isDone
                ? <>Hammasi baholandi · <strong style={{ color:accentL }}>{total}/{total}</strong></>
                : <><strong style={{ color:accentL, fontSize:15 }}>{pending}/{total}</strong> qoldi</>}
            </span>
            <span style={{
              color: accentL, fontWeight:700,
              fontFamily:'var(--display)', fontSize:15,
              fontVariantNumeric:'tabular-nums',
            }}>
              {ratio}%
            </span>
          </div>
        </div>
      )}

      {/* Katta tugma */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpen?.(it); }}
        style={{
          width:'100%', padding:'12px 14px',
          borderRadius:12,
          background: isDone
            ? accentBg
            : 'linear-gradient(135deg, var(--primary), var(--primary-d))',
          color: isDone ? accentL : '#fff',
          border: `1px solid ${isDone ? 'var(--border)' : 'transparent'}`,
          fontSize:13.5, fontWeight:600,
          cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          boxShadow: isDone ? 'none' : '0 3px 12px rgba(99,102,241,0.30)',
          transition:'transform 120ms',
        }}
        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
        <Icon name={isDone ? 'eye' : 'chevronRight'} size={14}/>
        {isDone ? "Ko'rib chiqish" : 'Baholash'}
      </button>
    </div>
  );
}

export default function MyHomework({ onOpenHomework }) {
  const { user } = useAuth();
  const teacherId = user?.teacherRef?._id || user?.teacherRef;
  const [kind, setKind] = useState('lesson');
  const [tab, setTab] = useState('pending');
  // "Baholangan" tab uchun sana filter
  const [pickedDate, setPickedDate] = useState(todayKey());

  const { data, loading, error, refetch } = useFetch(
    () => teacherId ? api.homework.list({ teacherId, limit:200 }) : Promise.resolve({ data:[] }),
    [teacherId]
  );

  // Real-time uchun har 10s da silent auto-refresh (loading state'siz, miltillamasdan)
  useEffect(() => {
    const t = setInterval(() => refetch({ silent: true }), 10_000);
    return () => clearInterval(t);
  }, [refetch]);

  const allItems = useMemo(
    () => Array.isArray(data) ? data : (data?.data ?? []),
    [data],
  );

  // Kind bo'yicha bo'lish (default 'lesson' — kind yo'q bo'lsa ham lesson hisoblanadi)
  const items = useMemo(
    () => allItems.filter(i => (i.kind || 'lesson') === kind),
    [allItems, kind]
  );

  const counts = useMemo(() => ({
    pending: items.filter(i => i.col !== 'done').length,
    done:    items.filter(i => i.col === 'done').length,
  }), [items]);

  // Boshqa kind dagi pending count (kind-tab badge uchun)
  const otherKindPending = useMemo(() => {
    const otherKind = kind === 'lesson' ? 'speaking' : 'lesson';
    return allItems.filter(i => (i.kind || 'lesson') === otherKind && i.col !== 'done').length;
  }, [allItems, kind]);

  const tabItems = useMemo(() => {
    return items.filter(i => {
      if (tab === 'pending') return i.col !== 'done';
      if (i.col !== 'done') return false;
      if (!pickedDate) return true;
      return dateKey(i.dueDate) === pickedDate;
    });
  }, [items, tab, pickedDate]);

  const doneDates = useMemo(() => {
    const set = new Set();
    items.forEach(i => { if (i.col === 'done') set.add(dateKey(i.dueDate)); });
    return Array.from(set).sort().reverse();
  }, [items]);

  if (loading) return <div className="page"><Spinner/></div>;
  if (error)   return <div className="page"><ErrorBox message={error} onRetry={refetch}/></div>;

  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <h1 className="page-title">Vazifalar</h1>
          <div className="page-sub">
            {counts.pending > 0
              ? `${counts.pending} ta ${kind === 'speaking' ? 'speaking' : 'kunlik'} vazifa kutmoqda`
              : "Yangi topshiriq yo'q 🎉"}
          </div>
        </div>
      </div>

      {/* Kunlik / Speaking — asosiy tab */}
      <div className="tabs" style={{ marginBottom:10 }}>
        {KINDS.map(k => {
          const isActive = kind === k.id;
          const badge = !isActive ? otherKindPending : 0;
          return (
            <button key={k.id} className={`tab ${isActive?'active':''}`}
              onClick={() => { setKind(k.id); setTab('pending'); }}>
              {k.icon && <Icon name={k.icon} size={12} style={{ marginRight:5, verticalAlign:-1 }}/>}
              {k.label}
              {badge > 0 && (
                <span style={{
                  marginLeft:6, padding:'1px 7px', borderRadius:8,
                  background:'var(--amber-bg)', color:'var(--amber)',
                  fontSize:10.5, fontWeight:700,
                }}>{badge}</span>
              )}
            </button>
          );
        })}
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

      {tab === 'done' && (
        <div style={{
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
            type="button"
            onClick={() => setPickedDate(todayKey())}
            disabled={pickedDate === todayKey()}
            style={{
              padding:'5px 9px', borderRadius:7, fontSize:11.5,
              background: pickedDate === todayKey() ? 'transparent' : 'var(--primary-bg)',
              color: pickedDate === todayKey() ? 'var(--text-3)' : 'var(--primary-l)',
              border:'1px solid var(--border)',
              cursor: pickedDate === todayKey() ? 'default' : 'pointer',
              fontWeight:600,
            }}>
            Bugun
          </button>
          {pickedDate && (
            <button
              type="button"
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
        </div>
      )}

      {tabItems.length === 0 ? (
        <div style={{ padding:'50px 20px', textAlign:'center', color:'var(--text-3)' }}>
          <div style={{ fontSize:36, marginBottom:8 }}>
            {kind === 'speaking' ? (tab === 'pending' ? '🎤' : '🎉') : (tab === 'pending' ? '✅' : '📭')}
          </div>
          <div style={{ fontSize:13.5, color:'var(--text-2)' }}>
            {tab === 'pending'
              ? (kind === 'speaking' ? "Hozircha topshirilgan speaking yo'q" : "Hozircha topshiriq yo'q")
              : (pickedDate
                  ? "Bu kuni baholangan vazifa yo'q"
                  : "Baholangan vazifalar yo'q")}
          </div>
          {tab === 'done' && pickedDate && doneDates.length > 0 && (
            <div style={{ fontSize:11.5, color:'var(--text-3)', marginTop:8 }}>
              Eng yaqin sana: {formatDueDate(doneDates[0])}
            </div>
          )}
        </div>
      ) : (
        <div>
          {tabItems.map(it => (
            <HomeworkCard key={it._id} it={it} tab={tab}
              onOpen={() => onOpenHomework?.(it._id)}/>
          ))}
        </div>
      )}
    </div>
  );
}
