import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Icon, Avatar } from '../components/ui.jsx';
import { Spinner, ErrorBox } from '../components/Feedback.jsx';
import { useFetch } from '../hooks/useFetch.js';
import api from '../services/api.js';
import { sfx } from '../hooks/useSound.js';

const DAYS = [
  { id:'mon', label:'Du' },{ id:'tue', label:'Se' },{ id:'wed', label:'Ch' },
  { id:'thu', label:'Pa' },{ id:'fri', label:'Ju' },{ id:'sat', label:'Sh' },{ id:'sun', label:'Ya' },
];
const dayLabels = (days = []) => DAYS.filter(d => days.includes(d.id)).map(d => d.label).join(' · ');

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  const today = new Date();
  const diff = Math.floor((today - d) / 864e5);
  if (diff === 0)  return 'Bugun';
  if (diff === 1)  return 'Kecha';
  if (diff === -1) return 'Ertaga';
  if (diff > 1 && diff < 7) return `${diff} kun oldin`;
  return d.toLocaleDateString('uz-UZ', { day:'numeric', month:'short' });
}

function StatTile({ icon, label, value, tone = 'primary' }) {
  const tones = {
    primary: { bg:'var(--primary-bg)', fg:'var(--primary-l)' },
    amber:   { bg:'var(--amber-bg)',   fg:'var(--amber)' },
    emerald: { bg:'var(--primary-bg)', fg:'var(--emerald-l)' },
    accent:  { bg:'var(--accent-bg)',  fg:'var(--accent-l)' },
  };
  const c = tones[tone] || tones.primary;
  return (
    <div className="card" style={{ padding:'12px 13px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:6 }}>
        <div style={{ width:30, height:30, borderRadius:8, background:c.bg, color:c.fg, display:'grid', placeItems:'center' }}>
          {typeof icon === 'string' && icon.length <= 2 ? <span style={{ fontSize:15 }}>{icon}</span> : <Icon name={icon} size={14}/>}
        </div>
        <div style={{ fontFamily:'var(--display)', fontSize:22, fontWeight:700, letterSpacing:'-0.03em', color:'var(--text)', lineHeight:1 }}>
          {value ?? 0}
        </div>
      </div>
      <div style={{ fontSize:11, color:'var(--text-2)', fontWeight:500 }}>{label}</div>
    </div>
  );
}

function StudentRow({ s, onOpen }) {
  return (
    <button onClick={() => onOpen?.(s._id)}
      className="card"
      style={{
        padding:'10px 12px', display:'flex', alignItems:'center', gap:10,
        background:'var(--bg-subtle)', border:'1px solid var(--border)',
        cursor: onOpen ? 'pointer' : 'default', textAlign:'left', width:'100%',
      }}>
      {s.photoUrl
        ? <img src={s.photoUrl} alt="" style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>
        : <Avatar name={s.name} hue={s.hue ?? 200} size="sm"/>}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:600, lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {s.name}
        </div>
        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
          {s.telegramUsername ? `@${s.telegramUsername}` : (s.joinedViaBot ? 'Bot orqali' : "Qo'lda qo'shilgan")}
        </div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--primary-l)', display:'flex', alignItems:'center', gap:3, justifyContent:'flex-end' }}>
          💎 {s.gems ?? 0}
        </div>
        {s.pendingSubmissions > 0 && (
          <div style={{ fontSize:10.5, color:'var(--amber)', marginTop:2 }}>
            {s.pendingSubmissions} tekshirilmagan
          </div>
        )}
      </div>
    </button>
  );
}

function HomeworkItem({ hw, onOpen }) {
  const isDone     = hw.col === 'done';
  const isOverdue  = !isDone && hw.dueDate && new Date(hw.dueDate) < new Date();
  const submissions = hw.submissions || 0;
  const total       = hw.total || 0;
  const pct = total > 0 ? Math.round((submissions / total) * 100) : 0;

  return (
    <button onClick={() => onOpen?.(hw._id)}
      className="card"
      style={{
        padding:'11px 12px', display:'flex', alignItems:'center', gap:10,
        background:'var(--bg-subtle)', border:`1px solid ${isOverdue ? 'rgba(244,63,94,0.30)' : 'var(--border)'}`,
        cursor:'pointer', textAlign:'left', width:'100%',
      }}>
      <div style={{
        width:34, height:34, borderRadius:9, flexShrink:0,
        background: isDone ? 'var(--primary-bg)' : isOverdue ? 'var(--rose-bg)' : 'var(--amber-bg)',
        color:      isDone ? 'var(--primary-l)' : isOverdue ? 'var(--rose)'    : 'var(--amber)',
        display:'grid', placeItems:'center',
      }}>
        {hw.kind === 'speaking' ? <span style={{ fontSize:14 }}>🎤</span> : <Icon name={isDone ? 'check' : 'homework'} size={14}/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {hw.title}
        </div>
        <div style={{ fontSize:10.5, color:'var(--text-3)', marginTop:2 }}>
          {fmtDate(hw.dueDate)} · {submissions}/{total} tekshirildi
          {isOverdue && <span style={{ color:'var(--rose)', marginLeft:5, fontWeight:600 }}>· kechikkan</span>}
        </div>
      </div>
      <div style={{ minWidth:42, textAlign:'right', flexShrink:0 }}>
        <span style={{
          fontSize:11, fontWeight:700, color: isDone ? 'var(--primary-l)' : 'var(--amber)',
        }}>{pct}%</span>
      </div>
    </button>
  );
}

function PendingStudentCard({ s, onApprove, onReject, busy }) {
  return (
    <div className="card" style={{
      padding:'11px 12px', display:'flex', alignItems:'center', gap:10,
      background:'var(--amber-bg)', border:'1px solid rgba(251,191,36,0.30)',
    }}>
      {s.photoUrl
        ? <img src={s.photoUrl} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>
        : <Avatar name={s.name} hue={s.hue ?? 200} size="sm"/>}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {s.name}
        </div>
        {s.telegramUsername && (
          <div style={{ fontSize:11, color:'var(--text-2)', marginTop:2 }}>@{s.telegramUsername}</div>
        )}
      </div>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onApprove(s._id)}
        style={{ fontSize:11.5, padding:'6px 11px' }}>
        ✓ Tasdiqlash
      </button>
      <button className="btn btn-ghost btn-icon" disabled={busy} onClick={() => onReject(s._id)}
        style={{ width:30, height:30, color:'var(--rose)' }} title="Rad etish">
        ✕
      </button>
    </div>
  );
}

export default function GroupDetailPage({ groupId, onBack, onOpenStudent, onOpenHomework, onOpenTeacher }) {
  const [tab, setTab] = useState('students');
  const [busyPending, setBusyPending] = useState(null);
  const [copied, setCopied] = useState(false);
  const { data: g, loading, error, refetch } = useFetch(() => api.groups.get(groupId), [groupId]);

  const handleApprove = async (id) => {
    setBusyPending(id);
    try { await api.students.approve(id); sfx.success(); refetch(); }
    catch (e) { alert(e.message); }
    finally { setBusyPending(null); }
  };
  const handleReject = async (id) => {
    setBusyPending(id);
    try { await api.students.reject(id); sfx.success(); refetch(); }
    catch (e) { alert(e.message); }
    finally { setBusyPending(null); }
  };

  const ensureLink = async () => {
    try {
      const r = await api.groups.inviteLink(groupId);
      sfx.success();
      refetch();
      return r?.data?.link || null;
    } catch (e) { alert(e.message); return null; }
  };

  const copyLink = async (link) => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); sfx.success(); setTimeout(() => setCopied(false), 1500); }
    catch { alert('Nusxalab bo\'lmadi'); }
  };

  const students  = g?.studentList || [];
  const homework  = g?.homework    || [];
  const pending   = g?.pendingStudents || [];
  const stats     = g?.stats || {};

  const pendingHwCount = useMemo(() => homework.filter(h => h.col !== 'done').length, [homework]);

  if (loading) return <div className="page"><Spinner/></div>;
  if (error || !g) return <div className="page"><ErrorBox message={error || 'Guruh topilmadi'} onRetry={refetch}/></div>;

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.32 }}>
      <div style={{ marginBottom:14 }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ padding:'0 10px' }}>
          <Icon name="chevronLeft" size={14}/> Orqaga
        </button>
      </div>

      {/* Hero */}
      <motion.div className="card-glass"
        initial={{ opacity:0, scale:0.97 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.05, duration:0.4 }}
        style={{ padding:20, marginBottom:12, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at top right, oklch(0.74 0.16 ${g.teacher?.hue ?? 200} / 0.18), transparent 60%)`, pointerEvents:'none' }}/>
        <div style={{ display:'flex', alignItems:'flex-start', gap:14, flexWrap:'wrap' }}>
          <div style={{
            width:60, height:60, borderRadius:14, flexShrink:0,
            background:'linear-gradient(135deg, var(--primary), var(--primary-d))',
            color:'#fff', display:'grid', placeItems:'center',
            boxShadow:'0 4px 20px rgba(99,102,241,0.35)',
          }}>
            <Icon name="groups" size={26}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
              <h2 style={{ margin:0, fontFamily:'var(--display)', fontSize:24, fontWeight:700, letterSpacing:'-0.025em' }}>{g.name}</h2>
              <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--text-2)', background:'var(--bg-subtle)', padding:'3px 8px', borderRadius:6, fontWeight:500 }}>
                {g.code}
              </span>
            </div>
            <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:10 }}>
              {dayLabels(g.scheduleDays) || "Kun belgilanmagan"}
              {g.scheduleTime && ` · ${g.scheduleTime}`}
              {g.level && ` · ${g.level}`}
              {g.speakingPerWeek > 0 && ` · ${g.speakingPerWeek} ta speaking/hafta`}
            </div>
            {g.teacher && (
              <button onClick={() => onOpenTeacher?.(g.teacher._id)}
                disabled={!onOpenTeacher}
                style={{
                  display:'flex', alignItems:'center', gap:9, padding:'7px 12px 7px 7px',
                  background:'var(--bg-subtle)', borderRadius:'var(--r-full)',
                  border:'1px solid var(--border)',
                  cursor: onOpenTeacher ? 'pointer' : 'default',
                  fontSize:12.5,
                }}>
                <Avatar name={g.teacher.name} hue={g.teacher.hue} size="sm"/>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontWeight:600 }}>{g.teacher.name}</div>
                  <div style={{ fontSize:10.5, color:'var(--text-3)' }}>Mas'ul o'qituvchi</div>
                </div>
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom:12 }} className="grp-stats-grid">
        <StatTile icon="users"    tone="primary" label="O'quvchilar" value={g.studentCount}/>
        <StatTile icon="💎"       tone="primary" label="Olmoslar"    value={stats.totalGems}/>
        <StatTile icon="homework" tone="amber"   label="Tekshirilmagan" value={pendingHwCount}/>
        <StatTile icon="check"    tone="emerald" label="Tugatildi"   value={stats.completedHw}/>
      </div>

      {/* Invite link card */}
      <motion.div className="card"
        initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
        style={{ padding:14, marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:'var(--accent-bg)', color:'var(--accent-l)', display:'grid', placeItems:'center', flexShrink:0 }}>
            <Icon name="send" size={14}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700 }}>Bot orqali ulanish</div>
            <div style={{ fontSize:11.5, color:'var(--text-3)', marginTop:1 }}>O'quvchilar shu link orqali guruhga qo'shilishi mumkin</div>
          </div>
        </div>
        {g.inviteLink ? (
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <code style={{
              flex:1, padding:'9px 11px', background:'var(--bg-subtle)', border:'1px dashed var(--border)',
              borderRadius:8, fontSize:11.5, fontFamily:'var(--mono)', wordBreak:'break-all',
              color:'var(--text-1)',
            }}>{g.inviteLink}</code>
            <button className="btn btn-primary btn-sm" onClick={() => copyLink(g.inviteLink)}
              style={{ flexShrink:0 }}>
              {copied ? '✓' : 'Nusxalash'}
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={ensureLink}
            style={{ width:'100%', justifyContent:'center' }}>
            <Icon name="plus" size={13}/> Link yaratish
          </button>
        )}
      </motion.div>

      {/* Pending students alert */}
      {pending.length > 0 && (
        <motion.div
          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
          style={{
            padding:'10px 12px', marginBottom:12, borderRadius:10,
            background:'var(--amber-bg)', border:'1px solid rgba(251,191,36,0.30)',
            display:'flex', alignItems:'center', gap:9, cursor:'pointer',
          }}
          onClick={() => setTab('pending')}>
          <span style={{ fontSize:16 }}>⏳</span>
          <div style={{ flex:1, fontSize:12.5, color:'var(--amber)', fontWeight:600 }}>
            {pending.length} ta o'quvchi tasdiq kutmoqda
          </div>
          <Icon name="chevronRight" size={13} color="var(--amber)"/>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom:12 }}>
        <button className={`tab ${tab==='students'?'active':''}`} onClick={() => setTab('students')}>
          <Icon name="users" size={12} style={{ marginRight:4, verticalAlign:-1 }}/> O'quvchilar
          <span style={{ marginLeft:5, fontSize:10.5, color:'var(--text-3)' }}>{g.studentCount}</span>
        </button>
        <button className={`tab ${tab==='homework'?'active':''}`} onClick={() => setTab('homework')}>
          <Icon name="homework" size={12} style={{ marginRight:4, verticalAlign:-1 }}/> Vazifalar
          <span style={{ marginLeft:5, fontSize:10.5, color:'var(--text-3)' }}>{homework.length}</span>
        </button>
        {pending.length > 0 && (
          <button className={`tab ${tab==='pending'?'active':''}`} onClick={() => setTab('pending')}
            style={{ color:'var(--amber)', fontWeight:700 }}>
            ⏳ Pending
            <span style={{ marginLeft:5, padding:'1px 7px', borderRadius:10, background:'var(--amber)', color:'#1a1a1a', fontSize:10.5, fontWeight:800 }}>
              {pending.length}
            </span>
          </button>
        )}
      </div>

      {tab === 'students' ? (
        students.length === 0 ? (
          <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--text-3)' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>👥</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Hozircha o'quvchi yo'q</div>
            <div style={{ fontSize:12.5, marginTop:5 }}>Yuqoridagi link orqali yoki qo'lda qo'shing.</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {students.map(s => <StudentRow key={s._id} s={s} onOpen={onOpenStudent}/>)}
          </div>
        )
      ) : tab === 'homework' ? (
        homework.length === 0 ? (
          <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--text-3)' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>📚</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Hozircha vazifa yo'q</div>
            <div style={{ fontSize:12.5, marginTop:5 }}>Dars kunlari avtomatik yaratiladi.</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {homework.map(hw => <HomeworkItem key={hw._id} hw={hw} onOpen={onOpenHomework}/>)}
          </div>
        )
      ) : (
        pending.length === 0 ? (
          <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--text-3)' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>✓</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Tasdiq kutayotgan yo'q</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {pending.map(s => (
              <PendingStudentCard key={s._id} s={s}
                onApprove={handleApprove} onReject={handleReject}
                busy={busyPending === s._id}/>
            ))}
          </div>
        )
      )}
    </motion.div>
  );
}
