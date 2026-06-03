import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Avatar, StatusDot } from '../components/ui.jsx';
import { Spinner, ErrorBox, listContainer, listItem } from '../components/Feedback.jsx';
import { Modal, Field, Input, Select } from '../components/Modal.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import InvitesPage     from './Invites.jsx';
import PendingUsersPage from './PendingUsers.jsx';
import StudentsPage    from './Students.jsx';

/* Telegram-style "oxirgi ko'rilgan" matn */
function formatLastSeen(lastSeenAt, presence) {
  if (presence === 'online') return null;
  if (!lastSeenAt) return "ancha vaqt oldin";
  return formatRelative(lastSeenAt);
}

/* Umumiy "X vaqt oldin" matnchasi */
function formatRelative(ts) {
  if (!ts) return null;
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1)    return "hozirgina";
  if (min < 60)   return `${min} daqiqa oldin`;
  const hr = Math.floor(min / 60);
  if (hr < 24)    return `${hr} soat oldin`;
  const days = Math.floor(hr / 24);
  if (days === 1) return "kecha";
  if (days < 7)   return `${days} kun oldin`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4)  return `${weeks} hafta oldin`;
  return new Date(ts).toLocaleDateString('uz-UZ', { day:'numeric', month:'short' });
}

const PRESENCE_COLOR = {
  online: '#34d399',   // emerald — faol
  recent: '#fbbf24',   // amber — yaqinda
  offline:'#64748b',   // slate-gray — offline
};
const PRESENCE_LABEL = {
  online: 'onlayn',
  recent: 'yaqinda onlayn edi',
  offline:'oflayn',
};

function TeacherEditForm({ open, onClose, initial, onSaved }) {
  const [name, setName] = useState(initial?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => { setName(initial?.name || ''); }, [initial?._id]);

  const submit = async () => {
    setError(''); setSaving(true);
    try {
      await api.teachers.update(initial._id, { name: name.trim() });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Saqlashda xatolik');
    } finally { setSaving(false); }
  };

  if (!initial) return null;
  const handle = initial.telegramUsername ? `@${initial.telegramUsername}` : null;

  return (
    <Modal
      open={open} onClose={onClose}
      title="O'qituvchini tahrirlash"
      width={420}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Bekor qilish</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving || !name.trim()}>
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </>}
    >
      {error && (
        <div style={{ marginBottom:12, padding:'10px 12px', background:'var(--rose-bg)', border:'1px solid var(--rose)', borderRadius:8, color:'var(--rose)', fontSize:12.5 }}>
          {error}
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18, padding:'14px', background:'var(--bg-subtle)', borderRadius:10 }}>
        <Avatar name={name || '?'} hue={initial.hue ?? 200} size="lg" photoUrl={initial.photoUrl}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:600 }}>{name || '—'}</div>
          <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
            {handle || "Telegram username yo'q"}
          </div>
        </div>
      </div>

      <Field label="Ism Familiya">
        <Input value={name} onChange={e=>setName(e.target.value)} placeholder="Aziza Karimova" autoFocus/>
      </Field>
    </Modal>
  );
}

