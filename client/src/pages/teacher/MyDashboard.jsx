import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Icon, useCountUp, ChartTooltip } from '../../components/ui.jsx';
import { Spinner, ErrorBox, listContainer, listItem } from '../../components/Feedback.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const LVL_CHIP = {
  A1:'chip-neutral', A2:'chip-neutral', B1:'chip-info', B2:'chip-info',
  C1:'chip-accent', C2:'chip-success',
  Beginner:'chip-neutral', Intermediate:'chip-info', Advanced:'chip-accent', Olympiad:'chip-success',
};
const DAYS  = { mon:'Du', tue:'Se', wed:'Ch', thu:'Pa', fri:'Ju', sat:'Sh', sun:'Ya' };
const WDAYS = ['Ya','Du','Se','Ch','Pa','Ju','Sh'];
const dayLabels = (days = []) => days.map(d => DAYS[d]).filter(Boolean).join(' · ');

function StatTile({ label, value, icon, tone = 'primary' }) {
  const v = useCountUp(Number.isFinite(+value) ? +value : 0);
  const colors = {
    primary: ['var(--primary-bg)', 'var(--primary-l)'],
    amber:   ['var(--amber-bg)',   'var(--amber)'],
  }[tone] || ['var(--bg-subtle)', 'var(--text)'];
  return (
    <motion.div
      variants={listItem}
      whileHover={{ y:-2 }}
      transition={{ type:'spring', stiffness:300 }}
      className="card"
      style={{ padding:'12px 13px', display:'flex', alignItems:'center', gap:11, overflow:'hidden' }}>
      <div style={{
        width:36, height:36, borderRadius:10, background:colors[0], color:colors[1],
        display:'grid', placeItems:'center', flexShrink:0,
      }}>
        <Icon name={icon} size={16}/>
      </div>
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ fontSize:10.5, fontWeight:600, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:1 }}>
          {label}
        </div>
        <div style={{ fontFamily:'var(--display)', fontSize:22, fontWeight:700, letterSpacing:'-0.02em', lineHeight:1.05, color:colors[1] }}>
          {v}
        </div>
      </div>
    </motion.div>
  );
}

function buildWeeklyTrend(hw) {
  // Oxirgi 7 kun: har kun uchun nechta vazifa kelgan (createdAt bo'yicha)
  const today = new Date();
  today.setHours(0,0,0,0);
  const buckets = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets.push({ day:WDAYS[d.getDay()], date:d.getTime(), v:0 });
  }
  for (const h of hw) {
    if (!h.createdAt) continue;
    const ts = new Date(h.createdAt);
    ts.setHours(0,0,0,0);
    const t = ts.getTime();
    const bucket = buckets.find(b => b.date === t);
    if (bucket) bucket.v += 1;
  }
  return buckets;
}

