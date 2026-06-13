import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Avatar, StatusDot, TgUsername } from '../components/ui.jsx';
import { Spinner, ErrorBox } from '../components/Feedback.jsx';
import { Modal, Field, Textarea } from '../components/Modal.jsx';
import { useFetch } from '../hooks/useFetch.js';
import api from '../services/api.js';

// tg-{id}@local — bu placeholder, real email emas
const isPlaceholderEmail = e => !e || /^tg-[\w-]+@local$/i.test(e);
const teacherHandle = t => {
  if (t?.telegramUsername) return `@${t.telegramUsername}`;
  if (!isPlaceholderEmail(t?.email)) return t.email;
  return null;
};

const PRAISE_TEMPLATES = [
  "Bugungi darsingiz ajoyib o'tdi — rahmat! 👏",
  "Vazifalarni tez va sifatli tekshiryapsiz, davom eting!",
  "O'quvchilarning natijasi sezilarli yaxshilandi — sizning xizmatingiz.",
];

const TONE_BG = {
  primary: { bg:'rgba(45,212,191,0.10)', fg:'var(--primary-l)', border:'rgba(45,212,191,0.20)' },
  accent:  { bg:'rgba(56,189,248,0.10)', fg:'var(--accent-l)',  border:'rgba(56,189,248,0.20)' },
  amber:   { bg:'rgba(251,191,36,0.10)', fg:'var(--amber)',     border:'rgba(251,191,36,0.22)' },
  emerald: { bg:'rgba(52,211,153,0.10)', fg:'var(--emerald-l)', border:'rgba(52,211,153,0.22)' },
  violet:  { bg:'rgba(167,139,250,0.10)',fg:'var(--violet-l)',  border:'rgba(167,139,250,0.22)'},
};

const REVIEW = {
  reviewed:   { label:'Hammasi belgilangan',  chip:'chip-success', icon:'check' },
  partial:    { label:'Chala tekshirgan',     chip:'chip-warning', icon:'alert' },
  unreviewed: { label:'Kutilmoqda',           chip:'chip-danger',  icon:'alert' },
  'no-tasks': { label:"Vazifa yo'q",          chip:'chip-neutral', icon:'clock' },
};
function ReviewChip({ status }) {
  const r = REVIEW[status || 'no-tasks'];
  return <span className={`chip ${r.chip}`} style={{ fontSize:10.5 }}><Icon name={r.icon} size={10}/> {r.label}</span>;
}

