import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Avatar, StatusDot } from '../components/ui.jsx';
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

function EditModal({ open, onClose, student, onSaved }) {
  const [form, setForm] = useState(() => student ? {
    name: student.name || '',
    phone: student.phone || '',
    notes: student.notes || '',
    status: student.status || 'active',
  } : {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(''); setSaving(true);
    try {
      const payload = { ...form };
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
      <Field label="Eslatma (ixtiyoriy)">
        <Textarea value={form.notes || ''} onChange={e=>upd('notes', e.target.value)} maxLength={500}/>
      </Field>
    </Modal>
  );
}

/* ── To'liq statistika — olmoslar va vazifa holati (jadval) ── */
const SUB_TONE = {
  done:      { bg:'var(--primary-bg)', fg:'var(--emerald-l)', bar:'var(--emerald)', label:'Topshirgan',   ch:'✓' },
  submitted: { bg:'var(--amber-bg)',   fg:'var(--amber)',     bar:'var(--amber)',   label:'Tekshiruvda',  ch:'⏳' },
  returned:  { bg:'var(--amber-bg)',   fg:'var(--amber)',     bar:'#f59e0b',        label:'Qaytarilgan',  ch:'↩' },
  missed:    { bg:'var(--rose-bg)',    fg:'var(--rose)',      bar:'var(--rose)',    label:'Topshirmagan', ch:'✕' },
  upcoming:  { bg:'transparent',       fg:'var(--text-3)',    bar:'var(--text-3)',  label:'Kutilmoqda',   ch:'·' },
};

function StudentStats({ studentId }) {
  const { data, loading, error, refetch } = useFetch(() => api.students.stats(studentId), [studentId]);

  if (loading) return <div className="card" style={{ padding:30 }}><Spinner/></div>;
  if (error)   return <ErrorBox message={error} onRetry={refetch}/>;

  const { totals = {}, gems = 0, gemsThisWeek = 0, gemsFromHw = 0 } = data || {};
  const order = ['done','submitted','returned','missed','upcoming'];
  const total = totals.total || 0;

  const rowStyle = { borderTop:'1px solid var(--border)' };
  const tdLabel  = { padding:'11px 16px', fontSize:13, color:'var(--text-2)' };
  const tdVal    = { padding:'11px 16px', fontSize:13.5, fontWeight:700, textAlign:'right',
                     fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Olmoslar */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div className="card-title" style={{ padding:'14px 16px 10px' }}>💎 Olmoslar</div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <tbody>
            <tr style={rowStyle}><td style={tdLabel}>Jami olmos</td><td style={{ ...tdVal, color:'var(--primary-l)' }}>{gems}</td></tr>
            <tr style={rowStyle}><td style={tdLabel}>Bu hafta</td><td style={tdVal}>{gemsThisWeek}</td></tr>
            <tr style={rowStyle}><td style={tdLabel}>Vazifalardan yig'ilgan</td><td style={tdVal}>{gemsFromHw}</td></tr>
          </tbody>
        </table>
      </div>

      {/* Vazifa holati statistikasi */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div className="card-title" style={{ padding:'14px 16px 10px' }}>Vazifa holati</div>
        {total === 0 ? (
          <div style={{ padding:'4px 16px 16px', fontSize:13, color:'var(--text-3)' }}>
            Hozircha vazifa biriktirilmagan.
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <tbody>
              {order.map(k => {
                const tone = SUB_TONE[k];
                return (
                  <tr key={k} style={rowStyle}>
                    <td style={tdLabel}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:9 }}>
                        <span style={{
                          display:'inline-grid', placeItems:'center', width:22, height:22, borderRadius:6,
                          background:tone.bg, color:tone.fg, fontSize:12, fontWeight:800,
                        }}>{tone.ch}</span>
                        {tone.label}
                      </span>
                    </td>
                    <td style={{ ...tdVal, color:tone.fg }}>{totals[k] || 0} marta</td>
                  </tr>
                );
              })}
              <tr style={{ ...rowStyle, background:'var(--bg-subtle)' }}>
                <td style={{ ...tdLabel, fontWeight:700, color:'var(--text)' }}>Jami</td>
                <td style={tdVal}>{total} marta</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function StudentDetailPage({ studentId, onBack }) {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const canEdit = user?.role === 'admin' || isTeacher;
  const [editOpen, setEditOpen] = useState(false);
  const { data: s, loading, error, refetch } = useFetch(() => api.students.get(studentId), [studentId]);

  if (loading) return <div className="page"><Spinner/></div>;
  if (error || !s) return <div className="page"><ErrorBox message={error || 'Topilmadi'} onRetry={refetch}/></div>;

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
          <Avatar name={s.name} hue={s.hue} size="xl" photoUrl={s.photoUrl}/>
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
              {s.phone && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Icon name="phone" size={12}/>{s.phone}</span>}
              {s.joinedAt && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Icon name="calendar" size={12}/>{new Date(s.joinedAt).toLocaleDateString('uz-UZ')}</span>}
            </div>
          </div>
          {canEdit && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
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

      {/* To'liq statistika */}
      <motion.div
        initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.12 }}
        style={{ marginBottom:14 }}>
        <StudentStats studentId={s._id}/>
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