export default function MyDashboard({ onNav }) {
  const { user } = useAuth();
  const teacherId = user?.teacherRef?._id || user?.teacherRef;

  const { data: t, loading, error, refetch } = useFetch(
    () => teacherId ? api.teachers.get(teacherId) : Promise.resolve({ data:null }),
    [teacherId],
  );
  const { data: hwData } = useFetch(
    () => teacherId ? api.homework.list({ teacherId, limit:100 }) : Promise.resolve({ data:[] }),
    [teacherId],
  );

  const hw = useMemo(() => Array.isArray(hwData) ? hwData : (hwData?.data ?? []), [hwData]);
  const trend = useMemo(() => buildWeeklyTrend(hw), [hw]);
  const trendTotal = useMemo(() => trend.reduce((s, b) => s + b.v, 0), [trend]);

  if (loading) return <div className="page"><Spinner/></div>;
  if (error)   return <div className="page"><ErrorBox message={error} onRetry={refetch}/></div>;
  if (!t)      return <div className="page"><div style={{ padding:40, textAlign:'center', color:'var(--text-2)' }}>Profil bog'lanmagan</div></div>;

  const pendingCount  = hw.filter(h => h.col === 'pending').length;
  const checkingCount = hw.filter(h => h.col === 'checking').length;
  const doneCount     = hw.filter(h => h.col === 'done').length;
  const firstName = (t.name || '').trim().split(/\s+/)[0] || 'Ustoz';
  const groupsList = Array.isArray(t.groups) ? t.groups : [];

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.32 }}>

      {/* Welcome hero */}
      <motion.div
        initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.04 }}
        style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <span style={{ fontSize:13, color:'var(--text-2)' }}>Salom,</span>
          <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{firstName}</span>
          <span style={{ fontSize:17 }}>👋</span>
        </div>
        <h1 className="page-title">
          {pendingCount > 0
            ? <><span style={{ color:'var(--primary-l)' }}>{pendingCount} ta vazifa</span> topshirilgan</>
            : <>Bugun hammasi joyida</>}
        </h1>
        <div className="page-sub" style={{ fontSize:13, marginTop:4 }}>
          {t.subject || 'Ingliz tili'} · {groupsList.length} ta guruh
        </div>
      </motion.div>

      {/* 2 ta ixcham stat tile */}
      <motion.div variants={listContainer} initial="hidden" animate="show"
        className="my-stat-grid"
        style={{ gridTemplateColumns:'repeat(2, 1fr)', gap:10, marginBottom:12 }}>
        <StatTile label="Topshirilgan" value={pendingCount} icon="clock" tone="amber"/>
        <StatTile label="Belgilangan"          value={doneCount}    icon="check" tone="primary"/>
      </motion.div>

      {/* Chart — alohida qator */}
      <motion.div className="card" style={{ marginBottom:12, overflow:'hidden' }}
        initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.14 }}>
        <div className="card-head" style={{ padding:'12px 14px 6px' }}>
          <div>
            <div className="card-title" style={{ fontSize:13.5 }}>Vazifalar oqimi</div>
            <div className="card-sub" style={{ fontSize:11.5 }}>So'nggi 7 kun · {trendTotal} ta yangi</div>
          </div>
          {checkingCount > 0 && (
            <span className="chip chip-info" style={{ fontSize:10.5 }}>{checkingCount} jarayonda</span>
          )}
        </div>
        <div style={{ padding:'4px 6px 8px', height:120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top:6, right:10, left:0, bottom:0 }}>
              <defs>
                <linearGradient id="myFlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false}/>
              <XAxis dataKey="day" tick={{ fontSize:10.5, fill:'var(--text-2)' }} axisLine={false} tickLine={false}/>
              <YAxis hide allowDecimals={false}/>
              <Tooltip content={<ChartTooltip/>}/>
              <Area type="monotone" dataKey="v" name="Yangi vazifalar"
                stroke="#6366f1" strokeWidth={2} fill="url(#myFlow)"
                dot={{ r:2.5, fill:'var(--bg-card-s)', stroke:'#6366f1', strokeWidth:1.5 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Quick actions */}
      <motion.div className="card" style={{ padding:'10px 10px' }}
        initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}>
        <div style={{ fontSize:10.5, fontWeight:600, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'0.05em', padding:'4px 6px 8px' }}>
          Tezkor amallar
        </div>
        {[
          pendingCount > 0 && { icon:'homework', label:`${pendingCount} ta topshirilgan vazifa`, page:'my-homework', color:'var(--amber)',    bg:'var(--amber-bg)' },
          { icon:'groups',   label:'Mening guruhlarim', page:'my-classes', color:'var(--primary-l)', bg:'var(--primary-bg)' },
          { icon:'calendar', label:'Kalendar',          page:'calendar',   color:'var(--violet)',    bg:'var(--violet-bg)' },
        ].filter(Boolean).map((a, i) => (
          <motion.button key={a.label} onClick={() => onNav?.(a.page)}
            initial={{ opacity:0, x:6 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.24 + i*0.04 }}
            whileTap={{ scale:0.98 }}
            style={{
              display:'flex', alignItems:'center', gap:10, padding:'9px 10px',
              marginBottom:4, background:'transparent', borderRadius:'var(--r)',
              width:'100%', textAlign:'left', cursor:'pointer', border:'none', color:'inherit',
              transition:'background 140ms',
            }}
            onMouseEnter={e => e.currentTarget.style.background='var(--bg-subtle)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            <div style={{ width:28, height:28, borderRadius:8, background:a.bg, color:a.color, display:'grid', placeItems:'center', flexShrink:0 }}>
              <Icon name={a.icon} size={13}/>
            </div>
            <div style={{ flex:1, fontSize:13, fontWeight:500, minWidth:0 }}>{a.label}</div>
            <Icon name="chevronRight" size={12} color="var(--text-3)"/>
          </motion.button>
        ))}
      </motion.div>

      {/* My groups */}
      {groupsList.length > 0 && (
        <motion.div style={{ marginTop:16 }}
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <h2 style={{ fontFamily:'var(--display)', fontSize:15.5, fontWeight:700, letterSpacing:'-0.02em', margin:0 }}>
              Mening guruhlarim
            </h2>
            <button className="btn btn-ghost btn-sm" onClick={() => onNav?.('my-classes')}>
              Hammasi <Icon name="arrowRight" size={11}/>
            </button>
          </div>
          <motion.div className="groups-grid" variants={listContainer} initial="hidden" animate="show">
            {groupsList.slice(0, 3).map(g => {
              const studentCount = typeof g.studentCount === 'number'
                ? g.studentCount
                : Array.isArray(g.students) ? g.students.length : 0;
              const schedule = dayLabels(g.scheduleDays);
              return (
                <motion.div key={g._id} className="card card-hov" variants={listItem}
                  style={{ padding:13 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:9 }}>
                    <div style={{ minWidth:0, flex:1 }}>
                      {g.code && (
                        <div style={{ fontSize:10.5, fontFamily:'var(--mono)', color:'var(--text-2)', background:'var(--bg-subtle)', padding:'2px 7px', borderRadius:5, fontWeight:500, display:'inline-block', marginBottom:5 }}>
                          {g.code}
                        </div>
                      )}
                      <div style={{ fontSize:14, fontWeight:700, fontFamily:'var(--display)', letterSpacing:'-0.02em', lineHeight:1.25 }}>
                        {g.name || '—'}
                      </div>
                      {(schedule || g.scheduleTime) && (
                        <div style={{ fontSize:11.5, color:'var(--text-2)', marginTop:3 }}>
                          {schedule}{schedule && g.scheduleTime ? ' · ' : ''}{g.scheduleTime || ''}
                        </div>
                      )}
                    </div>
                    {g.level && (
                      <span className={`chip ${LVL_CHIP[g.level] || 'chip-neutral'}`} style={{ flexShrink:0 }}>
                        {g.level}
                      </span>
                    )}
                  </div>
                  <div style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'7px 10px', background:'var(--primary-bg)', borderRadius:8,
                    border:'1px solid var(--border)',
                  }}>
                    <span style={{ fontSize:11.5, color:'var(--text-2)' }}>O'quvchilar</span>
                    <span style={{ fontFamily:'var(--display)', fontSize:15, fontWeight:700, color:'var(--primary-l)' }}>
                      {studentCount}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