function KpiTile({ icon, label, value, sub, tone = 'primary' }) {
  const c = TONE_BG[tone] || TONE_BG.primary;
  return (
    <div className="card" style={{ padding:'12px 14px', position:'relative' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:8 }}>
        <div style={{
          width:30, height:30, borderRadius:8,
          background:c.bg, color:c.fg, border:`1px solid ${c.border}`,
          display:'grid', placeItems:'center', flexShrink:0,
        }}>
          <Icon name={icon} size={14}/>
        </div>
        <div style={{ fontFamily:'var(--display)', fontSize:22, fontWeight:700, letterSpacing:'-0.04em', lineHeight:1, color:'var(--text)', fontVariantNumeric:'tabular-nums' }}>
          {value ?? 0}
        </div>
      </div>
      <div style={{ fontSize:11.5, color:'var(--text-2)', fontWeight:500, lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label}</div>
      {sub && <div style={{ fontSize:10.5, color:'var(--text-3)', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sub}</div>}
    </div>
  );
}

function MessageModal({ open, onClose, teacher, kind = 'message' }) {
  const [text, setText]     = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const reset = () => { setText(''); setError(''); setDone(false); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!text.trim()) return;
    setError(''); setSending(true);
    try {
      await api.teachers.message(teacher._id, { text: text.trim(), kind });
      setDone(true);
      setTimeout(close, 1100);
    } catch (e) {
      setError(e.message || "Yuborib bo'lmadi");
    } finally { setSending(false); }
  };

  if (!teacher) return null;
  const title = kind === 'praise' ? 'Maqtash' : 'Yozish';
  const handle = teacher.telegramUsername ? `@${teacher.telegramUsername}` : null;

  return (
    <Modal open={open} onClose={close}
      title={title}
      subtitle={`${teacher.name}${handle ? ' · '+handle : ''} — Telegram orqali yuboriladi`}
      width={460}
      footer={done ? null : <>
        <button className="btn btn-ghost" onClick={close} disabled={sending}>Bekor qilish</button>
        <button className="btn btn-primary" onClick={submit} disabled={sending || !text.trim()}>
          {sending ? 'Yuborilmoqda...' : (kind === 'praise' ? 'Maqtovni yuborish' : 'Yuborish')}
        </button>
      </>}
    >
      {done ? (
        <div style={{ padding:'20px 0', textAlign:'center' }}>
          <div style={{ fontSize:34, marginBottom:8 }}>✓</div>
          <div style={{ fontSize:14, fontWeight:600 }}>Yuborildi</div>
          <div style={{ fontSize:12.5, color:'var(--text-3)', marginTop:4 }}>Telegram orqali yetkazildi</div>
        </div>
      ) : <>
        {error && (
          <div style={{ marginBottom:12, padding:'10px 12px', background:'var(--rose-bg)', border:'1px solid var(--rose)', borderRadius:8, color:'var(--rose)', fontSize:12.5 }}>
            {error}
          </div>
        )}
        {kind === 'praise' && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11.5, fontWeight:600, color:'var(--text-2)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Tayyor matnlar</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {PRAISE_TEMPLATES.map(tpl => (
                <button key={tpl} type="button" className="chip chip-neutral"
                  onClick={() => setText(tpl)}
                  style={{ cursor:'pointer', fontSize:11.5, padding:'5px 10px' }}>
                  {tpl.length > 40 ? tpl.slice(0,40)+'...' : tpl}
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label="Xabar matni">
          <Textarea value={text} onChange={e=>setText(e.target.value)} maxLength={1500}
            placeholder={kind === 'praise' ? 'Maqtov so\'zlaringiz...' : 'Xabaringiz...'}
            style={{ minHeight:120 }} autoFocus/>
        </Field>
      </>}
    </Modal>
  );
}

export function TeacherDrawer({ teacherId, onClose, onOpenFull }) {
  const { data: t, loading, error } = useFetch(() => api.teachers.get(teacherId), [teacherId]);
  const { data: acts = [] } = useFetch(() => api.teachers.activity(teacherId), [teacherId]);
  const [msg, setMsg] = useState(null);

  const showScore = Number.isFinite(t?.score) && t.score > 0;

  return (
    <AnimatePresence>
      <motion.div className="drawer-back"
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose}/>
      <motion.aside className="drawer"
        initial={{ x:'100%' }} animate={{ x:0 }} exit={{ x:'100%' }}
        transition={{ type:'spring', damping:30, stiffness:280 }}
      >
        {loading ? <div className="drawer-body"><Spinner/></div>
        : error || !t ? <div className="drawer-body"><ErrorBox message={error}/></div>
        : <>
          <div className="drawer-hd">
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <Avatar name={t.name} hue={t.hue} size="md" photoUrl={t.photoUrl}/>
              <div>
                <div style={{ fontFamily:'var(--display)', fontSize:15, fontWeight:600, letterSpacing:'-0.02em' }}>{t.name}</div>
                <div style={{ fontSize:12, color:'var(--text-2)', marginTop:1 }}>{t.subject}</div>
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><Icon name="close" size={16}/></button>
          </div>
          <div className="drawer-body">
            <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
              style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              <span className={`chip ${t.status==='active'?'chip-success':'chip-neutral'}`}>
                <StatusDot status={t.status}/> {t.status === 'active' ? 'Faol' : 'Faol emas'}
              </span>
              {(t.homework?.pending ?? 0) > 0 && (
                <span className={`chip ${t.homework.pending > 5 ? 'chip-danger' : 'chip-warning'}`}>
                  {t.homework.pending} ta kutmoqda
                </span>
              )}
            </motion.div>

            {(teacherHandle(t) || t.phone) && (
              <div style={{ background:'var(--bg-subtle)', borderRadius:'var(--r)', padding:'11px 13px', marginBottom:18 }}>
                {teacherHandle(t) && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, marginBottom: t.phone ? 6 : 0 }}>
                    <Icon name={t.telegramUsername ? 'send' : 'mail'} size={13} color="var(--text-3)"/>
                    <span style={{ color:'var(--text-2)' }}>{t.telegramUsername ? <TgUsername username={t.telegramUsername}/> : teacherHandle(t)}</span>
                  </div>
                )}
                {t.phone && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                    <Icon name="phone" size={13} color="var(--text-3)"/>
                    <span style={{ color:'var(--text-2)' }}>{t.phone}</span>
                  </div>
                )}
              </div>
            )}

            {((t.groups?.length ?? 0) > 0 || t.rank) && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:18 }}>
                {(t.groups?.length ?? 0) > 0 && (
                  <div style={{ background:'var(--bg-subtle)', borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ fontSize:10.5, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Guruhlar</div>
                    <div style={{ fontFamily:'var(--display)', fontSize:18, fontWeight:700, marginTop:2 }}>{t.groups.length}</div>
                  </div>
                )}
                {t.rank && (
                  <div style={{ background:'var(--bg-subtle)', borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ fontSize:10.5, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Reyting</div>
                    <div style={{ fontFamily:'var(--display)', fontSize:18, fontWeight:700, marginTop:2 }}>#{t.rank}</div>
                  </div>
                )}
              </div>
            )}

            {showScore && <>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-3)', marginBottom:11 }}>Faollik</div>
              <motion.div style={{ marginBottom:20 }}
                initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.15 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, fontSize:12.5 }}>
                  <span>Bajarilgan ish darajasi</span><span style={{ fontWeight:600 }}>{t.score}%</span>
                </div>
                <div className="prog"><motion.div className="prog-fill"
                  initial={{ width:0 }} animate={{ width:`${t.score}%` }}
                  transition={{ duration:0.9, delay:0.2, ease:[0.22,1,0.36,1] }}/></div>
              </motion.div>
            </>}

            {acts.length > 0 && <>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-3)', marginBottom:11 }}>Oxirgi faoliyat</div>
              <div className="tl">
                {acts.slice(0,4).map((a,i) => (
                  <motion.div key={i} className="tl-item"
                    initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }}
                    transition={{ delay:0.4 + i*0.06 }}
                  >
                    <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center' }}>
                      <div className="tl-dot" style={{ background: a.tone==='success' ? 'var(--primary-l)' : 'var(--accent-l)' }}/>
                      {i < 3 && <div className="tl-line"/>}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{a.action}</div>
                      <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>{a.detail}</div>
                      <div style={{ fontSize:11, color:'var(--text-3)', marginTop:3 }}>{a.time}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>}

            <div style={{ display:'flex', gap:8, marginTop:22, paddingTop:18, borderTop:'1px solid var(--border)', flexWrap:'wrap' }}>
              <button className="btn btn-primary" style={{ flex:'1 1 100%', justifyContent:'center' }} onClick={onOpenFull}>
                To'liq profil <Icon name="arrowRight" size={12}/>
              </button>
              <button className="btn btn-secondary" style={{ flex:1, justifyContent:'center' }}
                onClick={() => setMsg('message')}
                disabled={!t.telegramUsername && !t.telegramId}
                title={!t.telegramUsername && !t.telegramId ? "Telegram akkaunti yo'q" : ''}>
                <Icon name="send" size={13}/> Yozish
              </button>
              <button className="btn btn-secondary" style={{ flex:1, justifyContent:'center' }}
                onClick={() => setMsg('praise')}
                disabled={!t.telegramUsername && !t.telegramId}
                title={!t.telegramUsername && !t.telegramId ? "Telegram akkaunti yo'q" : ''}>
                <Icon name="sparkles" size={13}/> Maqtash
              </button>
            </div>
          </div>
          <MessageModal open={!!msg} kind={msg} teacher={t} onClose={() => setMsg(null)}/>
        </>}
      </motion.aside>
    </AnimatePresence>
  );
}

