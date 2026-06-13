import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Avatar, StatusDot, TgUsername } from '../components/ui.jsx';
import { Spinner, ErrorBox } from '../components/Feedback.jsx';
import { Modal, Field, Input, Select, Textarea } from '../components/Modal.jsx';
import { useFetch } from '../hooks/useFetch.js';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const DAYS = [
  { id:'mon', label:'Du' },{ id:'tue', label:'Se' },{ id:'wed', label:'Ch' },
  { id:'thu', label:'Pa' },{ id:'fri', label:'Ju' },{ id:'sat', label:'Sh' },{ id:'sun', label:'Ya' },
];
const dayLabels = (days = []) => DAYS.filter(d => days.includes(d.id)).map(d => d.label).join(' · ');
const LVL_LABEL = { Beginner:"Boshlang'ich", Intermediate:"O'rta", Advanced:'Yuqori', Olympiad:'Olimpiada' };

const PRAISE_TEMPLATES = [
  "Vazifani juda yaxshi bajarding, rahmat! 👏",
  "Yaqinda sezilarli o'sish ko'rsatyapsan — davom et!",
  "Bugungi javobing ajoyib edi. 👍",
];

function MessageModal({ open, onClose, student, kind = 'message' }) {
  const [text, setText]       = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const reset = () => { setText(''); setError(''); setDone(false); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!text.trim()) return;
    setError(''); setSending(true);
    try {
      await api.students.message(student._id, { text: text.trim(), kind });
      setDone(true);
      setTimeout(close, 1100);
    } catch (e) {
      setError(e.message || "Yuborib bo'lmadi");
    } finally { setSending(false); }
  };

  if (!student) return null;
  const title = kind === 'praise' ? 'Maqtash' : 'Yozish';
  const handle = student.telegramUsername ? `@${student.telegramUsername}` : null;

  return (
    <Modal open={open} onClose={close}
      title={title}
      subtitle={`${student.name}${handle ? ' · '+handle : ''} — Telegram orqali yuboriladi`}
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

function EditModal({ open, onClose, student, onSaved }) {
  const [form, setForm] = useState(() => student ? {
    name: student.name || '',
    phone: student.phone || '',
    notes: student.notes || '',
    status: student.status || 'active',
    score: student.score ?? 0,
    attendance: student.attendance ?? 100,
    homeworkRate: student.homeworkRate ?? 0,
  } : {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(''); setSaving(true);
    try {
      const payload = {
        ...form,
        score: Number(form.score),
        attendance: Number(form.attendance),
        homeworkRate: Number(form.homeworkRate),
      };
      await api.students.update(student._id, payload);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Xatolik');
    } finally { setSaving(false); }
  };

  if (!student) return null;
  return (
    <Modal open={open} onClose={onClose}
      title="O'quvchini tahrirlash"
      width={460}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Bekor qilish</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </>}>
      {error && <div style={{ marginBottom:12, padding:'10px 12px', background:'var(--rose-bg)', borderRadius:8, color:'var(--rose)', fontSize:12.5 }}>{error}</div>}
      <Field label="Ism">
        <Input value={form.name || ''} onChange={e=>upd('name', e.target.value)}/>
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Field label="Telefon"><Input value={form.phone || ''} onChange={e=>upd('phone', e.target.value)} placeholder="+998 90 ..."/></Field>
        <Field label="Status">
          <Select value={form.status || 'active'} onChange={e=>upd('status', e.target.value)}>
            <option value="active">Faol</option>
            <option value="inactive">Faol emas</option>
            <option value="suspended">To'xtatilgan</option>
          </Select>
        </Field>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
        <Field label="Ball"><Input type="number" min="0" max="100" value={form.score ?? 0} onChange={e=>upd('score', e.target.value)}/></Field>
        <Field label="Davomat %"><Input type="number" min="0" max="100" value={form.attendance ?? 0} onChange={e=>upd('attendance', e.target.value)}/></Field>
        <Field label="Vazifa %"><Input type="number" min="0" max="100" value={form.homeworkRate ?? 0} onChange={e=>upd('homeworkRate', e.target.value)}/></Field>
      </div>
      <Field label="Eslatma (ixtiyoriy)">
        <Textarea value={form.notes || ''} onChange={e=>upd('notes', e.target.value)} maxLength={500}/>
      </Field>
    </Modal>
  );
}

export default function StudentDetailPage({ studentId, onBack }) {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const canEdit = user?.role === 'admin' || isTeacher;
  const [editOpen, setEditOpen] = useState(false);
  const [msgKind, setMsgKind] = useState(null); // 'message' | 'praise' | null
  const { data: s, loading, error, refetch } = useFetch(() => api.students.get(studentId), [studentId]);

  if (loading) return <div className="page"><Spinner/></div>;
  if (error || !s) return <div className="page"><ErrorBox message={error || 'Topilmadi'} onRetry={refetch}/></div>;

  const stats = [
    { label: '💎 Olmos (jami)',    val: s.gems ?? 0,         suffix: '',     accent: true },
    { label: '💎 Bu hafta',        val: s.gemsThisWeek ?? 0, suffix: '',     accent: true },
    { label: 'Vazifa',             val: s.homeworkRate,      suffix: '%' },
  ];

  const remove = async () => {
    if (!confirm(`${s.name} ni o'chirishni tasdiqlang?`)) return;
    try {
      await api.students.delete(s._id);
      onBack?.();
    } catch (e) { alert(e.message); }
  };

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.35 }}>
      <div style={{ marginBottom:14 }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ padding:'0 10px' }}>
          <Icon name="chevronLeft" size={14}/> Orqaga
        </button>
      </div>

      {/* Hero */}
      <motion.div className="card-glass"
        initial={{ opacity:0, scale:0.97 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.05, duration:0.4 }}
        style={{ padding:20, marginBottom:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at top right, oklch(0.74 0.16 ${s.hue} / 0.20), transparent 55%)`, pointerEvents:'none' }}/>
        <div style={{ display:'flex', alignItems:'center', gap:14, position:'relative', flexWrap:'wrap' }}>
          {s.photoUrl ? (
            <img src={s.photoUrl} alt={s.name}
              style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>
          ) : (
            <Avatar name={s.name} hue={s.hue} size="xl"/>
          )}
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
              <h2 style={{ fontFamily:'var(--display)', fontSize:22, fontWeight:700, letterSpacing:'-0.04em' }}>{s.name}</h2>
              <span className={`chip ${s.status==='active'?'chip-success':'chip-neutral'}`}>
                <StatusDot status={s.status}/> {s.status === 'active' ? 'Faol' : s.status === 'suspended' ? "To'xtatilgan" : 'Faol emas'}
              </span>
            </div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:8 }}>
              {s.group?.name && <>Guruh: <b style={{ color:'var(--text)' }}>{s.group.name}</b></>}
              {s.group?.code && <> · <code style={{ fontFamily:'var(--mono)', fontSize:11.5 }}>{s.group.code}</code></>}
              {s.group?.level && <> · {LVL_LABEL[s.group.level] || s.group.level}</>}
            </div>
            <div style={{ display:'flex', gap:14, fontSize:12, color:'var(--text-2)', flexWrap:'wrap' }}>
              {s.telegramUsername && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Icon name="user" size={12}/><TgUsername username={s.telegramUsername}/></span>}
              {s.phone && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Icon name="phone" size={12}/>{s.phone}</span>}
              {s.joinedAt && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Icon name="calendar" size={12}/>{new Date(s.joinedAt).toLocaleDateString('uz-UZ')}</span>}
            </div>
          </div>
          {canEdit && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {isTeacher && (
                <>
                  <button className="btn btn-secondary"
                    onClick={() => setMsgKind('message')}
                    disabled={!s.telegramId}
                    title={!s.telegramId ? "O'quvchining Telegram akkaunti yo'q" : ''}>
                    <Icon name="send" size={13}/> Yozish
                  </button>
                  <button className="btn btn-primary"
                    onClick={() => setMsgKind('praise')}
                    disabled={!s.telegramId}
                    title={!s.telegramId ? "O'quvchining Telegram akkaunti yo'q" : ''}>
                    <Icon name="sparkles" size={13}/> Maqtash
                  </button>
                </>
              )}
              <button className="btn btn-secondary" onClick={() => setEditOpen(true)}>
                <Icon name="settings" size={13}/> Tahrirlash
              </button>
              <button className="btn btn-ghost btn-icon" style={{ color:'var(--rose)' }} onClick={remove}>
                <Icon name="alert" size={13}/>
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <MessageModal
        open={!!msgKind}
        kind={msgKind}
        student={s}
        onClose={() => setMsgKind(null)}/>

      {/* Stats */}
      <motion.div
        initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
        style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10, marginBottom:14 }}>
        {stats.map((st, i) => (
          <div key={st.label} className="card" style={{
            padding:'14px 16px',
            background: st.accent ? 'var(--primary-bg)' : undefined,
            border: st.accent ? '1px solid var(--primary)' : '1px solid var(--border)',
          }}>
            <div style={{
              fontSize:11, fontWeight:600,
              color: st.accent ? 'var(--primary-l)' : 'var(--text-3)',
              textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8,
            }}>
              {st.label}
            </div>
            <div style={{
              fontFamily:'var(--display)', fontSize:30, fontWeight:700, letterSpacing:'-0.04em',
              color: st.accent ? 'var(--primary-l)' : 'var(--text)', lineHeight:1,
            }}>
              {st.val ?? 0}<span style={{ fontSize:14, color:'var(--text-3)' }}>{st.suffix}</span>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Group info */}
      {s.group && (
        <motion.div className="card"
          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}
          style={{ padding:18, marginBottom:14 }}>
          <div className="card-title" style={{ marginBottom:12 }}>Guruh ma'lumotlari</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span style={{ color:'var(--text-2)' }}>Guruh nomi</span>
              <span style={{ fontWeight:600 }}>{s.group.name}</span>
            </div>
            {s.group.code && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                <span style={{ color:'var(--text-2)' }}>Kod</span>
                <code style={{ fontFamily:'var(--mono)', fontSize:12 }}>{s.group.code}</code>
              </div>
            )}
            {s.group.scheduleDays?.length > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                <span style={{ color:'var(--text-2)' }}>Dars kunlari</span>
                <span style={{ fontWeight:600 }}>{dayLabels(s.group.scheduleDays)}</span>
              </div>
            )}
            {s.group.scheduleTime && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                <span style={{ color:'var(--text-2)' }}>Dars vaqti</span>
                <span style={{ fontWeight:600 }}>{s.group.scheduleTime}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Teacher info */}
      {s.teacher && (
        <motion.div className="card"
          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
          style={{ padding:18, marginBottom:14 }}>
          <div className="card-title" style={{ marginBottom:12 }}>O'qituvchi</div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Avatar name={s.teacher.name} hue={s.teacher.hue} size="md" photoUrl={s.teacher.photoUrl}/>
            <div>
              <div style={{ fontSize:14, fontWeight:600 }}>{s.teacher.name}</div>
              {s.teacher.subject && <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>{s.teacher.subject}</div>}
            </div>
          </div>
        </motion.div>
      )}

      {/* Notes */}
      {s.notes && (
        <motion.div className="card"
          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 }}
          style={{ padding:18 }}>
          <div className="card-title" style={{ marginBottom:8 }}>Eslatma</div>
          <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{s.notes}</div>
        </motion.div>
      )}

      <EditModal
        open={editOpen}
        student={s}
        onClose={() => setEditOpen(false)}
        onSaved={refetch}/>
    </motion.div>
  );
}
