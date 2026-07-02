import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Icon, Avatar } from '../components/ui.jsx';
import { Spinner, ErrorBox } from '../components/Feedback.jsx';
import { Modal, Field, Input, Textarea } from '../components/Modal.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useAuth } from '../context/AuthContext.jsx';
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
      <Avatar name={s.name} hue={s.hue ?? 200} size="sm" photoUrl={s.photoUrl}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:600, lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {s.name}
        </div>
        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
          {s.phone || "Qo'lda qo'shilgan"}
        </div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--primary-l)', display:'flex', alignItems:'center', gap:3, justifyContent:'flex-end' }}>
          💎 {s.gems ?? 0}
        </div>
        {s.pendingSubmissions > 0 && (
          <div style={{ fontSize:10.5, color:'var(--amber)', marginTop:2 }}>
            {s.pendingSubmissions} kutmoqda
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
          {fmtDate(hw.dueDate)} · {submissions}/{total} belgilandi
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
      <Avatar name={s.name} hue={s.hue ?? 200} size="sm" photoUrl={s.photoUrl}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {s.name}
        </div>
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

function CloseGroupModal({ open, group, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!group) return null;
  const willClose = group.isActive;
  const submit = async () => {
    setBusy(true); setError('');
    try {
      await api.groups.update(group._id, { isActive: !willClose });
      sfx.success();
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Xatolik');
    } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose}
      title={willClose ? 'Guruhni yopish' : 'Guruhni qayta ochish'}
      subtitle={willClose ? `"${group.name}" — darslar muvaffaqiyatli yakunlandimi?` : `"${group.name}" yana faollashtiriladi`}
      width={420}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Bekor</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}
          style={willClose ? { background:'var(--rose)', border:'none' } : undefined}>
          {busy ? '...' : (willClose ? 'Ha, yopish' : 'Qayta ochish')}
        </button>
      </>}
    >
      {error && (
        <div style={{ marginBottom:12, padding:'10px 12px', background:'var(--rose-bg)', border:'1px solid var(--rose)', borderRadius:8, color:'var(--rose)', fontSize:12.5 }}>
          {error}
        </div>
      )}
      <div style={{ padding:'12px 14px', background:'var(--bg-subtle)', borderRadius:10, fontSize:13, color:'var(--text-2)', lineHeight:1.55 }}>
        {willClose ? (
          <>
            <div style={{ marginBottom:6 }}>Yopilgandan keyin:</div>
            <ul style={{ margin:0, paddingLeft:18 }}>
              <li>Guruhga yangi vazifa avto-yaratilmaydi</li>
              <li>O'quvchilar va statistika saqlanadi (o'chmaydi)</li>
              <li>Istalgan vaqtda qayta ochishingiz mumkin</li>
            </ul>
          </>
        ) : (
          <>Guruh yana faol bo'ladi va dars kunlari avto-vazifa yaratish davom etadi.</>
        )}
      </div>
    </Modal>
  );
}

/* ── Topshirish statistikasi matritsasi — qatorlar=sanalar, ustunlar=o'quvchilar ── */
const MONTHS_SHORT = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];

const CELL_TONE = {
  done:     { bg:'var(--primary-bg)', fg:'var(--emerald-l)', ch:'✓' },
  partial:  { bg:'var(--amber-bg)',   fg:'var(--amber)',     ch:'◑' },
  missed:   { bg:'var(--rose-bg)',    fg:'var(--rose)',      ch:'✕' },
  upcoming: { bg:'transparent',       fg:'var(--text-3)',    ch:'·' },
  none:     { bg:'transparent',       fg:'var(--text-3)',    ch:'–' },
};

function MatrixLegend() {
  const items = [
    { tone:'done',    label:'Topshirgan' },
    { tone:'partial', label:'Qisman' },
    { tone:'missed',  label:'Topshirmagan' },
    { tone:'none',    label:"Yo'q / qo'shilmagan" },
  ];
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:10 }}>
      {items.map(it => {
        const c = CELL_TONE[it.tone];
        return (
          <div key={it.tone} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-2)' }}>
            <span style={{
              width:18, height:18, borderRadius:5, background:c.bg, color:c.fg,
              border:'1px solid var(--border)', display:'grid', placeItems:'center',
              fontSize:11, fontWeight:800,
            }}>{c.ch}</span>
            {it.label}
          </div>
        );
      })}
    </div>
  );
}