export function TeacherDetailPage({ teacherId, onBack, onOpenGroup }) {
  const { data: t, loading, error, refetch } = useFetch(() => api.teachers.get(teacherId), [teacherId]);
  const { data: acts = [] } = useFetch(() => api.teachers.activity(teacherId), [teacherId]);
  const [msg, setMsg] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);

  if (loading) return <div className="page"><Spinner/></div>;
  if (error || !t) return <div className="page"><ErrorBox message={error} onRetry={refetch}/></div>;

  const canMessage = !!(t.telegramUsername || t.telegramId);
  const showScore  = Number.isFinite(t.score) && t.score > 0;
  const hasGroups  = (t.groups?.length ?? 0) > 0;
  const stats      = t.stats || { totalStudents:0, activeGroups:0, totalGroups:0, homework:{ pending:0, checking:0, done:0, total:0 } };

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.35 }}>
      <div style={{ marginBottom:18 }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ padding:'0 10px' }}>
          <Icon name="chevronLeft" size={14}/> Orqaga
        </button>
      </div>

      {/* Hero */}
      <motion.div className="card-glass"
        initial={{ opacity:0, scale:0.97 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.05, duration:0.4 }}
        style={{ padding:20, marginBottom:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at top right, oklch(0.74 0.16 ${t.hue} / 0.20), transparent 55%)`, pointerEvents:'none' }}/>
        <div className="t-hero">
          <Avatar name={t.name} hue={t.hue} size="2xl" photoUrl={t.photoUrl}/>
          <div className="t-hero-info">
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
              <h2 className="t-hero-name">{t.name}</h2>
              <span className={`chip ${t.status==='active'?'chip-success':'chip-neutral'}`}>
                <StatusDot status={t.status}/> {t.status==='active'?'Faol':'Faol emas'}
              </span>
              <ReviewChip status={t.reviewStatus}/>
            </div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:10 }}>
              {t.subject} o'qituvchisi
              {hasGroups && ` · ${t.groups.length} ta guruh`}
              {t.rank && ` · reyting #${t.rank}`}
            </div>
            <div style={{ display:'flex', gap:14, fontSize:12, color:'var(--text-2)', flexWrap:'wrap' }}>
              {teacherHandle(t) && (
                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <Icon name={t.telegramUsername ? 'send' : 'mail'} size={12}/>{teacherHandle(t)}
                </span>
              )}
              {t.phone && (
                <span style={{ display:'flex', alignItems:'center', gap:6 }}><Icon name="phone" size={12}/>{t.phone}</span>
              )}
              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                <Icon name="calendar" size={12}/>
                {new Date(t.joined).toLocaleDateString('uz-UZ',{ month:'short', year:'numeric' })} dan beri
              </span>
            </div>
          </div>
          <div className="t-hero-actions">
            <button className="btn btn-secondary" onClick={() => setMsg('message')} disabled={!canMessage}
              title={!canMessage ? "Telegram akkaunti yo'q" : ''}>
              <Icon name="send" size={13}/> Yozish
            </button>
            <button className="btn btn-primary" onClick={() => setMsg('praise')} disabled={!canMessage}
              title={!canMessage ? "Telegram akkaunti yo'q" : ''}>
              <Icon name="sparkles" size={13}/> Maqtash
            </button>
          </div>
        </div>
      </motion.div>

      <MessageModal open={!!msg} kind={msg} teacher={t} onClose={() => setMsg(null)}/>

      {/* KPI strip */}
      <motion.div className="t-kpi-grid"
        initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}>
        <KpiTile icon="users"    tone="primary" label="Jami o'quvchi"   value={stats.totalStudents}/>
        <KpiTile icon="groups"   tone="accent"  label="Faol guruh"      value={stats.activeGroups} sub={stats.totalGroups !== stats.activeGroups ? `${stats.totalGroups} jami` : null}/>
        <KpiTile icon="homework" tone="amber"   label="Tekshiruvda"     value={stats.homework.pending + stats.homework.checking} sub={stats.homework.total ? `${stats.homework.total} jami` : null}/>
        <KpiTile icon="check"    tone="emerald" label="Belgilangan"     value={stats.homework.done}/>
      </motion.div>

      {showScore && (
        <motion.div className="card"
          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}
          style={{ padding:18, marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div>
              <div className="card-title" style={{ marginBottom:2 }}>Faollik darajasi</div>
              <div className="card-sub">30 kunlik bajarilgan ish</div>
            </div>
            <div style={{ fontFamily:'var(--display)', fontSize:32, fontWeight:700, letterSpacing:'-0.04em', color:'var(--primary-l)' }}>{t.score}%</div>
          </div>
          <div className="prog">
            <motion.div className="prog-fill"
              initial={{ width:0 }} animate={{ width:`${t.score}%` }}
              transition={{ duration:1, delay:0.25, ease:[0.22,1,0.36,1] }}/>
          </div>
        </motion.div>
      )}

      {/* Guruhlar — accordion */}
      {hasGroups && (
        <motion.div className="card"
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
          style={{ padding:18, marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <div className="card-title" style={{ marginBottom:2 }}>Guruhlar</div>
              <div className="card-sub">{t.groups.length} ta · {stats.totalStudents} ta o'quvchi</div>
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)' }}>Bosing → o'quvchilar</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {t.groups.map((g, i) => {
              const isOpen = expandedGroup === g._id;
              const isComplete = g.isComplete ?? (g.pendingStudents?.length === 0);
              const pendingStudents = g.pendingStudents || [];
              return (
                <motion.div key={g._id} layout
                  initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 + i*0.04 }}
                  style={{
                    background:'var(--bg-subtle)',
                    border:`1px solid ${isOpen ? 'var(--primary)' : isComplete ? 'var(--border)' : 'rgba(251,191,36,0.30)'}`,
                    borderRadius:12, overflow:'hidden',
                    transition:'border-color 200ms',
                  }}>
                  <div style={{
                    width:'100%', display:'flex', alignItems:'center', gap:8, padding:'11px 13px',
                  }}>
                    <button onClick={() => onOpenGroup?.(g._id)}
                      disabled={!onOpenGroup}
                      style={{
                        flex:1, display:'flex', alignItems:'center', gap:11,
                        background:'transparent', textAlign:'left', cursor: onOpenGroup ? 'pointer' : 'default',
                        minWidth:0,
                      }}
                      title="Guruh ma'lumotlarini ochish">
                      <div style={{
                        width:36, height:36, borderRadius:10,
                        background: isComplete ? 'var(--primary-bg)' : 'var(--amber-bg)',
                        color:      isComplete ? 'var(--primary-l)' : 'var(--amber)',
                        display:'grid', placeItems:'center', flexShrink:0,
                        border:`1px solid ${isComplete ? 'var(--primary)' : 'rgba(251,191,36,0.4)'}`,
                      }}>
                        <Icon name={isComplete ? 'check' : 'clock'} size={15}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                          <span style={{ fontSize:13.5, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{g.name}</span>
                          {g.code && (
                            <span style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--text-3)', background:'var(--bg-card-s)', padding:'1px 6px', borderRadius:4 }}>
                              {g.code}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize:11.5, color:'var(--text-2)', display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                            <Icon name="user" size={10}/> {g.studentCount} o'quvchi
                          </span>
                          {isComplete
                            ? <span style={{ color:'var(--primary-l)', fontWeight:600 }}>· To'liq belgilangan</span>
                            : <span style={{ color:'var(--amber)', fontWeight:600 }}>· {pendingStudents.length} ta kutmoqda</span>}
                        </div>
                      </div>
                    </button>
                    <button onClick={() => setExpandedGroup(isOpen ? null : g._id)}
                      className="btn btn-ghost btn-icon"
                      style={{ width:32, height:32, flexShrink:0 }}
                      title={isOpen ? 'Yopish' : "Kutmoqdalarni ko'rish"}>
                      <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration:0.2 }}
                        style={{ display:'flex', color:'var(--text-3)' }}>
                        <Icon name="chevronDown" size={14}/>
                      </motion.span>
                    </button>
                  </div>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height:0, opacity:0 }}
                        animate={{ height:'auto', opacity:1 }}
                        exit={{ height:0, opacity:0 }}
                        transition={{ duration:0.22, ease:[0.22,1,0.36,1] }}
                        style={{ overflow:'hidden' }}>
                        <div style={{ padding:'10px 13px 13px', borderTop:'1px solid var(--border)' }}>
                          {g.studentCount === 0 ? (
                            <div style={{ padding:'16px 8px', textAlign:'center', color:'var(--text-3)', fontSize:12.5 }}>
                              Hozircha o'quvchi yo'q
                            </div>
                          ) : isComplete ? (
                            <div style={{ padding:'14px 8px', textAlign:'center', color:'var(--primary-l)', fontSize:12.5, fontWeight:600 }}>
                              ✓ Bu guruhda hamma o'quvchining vazifasi belgilangan
                            </div>
                          ) : (
                            <>
                              <div style={{ fontSize:10.5, fontWeight:700, color:'var(--amber)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:7 }}>
                                Kutilayotgan o'quvchilar
                              </div>
                              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                                {pendingStudents.map(s => (
                                  <div key={s._id}
                                    style={{
                                      display:'flex', alignItems:'center', gap:9,
                                      padding:'8px 10px', borderRadius:9,
                                      background:'var(--bg-card-s)',
                                      border:'1px solid var(--border)',
                                    }}>
                                    {s.photoUrl
                                      ? <img src={s.photoUrl} alt="" style={{ width:30, height:30, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>
                                      : <Avatar name={s.name} hue={s.hue ?? 200} size="sm"/>}
                                    <div style={{ flex:1, minWidth:0 }}>
                                      <div style={{ fontSize:12.5, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.name}</div>
                                      {s.latestHwTitle && (
                                        <div style={{ fontSize:10.5, color:'var(--text-3)', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                          {s.latestHwTitle}
                                        </div>
                                      )}
                                    </div>
                                    <span style={{
                                      background:'var(--amber-bg)', color:'var(--amber)',
                                      fontSize:11.5, fontWeight:700, padding:'3px 9px', borderRadius:7,
                                      flexShrink:0,
                                    }}>
                                      {s.pendingCount} ta
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {!showScore && !hasGroups && acts.length === 0 && (
        <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'var(--text-3)', marginBottom:12 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>📋</div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Hozircha faoliyat yo'q</div>
          <div style={{ fontSize:12.5, marginTop:5 }}>O'qituvchi guruh va vazifa qo'shgach, statistika shu yerda paydo bo'ladi.</div>
        </div>
      )}

      {acts.length > 0 && (
        <motion.div className="card"
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
          style={{ padding:20 }}>
          <div className="card-title" style={{ marginBottom:3 }}>Oxirgi faoliyat</div>
          <div className="card-sub" style={{ marginBottom:16 }}>Oxirgi 48 soat</div>
          <div className="tl">
            {acts.map((a, i) => (
              <motion.div key={i} className="tl-item"
                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.3+i*0.05 }}>
                <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center' }}>
                  <div className="tl-dot" style={{ background: a.tone==='success' ? 'var(--primary-l)' : 'var(--accent-l)' }}/>
                  {i < acts.length-1 && <div className="tl-line"/>}
                </div>
                <div>
                  <div style={{ fontSize:13.5, fontWeight:600 }}>{a.action}</div>
                  <div style={{ fontSize:12.5, color:'var(--text-2)', marginTop:2 }}>{a.detail}</div>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:3 }}>{a.time}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
