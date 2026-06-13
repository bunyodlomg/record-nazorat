import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Icon, TgUsername } from '../../components/ui.jsx';
import { Spinner, ErrorBox, listContainer, listItem } from '../../components/Feedback.jsx';
import { Modal, Field, Input } from '../../components/Modal.jsx';
import PageHero from '../../components/PageHero.jsx';
import GroupCard from '../../components/GroupCard.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import api from '../../services/api.js';
import { sfx } from '../../hooks/useSound.js';
import StudentsPage from '../Students.jsx';

const DAYS = [
  { id:'mon', label:'Du' },{ id:'tue', label:'Se' },{ id:'wed', label:'Ch' },
  { id:'thu', label:'Pa' },{ id:'fri', label:'Ju' },{ id:'sat', label:'Sh' },{ id:'sun', label:'Ya' },
];
const dayLabels = (days = []) => DAYS.filter(d => days.includes(d.id)).map(d => d.label).join(' · ');

const EMPTY_FORM = { name:'', scheduleDays:[], speakingPerWeek:2 };

function GroupCreateForm({ open, onClose, onSaved, initial }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!initial?._id;

  // Modal har doim mount qilingani uchun, ochilganda formani to'ldiramiz
  useEffect(() => {
    if (!open) return;
    setError('');
    if (initial) {
      setForm({
        ...EMPTY_FORM,
        name: initial.name || '',
        scheduleDays: initial.scheduleDays || [],
        speakingPerWeek: initial.speakingPerWeek ?? 2,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, initial]);

  const upd = (k, v) => setForm(f => ({ ...f, [k]:v }));
  const toggleDay = (day) => setForm(f => ({
    ...f,
    scheduleDays: f.scheduleDays.includes(day)
      ? f.scheduleDays.filter(d => d !== day)
      : [...f.scheduleDays, day],
  }));

  const submit = async () => {
    setError(''); setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        scheduleDays: form.scheduleDays,
        speakingPerWeek: form.speakingPerWeek,
      };
      if (isEdit) await api.groups.update(initial._id, payload);
      else        await api.groups.create(payload);
      sfx.success();
      onSaved?.();
      setForm(EMPTY_FORM);
      onClose();
    } catch (e) {
      setError(e.message || 'Xatolik');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={isEdit ? 'Guruhni tahrirlash' : 'Yangi guruh'}
      subtitle={isEdit ? "Guruh ma'lumotlarini yangilash" : "Guruh kodi avtomatik beriladi (Masalan: May-G1)"}
      width={460}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Bekor</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving || !form.name.trim()}>
          {saving ? 'Saqlanmoqda...' : (isEdit ? 'Saqlash' : 'Yaratish')}
        </button>
      </>}>
      {error && <div style={{ marginBottom:12, padding:'10px 12px', background:'var(--rose-bg)', borderRadius:8, color:'var(--rose)', fontSize:12.5 }}>{error}</div>}

      <Field label="Guruh nomi" hint="Masalan: Speaking Club, IELTS Prep">
        <Input value={form.name} onChange={e=>upd('name', e.target.value)} placeholder="Speaking Club" autoFocus/>
      </Field>
      <Field label="Dars kunlari" hint="Dars bor kunlari avtomatik vazifa yaratiladi">
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {DAYS.map(d => {
            const active = form.scheduleDays.includes(d.id);
            return (
              <button key={d.id} type="button" onClick={() => toggleDay(d.id)}
                style={{
                  width:42, height:42, borderRadius:10,
                  background: active ? 'linear-gradient(135deg, var(--primary), var(--primary-d))' : 'var(--bg-subtle)',
                  color: active ? '#fff' : 'var(--text-2)',
                  border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                  fontWeight:600, fontSize:13, cursor:'pointer',
                  boxShadow: active ? '0 2px 10px rgba(99,102,241,0.30)' : 'none',
                }}>
                {d.label}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Haftalik speaking soni" hint="Har hafta avto-yaratiladi (yakshanbagacha topshiriladi)">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button type="button" onClick={() => upd('speakingPerWeek', Math.max(0, (form.speakingPerWeek || 0) - 1))}
            className="btn btn-ghost btn-icon" style={{ width:38, height:38, fontSize:18, fontWeight:700 }}>−</button>
          <div style={{
            flex:1, textAlign:'center', padding:'10px 12px', borderRadius:10,
            background:'var(--bg-subtle)', border:'1px solid var(--border)',
            fontFamily:'var(--display)', fontSize:18, fontWeight:700, color:'var(--primary-l)',
          }}>{form.speakingPerWeek ?? 2}</div>
          <button type="button" onClick={() => upd('speakingPerWeek', Math.min(7, (form.speakingPerWeek || 0) + 1))}
            className="btn btn-ghost btn-icon" style={{ width:38, height:38, fontSize:18, fontWeight:700 }}>+</button>
        </div>
      </Field>
    </Modal>
  );
}

function PendingStudentsPanel({ onChange }) {
  const { data, loading, refetch } = useFetch(() => api.students.pending());
  const list = Array.isArray(data) ? data : (data?.data ?? []);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const id = setInterval(() => refetch({ silent:true }), 12_000);
    return () => clearInterval(id);
  }, [refetch]);

  const act = async (id, action) => {
    setBusyId(id);
    try {
      if (action === 'approve') await api.students.approve(id);
      else                       await api.students.reject(id);
      sfx.success();
      refetch();
      onChange?.();
    } catch (e) { alert(e.message); sfx.error?.(); }
    finally { setBusyId(null); }
  };

  if (loading && !list.length) return <div style={{ padding:'14px', color:'var(--text-3)', fontSize:13 }}>Yuklanmoqda…</div>;
  if (!list.length) return (
    <div style={{ padding:'18px 14px', textAlign:'center', color:'var(--text-3)', fontSize:13 }}>
      Hozircha tasdiq kutayotgan o'quvchilar yo'q.
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {list.map(s => (
        <div key={s._id} className="card" style={{
          padding:'12px 13px', display:'flex', alignItems:'center', gap:10,
          border:'1px solid var(--border)', background:'var(--bg-subtle)',
        }}>
          <div style={{
            width:36, height:36, borderRadius:'50%',
            background:`hsl(${s.hue || 200} 70% 60%)`,
            color:'#fff', display:'grid', placeItems:'center',
            fontWeight:700, fontSize:14, flexShrink:0,
          }}>{(s.name || '?').trim()[0]?.toUpperCase()}</div>

          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontWeight:700, fontSize:13.5, lineHeight:1.2, marginBottom:2,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
            <div style={{ fontSize:11.5, color:'var(--text-2)' }}>
              {s.group?.name || '—'}
              {s.telegramUsername && <> · <TgUsername username={s.telegramUsername}/></>}
            </div>
          </div>

          <button className="btn btn-primary btn-sm" style={{ fontSize:11.5, padding:'6px 11px' }}
            disabled={busyId === s._id} onClick={() => act(s._id, 'approve')}>
            ✓ Tasdiqlash
          </button>
          <button className="btn btn-ghost btn-icon" style={{ width:30, height:30, color:'var(--rose)' }}
            disabled={busyId === s._id} onClick={() => act(s._id, 'reject')} title="Rad etish">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default function MyClasses({ onOpenStudent, onOpenGroup }) {
  const [tab, setTab] = useState('groups');
  const [showClosed, setShowClosed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { data, loading, error, refetch } = useFetch(
    () => api.groups.list({ limit:100, isActive: showClosed ? 'false' : 'true' }),
    [showClosed],
  );
  const { data: closedData } = useFetch(() => api.groups.list({ limit:100, isActive:'false' }), [showClosed]);
  const closedCount = Array.isArray(closedData) ? closedData.length : (closedData?.data?.length ?? 0);
  const { data: pendingData, refetch: refetchPending } = useFetch(() => api.students.pending());
  const groups = Array.isArray(data) ? data : (data?.data ?? []);
  const pendingList = Array.isArray(pendingData) ? pendingData : (pendingData?.data ?? []);
  const pendingCount = pendingList.length;

  // Pending ro'yxatini har 12s'da silent refresh
  useEffect(() => {
    const id = setInterval(() => refetchPending({ silent:true }), 12_000);
    return () => clearInterval(id);
  }, [refetchPending]);

  const remove = async (g) => {
    if (!confirm(`"${g.name}" guruhni o'chirishni tasdiqlang?`)) return;
    try { await api.groups.delete(g._id); refetch(); }
    catch (e) { alert(e.message); }
  };

  const openAdd  = () => { setEditing(null); setCreateOpen(true); };
  const openEdit = (g) => { setEditing(g); setCreateOpen(true); };
  const closeForm = () => { setCreateOpen(false); setEditing(null); };

  if (loading) return <div className="page"><Spinner/></div>;
  if (error)   return <div className="page"><ErrorBox message={error} onRetry={refetch}/></div>;

  const totalStudents = groups.reduce((s, g) => s + (g.studentCount || 0), 0);

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.32 }}>
      <PageHero
        title={tab === 'groups'
          ? (showClosed ? 'Yopilgan guruhlar' : 'Mening guruhlarim')
          : tab === 'pending' ? "Yangi o'quvchilar" : "O'quvchilarim"}
        subtitle={tab === 'groups'
          ? (showClosed ? `${groups.length} ta yopilgan guruh` : `${groups.length} ta guruh · jami ${totalStudents} ta o'quvchi`)
          : tab === 'pending' ? `${pendingCount} ta tasdiq kutmoqda` : `${totalStudents} ta o'quvchi`}
        stats={[
          { value: groups.length, label:'Guruhlar',   icon:'groups', bg:'var(--primary-bg)',     color:'var(--primary)' },
          { value: totalStudents, label:"O'quvchilar", icon:'user',   bg:'rgba(56,189,248,0.14)', color:'#0ea5e9' },
          { value: pendingCount,  label:'Tasdiqlash',  icon:'clock',  bg:'var(--amber-bg)',       color:'var(--amber)' },
        ]}
      />

      {tab === 'groups' && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end', marginBottom:14 }}>
          {(closedCount > 0 || showClosed) && (
            <button className="btn btn-secondary" onClick={() => setShowClosed(s => !s)}
              style={showClosed ? { background:'var(--rose-bg)', color:'var(--rose)' } : undefined}>
              <Icon name="check" size={13}/> {showClosed ? 'Faollar' : `Yopilganlar (${closedCount})`}
            </button>
          )}
          {!showClosed && (
            <button className="btn btn-primary btn-lg" onClick={openAdd}>
              <Icon name="plus" size={15}/> Yangi guruh
            </button>
          )}
        </div>
      )}

      <div className="tabs" style={{ marginBottom:14 }}>
        <button className={`tab ${tab==='groups'?'active':''}`} onClick={() => setTab('groups')}>
          <Icon name="groups" size={12} style={{ marginRight:4, verticalAlign:-1 }}/> Guruhlar
        </button>
        <button className={`tab ${tab==='students'?'active':''}`} onClick={() => setTab('students')}>
          <Icon name="user" size={12} style={{ marginRight:4, verticalAlign:-1 }}/> O'quvchilar
        </button>
        <button className={`tab ${tab==='pending'?'active':''}`} onClick={() => setTab('pending')}
          style={pendingCount > 0 ? { color:'var(--amber)', fontWeight:700 } : undefined}>
          ⏳ Tasdiqlash {pendingCount > 0 && (
            <span style={{
              marginLeft:5, padding:'1px 7px', borderRadius:10,
              background:'var(--amber)', color:'#1a1a1a', fontSize:10.5, fontWeight:800,
            }}>{pendingCount}</span>
          )}
        </button>
      </div>

      {tab === 'students' ? (
        <StudentsPage embedded onOpenStudent={onOpenStudent}/>
      ) : tab === 'pending' ? (
        <PendingStudentsPanel onChange={() => { refetch(); refetchPending(); }}/>
      ) : groups.length === 0 ? (
        <div style={{ padding:'50px 20px', textAlign:'center', color:'var(--text-3)' }}>
          <div style={{ fontSize:36, marginBottom:8 }}>📚</div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Hozircha guruhlaringiz yo'q</div>
          <div style={{ fontSize:12.5, marginTop:5 }}>"Yangi guruh" tugmasini bosib boshlang.</div>
        </div>
      ) : (
        <motion.div className="groups-grid" variants={listContainer} initial="hidden" animate="show">
          {groups.map(g => (
            <GroupCard key={g._id} g={g}
              onEdit={openEdit}
              onRemove={remove}
              onOpenGroup={onOpenGroup}
              showTeacher={false}/>
          ))}
        </motion.div>
      )}

      <GroupCreateForm
        key={editing?._id || 'new'}
        open={createOpen}
        initial={editing}
        onClose={closeForm}
        onSaved={refetch}/>
    </motion.div>
  );
}
