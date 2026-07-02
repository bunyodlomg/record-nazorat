import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CAN_HOVER } from '../utils/device.js';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from 'recharts';
import { Icon, Avatar, useCountUp, ChartTooltip } from '../components/ui.jsx';
import { Spinner, ErrorBox, listContainer, listItem } from '../components/Feedback.jsx';
import { HeroNeon } from '../components/PageHero.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

function KpiCard({ label, value = 0, suffix = '', icon, iconBg, iconColor }) {
  const v = useCountUp(value);
  return (
    <motion.div className="kpi"
      variants={listItem}
      whileHover={CAN_HOVER ? { y:-4 } : undefined}
      transition={{ type:'spring', stiffness:300 }}
    >
      <div className="kpi-ico2" style={{ background:iconBg, color:iconColor }}>
        <Icon name={icon} size={19}/>
      </div>
      <div className="kpi-num">{v.toLocaleString()}{suffix}</div>
      <div className="kpi-cap">{label}</div>
    </motion.div>
  );
}

function ProblemTeacherCard({ t, onOpenTeacher, onOpenStudent }) {
  const [expanded, setExpanded] = useState(false);
  const students = t.pendingStudents || [];
  const preview = students.slice(0, expanded ? students.length : 3);
  const remaining = students.length - preview.length;

  return (
    <motion.div className="card" variants={listItem}
      style={{ padding:0, overflow:'hidden' }}>
      <button
        onClick={() => onOpenTeacher(t._id)}
        style={{
          width:'100%', display:'flex', alignItems:'center', gap:11, padding:'12px 14px',
          background:'transparent', border:'none', textAlign:'left', cursor:'pointer',
        }}>
        <Avatar name={t.name} hue={t.hue} size="sm" photoUrl={t.photoUrl}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:600 }}>{t.name}</div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>
            {students.length > 0
              ? `${students.length} o'quvchi · ${t.pendingReview} vazifa`
              : t.subject}
          </div>
        </div>
        <span style={{
          background:'var(--rose-bg)', color:'var(--rose)',
          fontSize:11.5, fontWeight:700, padding:'4px 10px', borderRadius:8,
          flexShrink:0,
        }}>
          {t.pendingReview} ta
        </span>
      </button>

      {students.length > 0 && (
        <div style={{ borderTop:'1px solid var(--border)', background:'var(--bg-subtle)' }}>
          <div style={{ padding:'8px 14px', display:'flex', flexDirection:'column', gap:3 }}>
            {preview.map(p => (
              <button key={p.studentId}
                onClick={() => onOpenStudent?.(p.studentId)}
                disabled={!onOpenStudent}
                style={{
                  display:'flex', alignItems:'center', gap:8, padding:'5px 4px',
                  background:'transparent', border:'none', textAlign:'left',
                  cursor: onOpenStudent ? 'pointer' : 'default', borderRadius:6,
                }}>
                <Avatar name={p.studentName} hue={p.studentHue} size="xs" photoUrl={p.studentPhotoUrl}/>
                <span style={{ fontSize:12.5, fontWeight:500, flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {p.studentName}
                </span>
                <span style={{
                  fontSize:10.5, fontWeight:700,
                  padding:'2px 7px', borderRadius:6,
                  background:'var(--amber-bg)', color:'var(--amber)',
                  whiteSpace:'nowrap', flexShrink:0,
                }}>
                  {p.count} ta
                </span>
              </button>
            ))}
          </div>
          {students.length > 3 && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                width:'100%', padding:'7px 14px',
                background:'transparent', border:'none', borderTop:'1px solid var(--border)',
                fontSize:11.5, color:'var(--text-2)', fontWeight:600, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:5,
              }}>
              <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={11}/>
              {expanded ? 'Yopish' : `+${remaining} ta yana`}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function DashboardPage({ onOpenTeacher, onOpenStudent, onNav }) {
  const { user } = useAuth();
  const [trendRange, setTrendRange] = useState('month'); // 'month' | 'year'
  const { data, loading, error, refetch } = useFetch(() => api.dashboard.get({ range: trendRange }), [trendRange]);

  // Real-time uchun har 12s da refetch
  useEffect(() => {
    const t = setInterval(() => refetch({ silent: true }), 12_000);
    return () => clearInterval(t);
  }, [refetch]);

  if (loading) return <div className="page"><Spinner/></div>;
  if (error)   return <div className="page"><ErrorBox message={error} onRetry={refetch}/></div>;

  const { kpis, topTeachers, problemTeachers, totalPendingStudents, activityData, attendanceTrend } = data;
  const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'Xush kelibsiz';
  const hour = new Date().getHours();
  const greetWord = hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';
  const hasActivity = (activityData ?? []).some(d => (d.lessons ?? 0) + (d.hw ?? 0) > 0);
  const hasTrend    = (attendanceTrend ?? []).length > 0;
  const trendDelta  = hasTrend
    ? attendanceTrend[attendanceTrend.length - 1].val - attendanceTrend[0].val
    : 0;

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.35 }}>

      <motion.div className="hero"
        initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
        <HeroNeon/>
        <div className="hero-content">
          <div className="hero-greet">{greetWord}, {firstName}! 👋</div>
          <div className="hero-sub">
            {new Date().toLocaleDateString('uz-UZ',{ weekday:'long', month:'long', day:'numeric' })} · bugun ajoyib kun bo'lsin!
          </div>
        </div>
      </motion.div>

      <motion.div className="kpi-grid" variants={listContainer} initial="hidden" animate="show">
        <KpiCard label="Jami o'quvchilar" value={kpis.totalStudents}  icon="user"     iconBg="var(--primary-bg)" iconColor="var(--primary)"/>
        <KpiCard label="O'qituvchilar"     value={kpis.totalTeachers}  icon="teachers" iconBg="var(--accent-bg)"  iconColor="var(--accent)"/>
        <KpiCard label="O'rtacha davomat"  value={kpis.avgAttendance} suffix="%" icon="activity" iconBg="var(--amber-bg)" iconColor="var(--amber)"/>
        <KpiCard label="Aktiv guruhlar"    value={kpis.totalGroups}    icon="grid"     iconBg="rgba(16,185,129,0.13)" iconColor="var(--emerald)"/>
      </motion.div>

      <motion.div className="chart-grid" variants={listContainer} initial="hidden" animate="show">
        <motion.div className="card" variants={listItem}>
          <div className="card-head">
            <div>
              <div className="card-title">O'qituvchi faolligi</div>
              <div className="card-sub">Darslar va belgilangan vazifalar · shu hafta</div>
            </div>
            <div style={{ display:'flex', gap:14, fontSize:11.5, color:'var(--text-2)', alignItems:'center' }}>
              {[['#6366f1','Darslar'],['#a78bfa','Vazifalar']].map(([c,l]) => (
                <span key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ width:8,height:8,borderRadius:2,background:c,display:'inline-block'}}/>{l}
                </span>
              ))}
            </div>
          </div>
          <div style={{ padding:'14px 16px 16px', height:230 }}>
            {hasActivity ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} barSize={11} barGap={3}>
                  <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="day" tick={{ fontSize:11.5, fill:'var(--text-2)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:11, fill:'var(--text-3)' }} axisLine={false} tickLine={false} width={28} allowDecimals={false}/>
                  <Tooltip content={<ChartTooltip/>} cursor={{ fill:'var(--bg-subtle)', radius:4 }}/>
                  <Bar dataKey="lessons" name="Darslar"  fill="#6366f1" radius={[4,4,0,0]}/>
                  <Bar dataKey="hw"      name="Vazifalar" fill="#a78bfa" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height:'100%', display:'grid', placeItems:'center', color:'var(--text-3)', fontSize:13 }}>
                Hozircha vazifa ma'lumotlari yo'q
              </div>
            )}
          </div>
        </motion.div>

        <motion.div className="card" variants={listItem}>
          <div className="card-head">
            <div>
              <div className="card-title">Vazifa bajarilish dinamikasi</div>
              <div className="card-sub">
                {trendRange === 'month'
                  ? "Oxirgi 30 kun · kunlik bajarilgan vazifalar foizi"
                  : "Oxirgi 12 oy · oylik bajarilgan vazifalar foizi"}
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {hasTrend && trendDelta !== 0 && (
                <span className={`chip ${trendDelta >= 0 ? 'chip-success' : 'chip-danger'}`}>
                  {trendDelta >= 0 ? '↑' : '↓'} {Math.abs(trendDelta)}%
                </span>
              )}
              <div className="seg" style={{ flexShrink:0 }}>
                <button className={`seg-btn ${trendRange==='month'?'active':''}`}
                  onClick={() => setTrendRange('month')} title="1 oy">
                  1 oy
                </button>
                <button className={`seg-btn ${trendRange==='year'?'active':''}`}
                  onClick={() => setTrendRange('year')} title="1 yil">
                  1 yil
                </button>
              </div>
            </div>
          </div>
          <div style={{ padding:'14px 16px 16px', height:230 }}>
          {hasTrend ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrend} margin={{ top:5, right:5, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="week" tick={{ fontSize:10.5, fill:'var(--text-2)' }}
                  axisLine={false} tickLine={false} interval="preserveStartEnd"
                  minTickGap={trendRange === 'month' ? 22 : 8}/>
                <YAxis domain={[0,100]} tick={{ fontSize:11, fill:'var(--text-3)' }} axisLine={false} tickLine={false} width={34} tickFormatter={v=>`${v}%`}/>
                <Tooltip content={<ChartTooltip/>}/>
                <Area type="monotone" dataKey="val" name="Bajarilgan" stroke="#6366f1" strokeWidth={2.5} fill="url(#attGrad)"
                  dot={trendRange === 'month' ? false : { r:3.5, fill:'var(--bg-card-s)', stroke:'#6366f1', strokeWidth:2 }}
                  activeDot={{ r:4.5, fill:'#6366f1', stroke:'var(--bg-card-s)', strokeWidth:2 }}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:'100%', display:'grid', placeItems:'center', color:'var(--text-3)', fontSize:13 }}>
              Hozircha trend uchun yetarli ma'lumot yo'q
            </div>
          )}
          </div>
        </motion.div>
      </motion.div>

      {(topTeachers?.length > 0) && (
        <motion.div className="card" variants={listItem} initial="hidden" animate="show" style={{ marginBottom:12 }}>
          <div className="card-head">
            <div>
              <div className="card-title">Eng faol o'qituvchilar</div>
              <div className="card-sub">Faollik ko'rsatkichi bo'yicha yetakchilar</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNav?.('teachers')}>
              Barchasini ko'rish <Icon name="chevronRight" size={13}/>
            </button>
          </div>
          <div style={{ padding:'4px 0' }}>
            {topTeachers.map((t, i) => (
              <div key={t._id} className={`rank-row r${i+1}`}
                onClick={() => onOpenTeacher?.(t._id)}
                style={{ cursor: onOpenTeacher ? 'pointer' : 'default' }}>
                <div className="rank-badge">{i + 1}</div>
                <Avatar name={t.name} hue={t.hue} size="sm" photoUrl={t.photoUrl}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-3)', marginTop:1 }}>{t.subject}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                  <div className="prog" style={{ width:64 }}>
                    <div className="prog-fill" style={{ width:`${t.score || 0}%` }}/>
                  </div>
                  <span style={{ fontFamily:'var(--display)', fontSize:14, fontWeight:700, minWidth:38, textAlign:'right' }}>
                    {t.score || 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}


      {problemTeachers?.length > 0 && (
        <motion.div className="card" variants={listItem} initial="hidden" animate="show">
          <div className="card-head">
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:32,height:32,borderRadius:9,background:'var(--rose-bg)',color:'var(--rose)',display:'grid',placeItems:'center' }}>
                <Icon name="alert" size={15}/>
              </div>
              <div>
                <div className="card-title">Kutayotgan vazifalar</div>
                <div className="card-sub">
                  {problemTeachers.length} o'qituvchi
                  {totalPendingStudents > 0 && ` · ${totalPendingStudents} o'quvchi`}
                  {' · '}{problemTeachers.reduce((s,t)=>s+(t.pendingReview||0),0)} vazifa
                </div>
              </div>
            </div>
          </div>
          <motion.div
            className="problem-grid"
            variants={listContainer} initial="hidden" animate="show"
            style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:10, padding:14 }}
          >
            {problemTeachers.map(t => (
              <ProblemTeacherCard key={t._id} t={t}
                onOpenTeacher={onOpenTeacher}
                onOpenStudent={onOpenStudent}/>
            ))}
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