function ReassignDeleteModal({ open, target, candidates, onClose, onDone }) {
  const [reassignTo, setReassignTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setReassignTo(''); setError(''); }, [target?._id, open]);

  if (!target) return null;
  const groupCount = target.groups?.length ?? 0;
  const options = candidates.filter(c => String(c._id) !== String(target._id));

  const submit = async () => {
    if (groupCount > 0 && !reassignTo) {
      setError("Yangi o'qituvchini tanlang");
      return;
    }
    setBusy(true); setError('');
    try {
      await api.teachers.delete(target._id, groupCount > 0 ? reassignTo : undefined);
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Xatolik');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={`"${target.name}" ni o'chirish`}
      subtitle={groupCount > 0
        ? `${groupCount} ta guruh boshqa o'qituvchiga o'tkaziladi`
        : "Bu o'qituvchining guruhi yo'q"}
      width={440}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Bekor qilish</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}
          style={{ background:'var(--rose)', border:'none' }}>
          {busy ? "O'chirilmoqda..." : "O'chirish"}
        </button>
      </>}
    >
      {error && (
        <div style={{ marginBottom:12, padding:'10px 12px', background:'var(--rose-bg)', border:'1px solid var(--rose)', borderRadius:8, color:'var(--rose)', fontSize:12.5 }}>
          {error}
        </div>
      )}

      {groupCount > 0 ? (
        <>
          <div style={{ marginBottom:14, padding:'10px 12px', background:'var(--amber-bg)', border:'1px solid rgba(251,191,36,0.30)', borderRadius:10, fontSize:12.5, color:'var(--text-2)', lineHeight:1.5 }}>
            <Icon name="alert" size={12} style={{ verticalAlign:-1, marginRight:5, color:'var(--amber)' }}/>
            Guruhlar, vazifalar, o'quvchilar va topshiriqlar — hammasi tanlangan o'qituvchiga o'tadi.
          </div>
          <Field label="Yangi mas'ul o'qituvchi">
            {options.length === 0 ? (
              <div style={{ padding:'10px 12px', background:'var(--bg-subtle)', borderRadius:8, color:'var(--text-3)', fontSize:12.5 }}>
                Boshqa o'qituvchi yo'q — avval yangi o'qituvchi qo'shing.
              </div>
            ) : (
              <Select value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
                <option value="">— Tanlang —</option>
                {options.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name} {c.subject ? `· ${c.subject}` : ''} {c.groups?.length ? `(${c.groups.length} guruh)` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </>
      ) : (
        <div style={{ padding:'12px 14px', background:'var(--bg-subtle)', borderRadius:10, fontSize:12.5, color:'var(--text-2)' }}>
          O'qituvchi va uning hisobi (login) butunlay o'chiriladi.
        </div>
      )}
    </Modal>
  );
}

const REVIEW_LABEL = {
  reviewed:   'Hammasi belgilangan',
  partial:    'Chala tekshirgan',
  unreviewed: 'Kutilmoqda',
  'no-tasks': 'Vazifa yo\'q',
};
const REVIEW_CHIP = {
  reviewed:   'chip-success',
  partial:    'chip-warning',
  unreviewed: 'chip-danger',
  'no-tasks': 'chip-neutral',
};
const REVIEW_ICON = {
  reviewed:   'check',
  partial:    'alert',
  unreviewed: 'alert',
  'no-tasks': 'clock',
};

function ReviewStatusChip({ status, hw }) {
  const s = status || 'no-tasks';
  return (
    <span className={`chip ${REVIEW_CHIP[s]}`} style={{ fontSize:10.5 }}>
      <Icon name={REVIEW_ICON[s]} size={10}/>
      {REVIEW_LABEL[s]}
      {hw && (s === 'partial' || s === 'unreviewed') && hw.pending > 0 && (
        <span style={{ opacity:0.85, marginLeft:3 }}>· {hw.pending}</span>
      )}
    </span>
  );
}

/* Card-style aksiyalar menyusi (3 nuqta) */
function RowMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);
  return (
    <div ref={wrapRef} style={{ position:'relative' }} onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(o => !o)}
        className="btn btn-ghost btn-icon" style={{ width:30, height:30 }}>
        <Icon name="moreH" size={14}/>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity:0, scale:0.92, y:-4 }}
            animate={{ opacity:1, scale:1, y:0 }}
            exit={{ opacity:0, scale:0.92, y:-4 }}
            transition={{ duration:0.14, ease:[0.22,1,0.36,1] }}
            style={{
              position:'absolute', top:36, right:0,
              background:'var(--bg-2)', border:'1px solid var(--border-md)',
              borderRadius:10, boxShadow:'var(--shadow-lg)', padding:5,
              minWidth:150, zIndex:50,
            }}>
            <button onClick={() => { setOpen(false); onEdit?.(); }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', width:'100%', textAlign:'left',
                background:'transparent', borderRadius:6, color:'var(--text)', fontSize:13 }}>
              <Icon name="settings" size={13}/> Tahrirlash
            </button>
            <button onClick={() => { setOpen(false); onDelete?.(); }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', width:'100%', textAlign:'left',
                background:'transparent', borderRadius:6, color:'var(--rose)', fontSize:13 }}>
              <Icon name="alert" size={13}/> O'chirish
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Telegram-style chat-list qatori */
function TeacherChatRow({ t, onClick, onEdit, onDelete }) {
  const presence = t.presence || 'offline';
  const lastSeenText = formatLastSeen(t.lastSeenAt, presence);
  const dotColor = PRESENCE_COLOR[presence];

  return (
    <motion.div
      variants={listItem}
      whileHover={{ background:'var(--bg-subtle)' }}
      onClick={onClick}
      className="tg-row"
      style={{
        display:'flex', alignItems:'center', gap:13,
        padding:'10px 12px', borderRadius:12,
        cursor:'pointer', position:'relative',
        borderBottom:'1px solid var(--border)',
      }}
    >
      {/* Avatar + online dot */}
      <div style={{ position:'relative', flexShrink:0 }}>
        <Avatar name={t.name} hue={t.hue} size="lg" photoUrl={t.photoUrl}/>
        <span style={{
          position:'absolute', bottom:1, right:1,
          width:13, height:13, borderRadius:'50%',
          background:dotColor,
          border:'2.5px solid var(--bg-2)',
          boxShadow: presence === 'online' ? `0 0 8px ${dotColor}88` : 'none',
        }}/>
      </div>

      {/* Markaz: ism + status matni */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:3 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:7, minWidth:0 }}>
            <span style={{ fontSize:14.5, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', letterSpacing:'-0.01em' }}>
              {t.name}
            </span>
            {t.telegramUsername ? (
              <span style={{ fontSize:11.5, color:'var(--primary-l)', fontWeight:500, whiteSpace:'nowrap', flexShrink:0 }}>
                @{t.telegramUsername}
              </span>
            ) : t.telegramId ? (
              <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:500, whiteSpace:'nowrap', flexShrink:0 }}>
                ID {t.telegramId}
              </span>
            ) : null}
          </div>
          <div style={{ fontSize:11, color: presence === 'online' ? dotColor : 'var(--text-3)', fontWeight: presence === 'online' ? 600 : 500, flexShrink:0 }}>
            {presence === 'online' ? PRESENCE_LABEL.online : (lastSeenText || PRESENCE_LABEL.offline)}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'var(--text-2)', minWidth:0 }}>
          <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0 }}>
            {t.lastReviewedAt
              ? `Oxirgi tekshiruv: ${formatRelative(t.lastReviewedAt)}`
              : <span style={{ color:'var(--text-3)' }}>Hali tekshirmagan</span>}
          </span>
          {(t.homework?.pending > 0) && (
            <>
              <span style={{ color:'var(--text-4)', flexShrink:0 }}>·</span>
              <span style={{ color:'var(--amber)', flexShrink:0, fontWeight:600 }}>
                {t.homework.pending} kutmoqda
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tekshiruv chip + menyu */}
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
        <ReviewStatusChip status={t.reviewStatus} hw={t.homework}/>
        <RowMenu onEdit={onEdit} onDelete={onDelete}/>
      </div>
    </motion.div>
  );
}

function TeacherCard({ t, onClick, onEdit, onDelete }) {
  return (
    <motion.div
      variants={listItem}
      className="card card-hov"
      whileHover={{ y:-3 }}
      transition={{ type:'spring', stiffness:300 }}
      style={{ padding:17, position:'relative', display:'flex', flexDirection:'column', gap:13 }}
    >
      <div style={{ position:'absolute', top:10, right:10, zIndex:2 }}>
        <RowMenu onEdit={onEdit} onDelete={onDelete}/>
      </div>

      <button onClick={onClick}
        style={{ background:'transparent', textAlign:'left', display:'flex', flexDirection:'column', gap:13, padding:0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, paddingRight:32 }}>
          <div style={{ display:'flex', alignItems:'center', gap:11, minWidth:0, flex:1 }}>
            <Avatar name={t.name} hue={t.hue} size="lg" photoUrl={t.photoUrl}/>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, letterSpacing:'-0.01em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.name}</div>
              <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>{t.subject}</div>
              <div style={{ marginTop:5, display:'flex', alignItems:'center', gap:5, fontSize:11.5, color:'var(--text-2)' }}>
                <StatusDot status={t.status}/> {t.status === 'active' ? 'Faol' : 'Faol emas'}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          <ReviewStatusChip status={t.reviewStatus} hw={t.homework}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, width:'100%' }}>
          <div style={{ background:'var(--bg-subtle)', borderRadius:9, padding:'8px 10px' }}>
            <div style={{ fontSize:10.5, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Guruhlar</div>
            <div style={{ fontFamily:'var(--display)', fontSize:18, fontWeight:700, marginTop:2, letterSpacing:'-0.02em' }}>{t.groups?.length ?? 0}</div>
          </div>
          <div style={{ background:'var(--bg-subtle)', borderRadius:9, padding:'8px 10px' }}>
            <div style={{ fontSize:10.5, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Vazifa</div>
            <div style={{ fontFamily:'var(--display)', fontSize:18, fontWeight:700, marginTop:2, letterSpacing:'-0.02em' }}>
              {t.homework?.done ?? 0}
              <span style={{ fontSize:12, color:'var(--text-3)', fontWeight:500 }}>/{t.homework?.total ?? 0}</span>
            </div>
          </div>
        </div>
        {t.score > 0 && (
          <div style={{ width:'100%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7, fontSize:12 }}>
              <span style={{ color:'var(--text-2)' }}>Faollik</span>
              <span style={{ fontWeight:700 }}>{t.score}%</span>
            </div>
            <div className="prog"><div className="prog-fill" style={{ width:`${t.score}%` }}/></div>
          </div>
        )}
      </button>
    </motion.div>
  );
}

function TeachersListView({ onOpenTeacher }) {
  const [filter, setFilter] = useState('all');
  const [view,   setView]   = useState('chat');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const params = useMemo(() => {
    const p = { limit:50 };
    if (filter !== 'all' && filter !== 'problem') p.status = filter;
    if (search) p.search = search;
    return p;
  }, [filter, search]);

  const { data, loading, error, refetch } = useFetch(() => api.teachers.list(params), [JSON.stringify(params)]);
  const teachers = Array.isArray(data) ? data : (data?.data ?? []);
  const isProblem = t => t.reviewStatus === 'unreviewed' || t.reviewStatus === 'partial';
  const preFiltered = filter === 'problem' ? teachers.filter(isProblem) : teachers;
  // Chat ko'rinishida — online'lar tepada
  const PRESENCE_RANK = { online:0, recent:1, offline:2 };
  const filtered = view === 'chat'
    ? [...preFiltered].sort((a, b) => {
        const pa = PRESENCE_RANK[a.presence || 'offline'];
        const pb = PRESENCE_RANK[b.presence || 'offline'];
        if (pa !== pb) return pa - pb;
        return (a.name || '').localeCompare(b.name || '');
      })
    : preFiltered;

  // Avto-refresh — online holatlari real-time yangilanishi uchun
  useEffect(() => {
    const t = setInterval(() => refetch({ silent: true }), 12_000);
    return () => clearInterval(t);
  }, [refetch]);
  const counts = {
    all:      teachers.length,
    active:   teachers.filter(t => t.status === 'active').length,
    inactive: teachers.filter(t => t.status === 'inactive').length,
    problem:  teachers.filter(isProblem).length,
  };

  const openEdit = t => { setEditing(t); setModalOpen(true); };
  const remove = t => setDeleting(t);

  return (
    <>
      <div style={{ display:'flex', gap:10, justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', marginBottom:12 }}>
        <div className="sw">
          <Icon name="search" size={13} color="var(--text-3)"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Qidirish..." style={{ width:160 }}/>
        </div>
        <div className="seg">
          <button className={`seg-btn ${view==='chat'?'active':''}`} onClick={()=>setView('chat')} title="Ro'yxat">
            <Icon name="user" size={13}/>
          </button>
          <button className={`seg-btn ${view==='grid'?'active':''}`} onClick={()=>setView('grid')} title="Kartochka">
            <Icon name="grid" size={13}/>
          </button>
          <button className={`seg-btn ${view==='list'?'active':''}`} onClick={()=>setView('list')} title="Jadval">
            <Icon name="list" size={13}/>
          </button>
        </div>
      </div>

      <div className="tabs">
        {[['all','Hammasi'],['active','Faol'],['problem','Tekshirmagan'],['inactive','Faol emas']].map(([id,lbl]) => (
          <button key={id} className={`tab ${filter===id?'active':''}`} onClick={()=>setFilter(id)}>
            {lbl} <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:4 }}>{counts[id]}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {loading ? <motion.div key="l" exit={{ opacity:0 }}><Spinner/></motion.div>
        : error ? <ErrorBox message={error} onRetry={refetch}/>
        : filtered.length === 0 ? (
          <div style={{ padding:'60px 0', textAlign:'center', color:'var(--text-3)' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>👤</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Hozircha o'qituvchilar yo'q</div>
            <div style={{ fontSize:12.5, marginTop:5 }}>"Takliflar" tabidan invite link yaratib, o'qituvchini taklif qiling.</div>
          </div>
        ) : view === 'chat' ? (
          <motion.div key="c" variants={listContainer} initial="hidden" animate="show"
            className="card" style={{ padding:'4px 0', overflow:'visible', position:'relative' }}>
            {filtered.map(t => (
              <TeacherChatRow key={t._id} t={t}
                onClick={() => onOpenTeacher(t._id)}
                onEdit={() => openEdit(t)}
                onDelete={() => remove(t)}
              />
            ))}
          </motion.div>
        ) : view === 'grid' ? (
          <motion.div key="g" variants={listContainer} initial="hidden" animate="show"
            style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
            {filtered.map(t => (
              <TeacherCard key={t._id} t={t}
                onClick={() => onOpenTeacher(t._id)}
                onEdit={() => openEdit(t)}
                onDelete={() => remove(t)}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div key="l2" initial={{ opacity:0 }} animate={{ opacity:1 }} className="card" style={{ overflow:'hidden' }}>
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr>
                  <th>O'qituvchi</th><th>Predmet</th><th>Guruhlar</th><th>Vazifa</th><th>Tekshiruv</th><th>Faollik</th><th></th>
                </tr></thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t._id}>
                      <td onClick={() => onOpenTeacher(t._id)} style={{ cursor:'pointer' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <Avatar name={t.name} hue={t.hue} size="sm" photoUrl={t.photoUrl}/>
                          <div>
                            <div style={{ fontWeight:600 }}>{t.name}</div>
                            <div style={{ fontSize:11.5, color:'var(--text-3)' }}>
                              {t.telegramUsername ? `@${t.telegramUsername}` : (t.email && !/^tg-[\w-]+@local$/i.test(t.email) ? t.email : '—')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color:'var(--text-2)' }}>{t.subject}</td>
                      <td>{t.groups?.length ?? 0}</td>
                      <td style={{ fontVariantNumeric:'tabular-nums' }}>
                        {t.homework?.done ?? 0}<span style={{ color:'var(--text-3)' }}>/{t.homework?.total ?? 0}</span>
                      </td>
                      <td><ReviewStatusChip status={t.reviewStatus} hw={t.homework}/></td>
                      <td>
                        {t.score > 0 ? (
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div className="prog" style={{ width:60 }}><div className="prog-fill" style={{ width:`${t.score}%` }}/></div>
                            <span style={{ fontWeight:700, fontSize:12 }}>{t.score}%</span>
                          </div>
                        ) : <span style={{ color:'var(--text-3)', fontSize:12 }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="btn btn-ghost btn-icon" style={{ width:28, height:28 }} onClick={() => openEdit(t)}><Icon name="settings" size={13}/></button>
                          <button className="btn btn-ghost btn-icon" style={{ width:28, height:28, color:'var(--rose)' }} onClick={() => remove(t)}><Icon name="alert" size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TeacherEditForm
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSaved={refetch}
      />

      <ReassignDeleteModal
        open={!!deleting}
        target={deleting}
        candidates={teachers}
        onClose={() => setDeleting(null)}
        onDone={refetch}
      />
    </>
  );
}

/* Adminlar ro'yxati — User collection orqali (role: admin, status: active) */
function AdminsListView() {
  const { user: me } = useAuth();
  const { data, loading, error, refetch } = useFetch(
    () => api.users.list({ role:'admin', status:'active' }),
    [],
  );
  const admins = data ?? [];

  const remove = async (u) => {
    if (!confirm(`"${u.name}" ni o'chirishni tasdiqlang?`)) return;
    try { await api.users.delete(u._id); refetch(); }
    catch (e) { alert(e.message); }
  };

  if (loading) return <Spinner/>;
  if (error)   return <ErrorBox message={error} onRetry={refetch}/>;
  if (!admins.length) return (
    <div style={{ padding:'60px 0', textAlign:'center', color:'var(--text-3)' }}>
      <div style={{ fontSize:40, marginBottom:8 }}>🛡️</div>
      <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Hozircha boshqa admin yo'q</div>
      <div style={{ fontSize:12.5, marginTop:5 }}>"Takliflar" tabidan admin uchun invite link yarating.</div>
    </div>
  );

  return (
    <motion.div variants={listContainer} initial="hidden" animate="show"
      className="card" style={{ padding:'4px 0', overflow:'visible' }}>
      {admins.map(u => {
        const isMe = String(me?._id || me?.id) === String(u._id);
        return (
          <motion.div key={u._id} variants={listItem}
            style={{
              display:'flex', alignItems:'center', gap:13,
              padding:'10px 12px',
              borderBottom:'1px solid var(--border)',
            }}>
            {u.photoUrl
              ? <img src={u.photoUrl} alt="" style={{ width:42, height:42, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>
              : <Avatar name={u.name} hue={270} size="lg"/>}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:14, fontWeight:600, letterSpacing:'-0.01em' }}>
                <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.name}</span>
                {isMe && (
                  <span className="chip" style={{ background:'var(--primary-bg)', color:'var(--primary-l)', fontSize:10 }}>Siz</span>
                )}
              </div>
              <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>
                {u.telegramUsername ? `@${u.telegramUsername}` : (u.email && !/^tg-[\w-]+@local$/i.test(u.email) ? u.email : '—')}
              </div>
            </div>
            <span className="chip" style={{ background:'var(--violet-bg)', color:'var(--violet)', fontSize:10.5, flexShrink:0 }}>
              <Icon name="shield" size={10}/> Admin
            </span>
            {!isMe && (
              <button className="btn btn-ghost btn-icon"
                style={{ width:30, height:30, color:'var(--rose)', flexShrink:0 }}
                onClick={() => remove(u)} title="O'chirish">
                <Icon name="alert" size={13}/>
              </button>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default function TeachersPage({ onOpenTeacher, onOpenStudent }) {
  const [tab, setTab] = useState('teachers');
  const { data: pendingData, refetch: refetchPending } = useFetch(() => api.users.list({ status:'pending' }), []);
  const { data: adminsData } = useFetch(() => api.users.list({ role:'admin', status:'active' }), []);
  const pendingCount = (pendingData ?? []).length;
  const adminsCount  = (adminsData  ?? []).length;

  const meta = {
    teachers: { title:"O'qituvchilar", sub:"Batafsil ko'rish uchun bosing" },
    students: { title:"O'quvchilar",   sub:"Barcha guruhlardagi o'quvchilar" },
    admins:   { title:'Adminlar',      sub:`${adminsCount} ta faol admin` },
    pending:  { title:'Kutayotganlar', sub:`${pendingCount} ta tasdiqlanishi kerak` },
    invites:  { title:'Takliflar',     sub:'Bot orqali kirish uchun linklar' },
  };

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.35 }}>
      <div className="page-hd">
        <div>
          <h1 className="page-title">{meta[tab].title}</h1>
          <div className="page-sub">{meta[tab].sub}</div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom:14 }}>
        <button className={`tab ${tab==='teachers'?'active':''}`} onClick={() => setTab('teachers')}>
          <Icon name="teachers" size={12} style={{ marginRight:4, verticalAlign:'-1px' }}/>
          O'qituvchilar
        </button>
        <button className={`tab ${tab==='students'?'active':''}`} onClick={() => setTab('students')}>
          <Icon name="user" size={12} style={{ marginRight:4, verticalAlign:'-1px' }}/>
          O'quvchilar
        </button>
        <button className={`tab ${tab==='admins'?'active':''}`} onClick={() => setTab('admins')}>
          <Icon name="shield" size={12} style={{ marginRight:4, verticalAlign:'-1px' }}/>
          Adminlar
          {adminsCount > 0 && (
            <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:4 }}>{adminsCount}</span>
          )}
        </button>
        <button className={`tab ${tab==='pending'?'active':''}`} onClick={() => setTab('pending')}>
          <Icon name="clock" size={12} style={{ marginRight:4, verticalAlign:'-1px' }}/>
          Kutayotganlar
          {pendingCount > 0 && (
            <span style={{
              marginLeft:6, padding:'1px 6px', borderRadius:8,
              background:'var(--rose)', color:'#fff', fontSize:10.5, fontWeight:700,
            }}>{pendingCount}</span>
          )}
        </button>
        <button className={`tab ${tab==='invites'?'active':''}`} onClick={() => setTab('invites')}>
          <Icon name="link" size={12} style={{ marginRight:4, verticalAlign:'-1px' }}/>
          Takliflar
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
          transition={{ duration:0.22 }}
          style={{ display:'flex', flexDirection:'column' }}>
          {tab === 'teachers' && <TeachersListView onOpenTeacher={onOpenTeacher}/>}
          {tab === 'students' && <StudentsPage embedded onOpenStudent={onOpenStudent}/>}
          {tab === 'admins'   && <AdminsListView/>}
          {tab === 'pending'  && <PendingUsersPage embedded onChange={refetchPending}/>}
          {tab === 'invites'  && <InvitesPage embedded/>}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
