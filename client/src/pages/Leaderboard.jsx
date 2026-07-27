import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CAN_HOVER } from '../utils/device.js';
import { Icon, Avatar, useCountUp } from '../components/ui.jsx';
import { Spinner, ErrorBox, listContainer, listItem } from '../components/Feedback.jsx';
import PageHero from '../components/PageHero.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useStickyState } from '../hooks/useStickyState.js';
import api from '../services/api.js';

const MEDALS = {
  1:{ icon:'🥇', bg:'linear-gradient(135deg,#fde68a,#f59e0b)', border:'#d97706' },
  2:{ icon:'🥈', bg:'linear-gradient(135deg,#e5e7eb,#9ca3af)', border:'#6b7280' },
  3:{ icon:'🥉', bg:'linear-gradient(135deg,#fed7aa,#c2410c)', border:'#9a3412' },
};
const BAR_BG = {
  1:'linear-gradient(180deg,#34d399,#0d9488)',
  2:'linear-gradient(180deg,#7dd3fc,#0284c7)',
  3:'linear-gradient(180deg,#fed7aa,#ea580c)',
};

function PodiumCard({ entry, place, height, subtitleKey = 'subject', metricKey = 'score', metricLabel = 'Ball', metricIcon = null, onClick }) {
  const [anim, setAnim] = useState(false);
  useEffect(() => { const id = setTimeout(() => setAnim(true), 200 + place*100); return () => clearTimeout(id); }, []);
  const target = entry[metricKey] || 0;
  const score = useCountUp(anim ? target : 0, 1000);
  const m = MEDALS[place];

  const subtitle =
    subtitleKey === 'group' ? (entry.group?.name || entry.group?.code || '') :
    subtitleKey === 'count' ? `${entry.studentCount || 0} ta o'quvchi` :
                               (entry.subject || '');

  return (
    <motion.div
      initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }}
      transition={{ delay:0.1 + place*0.08, duration:0.5 }}
      onClick={() => onClick?.(entry)}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:11, minWidth:0, cursor: onClick ? 'pointer' : 'default' }}>
      <motion.div
        whileHover={!CAN_HOVER ? undefined : { scale:1.08, rotate:5 }}
        style={{ width:48, height:48, borderRadius:'50%', background:m.bg, display:'grid', placeItems:'center',
          fontSize:24, boxShadow:`0 4px 16px ${m.border}50`, border:`2px solid ${m.border}` }}>
        {m.icon}
      </motion.div>
      <Avatar name={entry.name} hue={entry.hue || 200} size={place===1?'xl':'lg'} photoUrl={entry.photoUrl}/>
      <div style={{ textAlign:'center', width:'100%', maxWidth:140, minWidth:0 }}>
        <div style={{
          fontFamily:'var(--display)', fontSize:place===1?16:13.5, fontWeight:700, letterSpacing:'-0.02em',
          lineHeight:1.18, minHeight:'2.36em',
          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
          overflow:'hidden', overflowWrap:'anywhere', wordBreak:'break-word',
        }}>{entry.name}</div>
        <div style={{ fontSize:11.5, color:'var(--text-2)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{subtitle}</div>
      </div>
      <motion.div
        initial={{ height:0 }} animate={{ height:anim?height:0 }}
        transition={{ duration:0.7, ease:[0.34,1.56,0.64,1] }}
        style={{ width:'100%', borderRadius:'12px 12px 0 0', background:BAR_BG[place],
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          color:'#fff', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.2)' }}>
        {anim && <>
          <div style={{ fontFamily:'var(--display)', fontSize:place===1?38:26, fontWeight:800, letterSpacing:'-0.04em', display:'flex', alignItems:'center', gap:5 }}>
            {metricIcon && <span style={{ fontSize:place===1?28:20 }}>{metricIcon}</span>}
            {score}
          </div>
          <div style={{ fontSize:10.5, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700, opacity:0.9 }}>{metricLabel}</div>
        </>}
      </motion.div>
    </motion.div>
  );
}

function LeaderRow({ entry, idx, subtitleKey, metricKey = 'score', metricIcon = null, showBar = true, onClick }) {
  const subtitle =
    subtitleKey === 'group' ? (entry.group?.name || entry.group?.code || '—') :
    subtitleKey === 'count' ? `${entry.studentCount || 0} ta o'quvchi` :
                              (entry.subject || '—');
  const value = entry[metricKey] || 0;
  return (
    <motion.button variants={listItem}
      onClick={() => onClick?.(entry)}
      style={{
        display:'grid', gridTemplateColumns:'40px 1fr auto', gap:12,
        alignItems:'center', padding:'12px 16px',
        borderBottom:'1px solid var(--border)',
        background:'transparent', textAlign:'left', cursor: onClick ? 'pointer' : 'default',
        width:'100%',
      }}
      onMouseEnter={!CAN_HOVER ? undefined : e => onClick && (e.currentTarget.style.background = 'var(--bg-subtle)')}
      onMouseLeave={!CAN_HOVER ? undefined : e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ fontFamily:'var(--display)', fontSize:14, fontWeight:700, color:'var(--text-3)' }}>#{idx+4}</div>
      <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
        <Avatar name={entry.name} hue={entry.hue || 200} size="sm" photoUrl={entry.photoUrl}/>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{entry.name}</div>
          <div style={{ fontSize:11.5, color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        {showBar && (
          <div className="prog" style={{ width:60, height:6 }}>
            <motion.div className="prog-fill"
              initial={{ width:0 }} animate={{ width:`${Math.min(100, value)}%` }}
              transition={{ duration:0.8, delay: Math.min(0.1 + idx*0.04, 1.2), ease:[0.22,1,0.36,1] }}/>
          </div>
        )}
        <div style={{ fontFamily:'var(--display)', fontSize:16, fontWeight:700, minWidth:36, textAlign:'right', display:'flex', alignItems:'center', gap:4 }}>
          {metricIcon && <span style={{ fontSize:14 }}>{metricIcon}</span>}
          {value}
        </div>
      </div>
    </motion.button>
  );
}

function PodiumSection({ items, subtitleKey, metricKey, metricLabel, metricIcon, onClick }) {
  const top3 = items.slice(0, 3);
  return (
    <motion.div className="card-glass"
      initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.05 }}
      style={{ padding:'24px 16px', marginBottom:14, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at top, rgba(20,184,166,0.10), transparent 60%)', pointerEvents:'none' }}/>
      <div className="podium" style={{ position:'relative', maxWidth:680, margin:'0 auto' }}>
        {top3[1] && <PodiumCard entry={top3[1]} place={2} height={150} subtitleKey={subtitleKey} metricKey={metricKey} metricLabel={metricLabel} metricIcon={metricIcon} onClick={onClick}/>}
        {top3[0] && <PodiumCard entry={top3[0]} place={1} height={200} subtitleKey={subtitleKey} metricKey={metricKey} metricLabel={metricLabel} metricIcon={metricIcon} onClick={onClick}/>}
        {top3[2] && <PodiumCard entry={top3[2]} place={3} height={120} subtitleKey={subtitleKey} metricKey={metricKey} metricLabel={metricLabel} metricIcon={metricIcon} onClick={onClick}/>}
      </div>
    </motion.div>
  );
}

function FullList({ items, title, sub, subtitleKey, metricKey = 'score', metricLabel = 'Ball', metricIcon = null, showBar = true, onClick }) {
  if (items.length === 0) {
    return (
      <div style={{ padding:'60px 0', textAlign:'center', color:'var(--text-3)' }}>
        <div style={{ fontSize:40, marginBottom:8 }}>🏆</div>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Hozircha bo'sh</div>
      </div>
    );
  }
  const rest = items.slice(3);
  // Stagger faqat 20 dan kam bo'lsa — ko'p elementda animatsiya juda sekin
  const useStagger = rest.length <= 20;
  return (
    <>
      <PodiumSection items={items} subtitleKey={subtitleKey} metricKey={metricKey} metricLabel={metricLabel} metricIcon={metricIcon} onClick={onClick}/>
      {rest.length > 0 && (
        <div className="card">
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
            <div style={{ minWidth:0 }}>
              <div className="card-title">{title}</div>
              <div className="card-sub" style={{ marginTop:3 }}>{sub}</div>
            </div>
            <span style={{
              fontSize:11, fontWeight:700, color:'var(--text-2)',
              background:'var(--bg-subtle)', padding:'3px 9px', borderRadius:6,
              flexShrink:0,
            }}>{items.length} ta</span>
          </div>
          <motion.div
            variants={{
              hidden:{},
              show:{ transition: { staggerChildren: useStagger ? 0.06 : 0 } },
            }}
            initial="hidden" animate="show">
            {rest.map((entry, i) => (
              <LeaderRow key={entry._id} entry={entry} idx={i} subtitleKey={subtitleKey}
                metricKey={metricKey} metricIcon={metricIcon} showBar={showBar}
                onClick={onClick}/>
            ))}
          </motion.div>
        </div>
      )}
    </>
  );
}

export default function LeaderboardPage({ onOpenTeacher, onOpenStudent }) {
  const [tab, setTab] = useStickyState('leaderboard:tab', 'students');
  const [groupId, setGroupId] = useStickyState('leaderboard:groupId', null);

  const { data: teachersData, loading: tLoad, error: tErr, refetch: tRefetch } =
    useFetch(() => api.leaderboard.teachers({ limit:100 }), [tab === 'teachers']);
  const { data: studentsData, loading: sLoad, error: sErr, refetch: sRefetch } =
    useFetch(() => api.leaderboard.students({ limit:100, ...(groupId ? { groupId } : {}) }), [tab === 'students', groupId]);
  const { data: groupsData, loading: gLoad, error: gErr, refetch: gRefetch } =
    useFetch(() => api.leaderboard.groups(), [tab === 'groups']);
  const { data: groupListData } = useFetch(() => api.groups.list({ limit:100 }), []);

  const teachers = teachersData ?? [];
  const students = studentsData ?? [];
  const groups   = groupsData ?? [];
  const groupOptions = groupListData?.data ?? [];

  const totalGems = students.reduce((s, x) => s + (x.gems || 0), 0);
  const heroStats = [
    { value: teachers.length,                      label:"O'qituvchilar", icon:'teachers', bg:'var(--primary-bg)',     color:'var(--primary)' },
    { value: students.length,                      label:"O'quvchilar",   icon:'user',     bg:'rgba(56,189,248,0.14)', color:'#0ea5e9' },
    { value: groups.length || groupOptions.length, label:'Guruhlar',      icon:'groups',   bg:'rgba(16,185,129,0.14)', color:'#059669' },
    { value: totalGems,                            label:'Jami olmos',    icon:'gem',      bg:'var(--accent-bg)',      color:'var(--accent)' },
  ];

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.35 }}>
      <PageHero
        title="Reyting"
        subtitle={
          tab === 'teachers' ? "Eng yaxshi o'qituvchilar"
          : tab === 'groups' ? "Guruhlar bo'yicha jami olmoslar"
          : (groupId ? "Tanlangan guruh — olmos bo'yicha" : "Barcha o'quvchilar — olmos bo'yicha")
        }
        emoji="🏆"
        stats={heroStats}
      />

      <div className="tabs" style={{ marginBottom:14 }}>
        <button className={`tab ${tab==='teachers'?'active':''}`} onClick={() => setTab('teachers')}>
          <Icon name="teachers" size={12} style={{ marginRight:4, verticalAlign:-1 }}/> O'qituvchilar
        </button>
        <button className={`tab ${tab==='groups'?'active':''}`} onClick={() => { setTab('groups'); setGroupId(null); }}>
          <Icon name="groups" size={12} style={{ marginRight:4, verticalAlign:-1 }}/> Guruhlar
        </button>
        <button className={`tab ${tab==='students'?'active':''}`} onClick={() => setTab('students')}>
          <Icon name="user" size={12} style={{ marginRight:4, verticalAlign:-1 }}/> O'quvchilar
        </button>
      </div>

      {tab === 'students' && groupOptions.length > 0 && (
        <div style={{ marginBottom:14, display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={() => setGroupId(null)}
            className="chip"
            style={{
              cursor:'pointer', padding:'6px 12px', fontSize:12,
              background: !groupId ? 'var(--primary)' : 'var(--bg-subtle)',
              color: !groupId ? '#fff' : 'var(--text-2)',
              border: !groupId ? 'none' : '1px solid var(--border)',
            }}>
            Barchasi
          </button>
          {groupOptions.map(g => (
            <button key={g._id} onClick={() => setGroupId(g._id)}
              className="chip"
              style={{
                cursor:'pointer', padding:'6px 12px', fontSize:12,
                background: groupId === g._id ? 'var(--primary)' : 'var(--bg-subtle)',
                color: groupId === g._id ? '#fff' : 'var(--text-2)',
                border: groupId === g._id ? 'none' : '1px solid var(--border)',
              }}>
              {g.code || g.name}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={tab + (groupId || '')}
          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
          transition={{ duration:0.22 }}>
          {tab === 'teachers' && (
            tLoad ? <Spinner/> :
            tErr  ? <ErrorBox message={tErr} onRetry={tRefetch}/> :
            <FullList items={teachers} title="To'liq reyting" sub="Faollik va davomat asosida"
              subtitleKey="subject"
              onClick={onOpenTeacher ? (e) => onOpenTeacher(e._id) : null}/>
          )}
          {tab === 'groups' && (
            gLoad ? <Spinner/> :
            gErr  ? <ErrorBox message={gErr} onRetry={gRefetch}/> :
            <FullList items={groups}
              title="Guruhlar reytingi" sub="Guruhdagi o'quvchilar jami olmoslari"
              subtitleKey="count"
              metricKey="totalGems" metricLabel="Olmos" metricIcon="💎" showBar={false}/>
          )}
          {tab === 'students' && (
            sLoad ? <Spinner/> :
            sErr  ? <ErrorBox message={sErr} onRetry={sRefetch}/> :
            <FullList items={students} title="O'quvchilar reytingi" sub="Belgilangan vazifalardan to'plangan olmoslar"
              subtitleKey="group"
              metricKey="gems" metricLabel="Olmos" metricIcon="💎" showBar={false}
              onClick={onOpenStudent ? (e) => onOpenStudent(e._id) : null}/>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