/* ── Statistikani rangli jadval PNG'ga chizib yuklab olish ── */
const IMG_COLORS = {
  done:     '#12d112', // yashil — topshirgan
  partial:  '#ffe000', // sariq — qisman
  missed:   '#ff2a2a', // qizil — topshirmagan
  upcoming: '#ffffff',
  none:     '#ffffff',
};

function downloadMatrixImage({ students, cols, groupName }) {
  const numW = 58, nameW = 340, dateW = 128, rowH = 50, headH = 64;
  const width  = numW + nameW + dateW * cols.length;
  const height = headH + rowH * students.length;
  const scale  = 2;

  const canvas = document.createElement('canvas');
  canvas.width  = width  * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = '#e9edf0'; ctx.fillRect(0, 0, numW, headH);
  ctx.fillStyle = '#1fdcef'; ctx.fillRect(numW, 0, nameW, headH);
  ctx.fillStyle = '#08343a'; ctx.textAlign = 'center';
  ctx.font = '700 23px Inter, Arial, sans-serif';
  ctx.fillText('Full names', numW + nameW / 2, headH / 2 + 1);
  cols.forEach((c, i) => {
    const x = numW + nameW + i * dateW;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, 0, dateW, headH);
    ctx.fillStyle = '#111'; ctx.font = '600 19px Inter, Arial, sans-serif';
    const label = `${String(c.dom).padStart(2, '0')}.${String(c.month).padStart(2, '0')}`;
    ctx.fillText(label, x + dateW / 2, headH / 2 + 1);
  });

  // Rows
  students.forEach((s, ri) => {
    const y = headH + ri * rowH;
    ctx.fillStyle = '#f4f6f7'; ctx.fillRect(0, y, numW, rowH);
    ctx.fillStyle = '#8a9199'; ctx.font = '500 17px Inter, Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(ri + 1), numW / 2, y + rowH / 2 + 1);

    ctx.fillStyle = '#ffffff'; ctx.fillRect(numW, y, nameW, rowH);
    ctx.fillStyle = '#111'; ctx.font = '600 21px Inter, Arial, sans-serif'; ctx.textAlign = 'left';
    let nm = s.name || '';
    if (ctx.measureText(nm).width > nameW - 26) {
      while (nm.length > 1 && ctx.measureText(nm + '…').width > nameW - 26) nm = nm.slice(0, -1);
      nm += '…';
    }
    ctx.fillText(nm, numW + 14, y + rowH / 2 + 1);

    cols.forEach((c, ci) => {
      const x = numW + nameW + ci * dateW;
      const st = c.cells?.[s._id]?.status || 'none';
      ctx.fillStyle = IMG_COLORS[st] || '#ffffff';
      ctx.fillRect(x, y, dateW, rowH);
    });
  });

  // Grid chiziqlari
  ctx.strokeStyle = '#aeb6bd'; ctx.lineWidth = 1;
  const xs = [0, numW, numW + nameW];
  for (let i = 1; i <= cols.length; i++) xs.push(numW + nameW + i * dateW);
  xs.forEach(x => { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, height); ctx.stroke(); });
  for (let r = 0; r <= students.length; r++) {
    const y = headH + r * rowH;
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(width, y + 0.5); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, 0.5); ctx.lineTo(width, 0.5); ctx.stroke();

  const filename = `${(groupName || 'guruh').replace(/[^\w-]+/g, '_')}_statistika.png`;
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch { /* fallback */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

function SubmissionMatrix({ groupId, groupName }) {
  const { data, loading, error, refetch } = useFetch(() => api.groups.submissionMatrix(groupId), [groupId]);

  if (loading) return <div style={{ padding:'30px 0' }}><Spinner/></div>;
  if (error)   return <ErrorBox message={error} onRetry={refetch}/>;

  const students = data?.students || [];
  // Server sanalarni o'sish tartibida (eng eski → eng yangi) qaytaradi.
  // Jadvalda sanalar ustun bo'lib, chapdan o'ngga eski→yangi tartibda chiqadi.
  const cols     = data?.rows     || [];
  const summary  = data?.summary  || {};

  if (students.length === 0) {
    return (
      <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--text-3)' }}>
        <div style={{ fontSize:36, marginBottom:8 }}>👥</div>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Hozircha o'quvchi yo'q</div>
      </div>
    );
  }
  if (cols.length === 0) {
    return (
      <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--text-3)' }}>
        <div style={{ fontSize:36, marginBottom:8 }}>📊</div>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Hali vazifa berilmagan</div>
        <div style={{ fontSize:12.5, marginTop:5 }}>Dars kunlari vazifa yaratilgach, statistika shu yerda chiqadi.</div>
      </div>
    );
  }

  const cellBase = {
    width:40, minWidth:40, textAlign:'center', padding:'5px 0',
    borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)',
  };
  // Qator boshi — o'quvchi ism-familyasi (chapda yopishib turadi)
  const nameCellStyle = {
    position:'sticky', left:0, zIndex:1, background:'var(--bg-card)',
    padding:'6px 12px', whiteSpace:'nowrap', minWidth:160, maxWidth:200,
    borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)',
    textAlign:'left',
  };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:4 }}>
        <MatrixLegend/>
        <button className="btn btn-primary" style={{ flexShrink:0 }}
          onClick={() => downloadMatrixImage({ students, cols, groupName })}>
          <Icon name="download" size={14} style={{ marginRight:6, verticalAlign:-2 }}/>
          📷 Rasm yuklab olish
        </button>
      </div>
      <div className="card" style={{ padding:0, overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', width:'100%', fontSize:12 }}>
          <thead>
            <tr>
              <th style={{ ...nameCellStyle, zIndex:3, top:0, fontSize:11, color:'var(--text-3)', fontWeight:700 }}>
                O'quvchi
              </th>
              {cols.map(c => (
                <th key={c.key} title={`${c.dom} ${MONTHS_SHORT[(c.month ?? 1) - 1]} · ${c.dow}`}
                  style={{ ...cellBase, padding:'7px 0 6px', verticalAlign:'bottom' }}>
                  <div style={{ fontSize:11.5, fontWeight:700, color:'var(--text-1)' }}>
                    {c.dom} {MONTHS_SHORT[(c.month ?? 1) - 1]}
                  </div>
                  <div style={{ fontSize:9.5, color:'var(--text-3)' }}>{c.dow}</div>
                </th>
              ))}
              <th style={{ ...cellBase, padding:'7px 6px', minWidth:54, fontSize:10.5, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                Foiz
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => {
              const sm = summary[s._id] || {};
              const rate = sm.rate;
              const rateColor = rate == null ? 'var(--text-3)' : rate >= 70 ? 'var(--emerald-l)' : rate >= 40 ? 'var(--amber)' : 'var(--rose)';
              return (
                <tr key={s._id}>
                  <td style={nameCellStyle}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <Avatar name={s.name} hue={s.hue ?? 200} size="xs" photoUrl={s.photoUrl}/>
                      <span style={{
                        fontSize:12.5, fontWeight:600, color:'var(--text-1)',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      }}>{s.name}</span>
                    </div>
                  </td>
                  {cols.map(c => {
                    const cell = c.cells?.[s._id];
                    const tone = CELL_TONE[cell?.status || 'none'] || CELL_TONE.none;
                    const tip  = cell?.total ? `${cell.done || 0}/${cell.total}` : '';
                    return (
                      <td key={c.key} title={tip} style={cellBase}>
                        <span style={{
                          display:'inline-grid', placeItems:'center',
                          width:24, height:24, borderRadius:6,
                          background:tone.bg, color:tone.fg, fontSize:13, fontWeight:800,
                        }}>{tone.ch}</span>
                      </td>
                    );
                  })}
                  <td title={`${sm.done||0} topshirgan · ${sm.missed||0} topshirmagan`}
                    style={{ ...cellBase, padding:'7px 6px' }}>
                    <span style={{ fontSize:11.5, fontWeight:800, color:rateColor }}>
                      {rate == null ? '–' : `${rate}%`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Qo'lda o'quvchi qo'shish ── */
function AddStudentModal({ open, group, onClose, onDone }) {
  const [form, setForm] = useState({ name:'', phone:'', notes:'' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true); setError('');
    try {
      await api.students.create({
        name: form.name.trim(),
        group: group._id,
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      sfx.success();
      setForm({ name:'', phone:'', notes:'' });
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Xatolik');
    } finally { setBusy(false); }
  };

  if (!group) return null;
  return (
    <Modal open={open} onClose={onClose}
      title="O'quvchi qo'shish"
      subtitle={`"${group.name}" guruhiga yangi o'quvchi`}
      width={440}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Bekor</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy || !form.name.trim()}>
          {busy ? 'Qo\'shilmoqda...' : 'Qo\'shish'}
        </button>
      </>}>
      {error && (
        <div style={{ marginBottom:12, padding:'10px 12px', background:'var(--rose-bg)', border:'1px solid var(--rose)', borderRadius:8, color:'var(--rose)', fontSize:12.5 }}>
          {error}
        </div>
      )}
      <Field label="Ism familya">
        <Input value={form.name} onChange={e=>upd('name', e.target.value)} placeholder="Ali Valiyev" autoFocus/>
      </Field>
      <Field label="Telefon (ixtiyoriy)">
        <Input value={form.phone} onChange={e=>upd('phone', e.target.value)} placeholder="+998 90 ..."/>
      </Field>
      <Field label="Eslatma (ixtiyoriy)">
        <Textarea value={form.notes} onChange={e=>upd('notes', e.target.value)} maxLength={500}/>
      </Field>
    </Modal>
  );
}

export default function GroupDetailPage({ groupId, onBack, onOpenStudent, onOpenHomework, onOpenTeacher }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('students');
  const [busyPending, setBusyPending] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
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

  const students  = g?.studentList || [];
  const homework  = g?.homework    || [];
  // Pending o'quvchilarni faqat guruh teacher'i ko'rib tasdiqlay oladi (admin emas).
  const pending   = isAdmin ? [] : (g?.pendingStudents || []);
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
              {!g.isActive && (
                <span className="chip" style={{ background:'var(--rose-bg)', color:'var(--rose)', fontSize:10.5, fontWeight:700 }}>
                  <Icon name="check" size={10}/> Yopilgan
                </span>
              )}
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
                <Avatar name={g.teacher.name} hue={g.teacher.hue} size="sm" photoUrl={g.teacher.photoUrl}/>
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
        <StatTile icon="homework" tone="amber"   label="Kutilmoqda"     value={pendingHwCount}/>
        <StatTile icon="check"    tone="emerald" label="Tugatildi"   value={stats.completedHw}/>
      </div>

      {/* Guruhni yopish / qayta ochish — teacher va admin uchun */}
      <div style={{ marginBottom:12 }}>
        {g.isActive ? (
          <button onClick={() => setCloseOpen(true)}
            style={{
              width:'100%', padding:'12px 14px', borderRadius:12,
              background:'var(--rose-bg)', color:'var(--rose)',
              border:'1px solid rgba(244,63,94,0.30)',
              fontSize:13.5, fontWeight:600, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>
            <Icon name="check" size={14}/> Darslar tugadi — guruhni yopish
          </button>
        ) : (
          <button onClick={() => setCloseOpen(true)}
            style={{
              width:'100%', padding:'12px 14px', borderRadius:12,
              background:'var(--primary-bg)', color:'var(--primary-l)',
              border:'1px solid rgba(99,102,241,0.30)',
              fontSize:13.5, fontWeight:600, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>
            <Icon name="plus" size={14}/> Guruhni qayta ochish
          </button>
        )}
      </div>

      {/* O'quvchi qo'shish — admin yoki guruh o'qituvchisi qo'lda qo'shadi */}
      <div style={{ marginBottom:12 }}>
        <button onClick={() => setAddOpen(true)}
          style={{
            width:'100%', padding:'12px 14px', borderRadius:12,
            background:'var(--primary-bg)', color:'var(--primary-l)',
            border:'1px solid rgba(99,102,241,0.30)',
            fontSize:13.5, fontWeight:600, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          }}>
          <Icon name="plus" size={14}/> O'quvchi qo'shish
        </button>
      </div>

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
        <button className={`tab ${tab==='stats'?'active':''}`} onClick={() => setTab('stats')}>
          <Icon name="activity" size={12} style={{ marginRight:4, verticalAlign:-1 }}/> Statistika
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
            <div style={{ fontSize:12.5, marginTop:5 }}>Yuqoridagi "O'quvchi qo'shish" tugmasi orqali qo'shing.</div>
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
      ) : tab === 'stats' ? (
        <SubmissionMatrix groupId={groupId} groupName={g.name}/>
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

      <CloseGroupModal
        open={closeOpen}
        group={g}
        onClose={() => setCloseOpen(false)}
        onDone={refetch}
      />

      <AddStudentModal
        open={addOpen}
        group={g}
        onClose={() => setAddOpen(false)}
        onDone={refetch}
      />
    </motion.div>
  );
}
