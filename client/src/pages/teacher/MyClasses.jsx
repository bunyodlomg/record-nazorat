import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '../../components/ui.jsx';
import { Spinner, ErrorBox, listContainer, listItem } from '../../components/Feedback.jsx';
import { Modal, Field, Input } from '../../components/Modal.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import api from '../../services/api.js';
import { sfx } from '../../hooks/useSound.js';
import StudentsPage from '../Students.jsx';

const DAYS = [
  { id:'mon', label:'Du' },{ id:'tue', label:'Se' },{ id:'wed', label:'Ch' },
  { id:'thu', label:'Pa' },{ id:'fri', label:'Ju' },{ id:'sat', label:'Sh' },{ id:'sun', label:'Ya' },
];
const dayLabels = (days = []) => DAYS.filter(d => days.includes(d.id)).map(d => d.label).join(' · ');

const EMPTY_FORM = { name:'', scheduleDays:[] };

function GroupCreateForm({ open, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      await api.groups.create({
        name: form.name.trim(),
        scheduleDays: form.scheduleDays,
      });
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
      title="Yangi guruh"
      subtitle="Guruh kodi avtomatik beriladi (Masalan: May-G1)"
      width={460}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Bekor</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving || !form.name.trim()}>
          {saving ? 'Yaratilmoqda...' : 'Yaratish'}
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
    </Modal>
  );
}

function AddStudentsModal({ open, onClose, group, onSaved }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState([]); // shu sessiya'da qo'shilganlar
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setName(''); setError(''); setAdded([]); }
  }, [open]);

  // Modal ochilgach yoki qo'shilgandan keyin input'ga focus
  useEffect(() => {
    if (open && !saving) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open, saving, added.length]);

  const submit = async () => {
    const n = name.trim();
    if (!n || !group?._id || saving) return;
    setError(''); setSaving(true);
    try {
      await api.students.create({ name: n, group: group._id });
      sfx.success();
      setAdded(a => [...a, n]);
      setName('');
      onSaved?.();
    } catch (e) {
      setError(e.message || 'Xatolik');
    } finally { setSaving(false); }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  if (!group) return null;
  return (
    <Modal open={open} onClose={onClose}
      title={`${group.name} — o'quvchi qo'shish`}
      subtitle={`Bittadan kiriting · ${group.code}`}
      width={420}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>
          {added.length > 0 ? 'Yopish' : 'Bekor'}
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={saving || !name.trim()}>
          {saving ? 'Qo\'shilmoqda...' : "+ Qo'shish"}
        </button>
      </>}>
      {error && <div style={{ marginBottom:12, padding:'10px 12px', background:'var(--rose-bg)', borderRadius:8, color:'var(--rose)', fontSize:12.5 }}>{error}</div>}

      <Field label="Ism familya">
        <Input
          ref={inputRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ali Valiyev"
          autoFocus/>
      </Field>
      <div style={{ fontSize:11.5, color:'var(--text-3)', marginTop:-6, marginBottom:14 }}>
        Enter — qo'shish va keyingisi
      </div>

      {added.length > 0 && (
        <div style={{
          padding:'10px 12px', background:'var(--primary-bg)',
          border:'1px solid var(--border)', borderRadius:10,
        }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--primary-l)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:7 }}>
            Bu safar qo'shildi · {added.length}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:160, overflowY:'auto' }}>
            {added.map((nm, i) => (
              <div key={i} style={{ fontSize:12.5, display:'flex', alignItems:'center', gap:7 }}>
                <Icon name="check" size={12} color="var(--primary-l)"/>
                <span>{nm}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function GroupCard({ g, onAddStudents, onRemove }) {
  return (
    <motion.div className="card card-hov" variants={listItem}
      whileHover={{ y:-2 }}
      style={{ padding:14, display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10, gap:8 }}>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5, flexWrap:'wrap' }}>
            <span style={{ fontSize:10.5, fontFamily:'var(--mono)', color:'var(--text-2)', background:'var(--bg-subtle)', padding:'2px 7px', borderRadius:5, fontWeight:500 }}>
              {g.code}
            </span>
          </div>
          <div style={{ fontFamily:'var(--display)', fontSize:15, fontWeight:700, letterSpacing:'-0.02em', lineHeight:1.3 }}>
            {g.name}
          </div>
          <div style={{ fontSize:11.5, color:'var(--text-2)', marginTop:3 }}>
            {dayLabels(g.scheduleDays) || "Kun belgilanmagan"}
          </div>
        </div>
      </div>

      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'8px 11px', background:'var(--primary-bg)', borderRadius:9,
        border:'1px solid var(--border)', marginBottom:10,
      }}>
        <span style={{ fontSize:11.5, color:'var(--text-2)' }}>O'quvchilar</span>
        <span style={{ fontFamily:'var(--display)', fontSize:17, fontWeight:700, color:'var(--primary-l)' }}>
          {g.studentCount || 0}
        </span>
      </div>

      <div style={{ display:'flex', gap:6, marginTop:'auto' }}>
        <button className="btn btn-primary btn-sm" style={{ flex:1, justifyContent:'center', fontSize:12 }}
          onClick={() => onAddStudents(g)}>
          <Icon name="plus" size={11}/> O'quvchi qo'shish
        </button>
        <button className="btn btn-ghost btn-icon" style={{ width:30, height:30, color:'var(--rose)' }}
          onClick={() => onRemove(g)} title="O'chirish">
          <Icon name="alert" size={12}/>
        </button>
      </div>
    </motion.div>
  );
}

export default function MyClasses({ onOpenStudent }) {
  const [tab, setTab] = useState('groups');
  const [createOpen, setCreateOpen] = useState(false);
  const [addForGroup, setAddForGroup] = useState(null);
  const { data, loading, error, refetch } = useFetch(() => api.groups.list({ limit:100 }));
  const groups = Array.isArray(data) ? data : (data?.data ?? []);

  const remove = async (g) => {
    if (!confirm(`"${g.name}" guruhni o'chirishni tasdiqlang?`)) return;
    try { await api.groups.delete(g._id); refetch(); }
    catch (e) { alert(e.message); }
  };

  if (loading) return <div className="page"><Spinner/></div>;
  if (error)   return <div className="page"><ErrorBox message={error} onRetry={refetch}/></div>;

  const totalStudents = groups.reduce((s, g) => s + (g.studentCount || 0), 0);

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.32 }}>
      <div className="page-hd">
        <div>
          <h1 className="page-title">{tab === 'groups' ? 'Mening guruhlarim' : "O'quvchilarim"}</h1>
          <div className="page-sub">
            {tab === 'groups'
              ? `${groups.length} ta guruh · jami ${totalStudents} ta o'quvchi`
              : `${totalStudents} ta o'quvchi`}
          </div>
        </div>
        {tab === 'groups' && (
          <div className="page-acts">
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <Icon name="plus" size={13}/> Yangi guruh
            </button>
          </div>
        )}
      </div>

      <div className="tabs" style={{ marginBottom:14 }}>
        <button className={`tab ${tab==='groups'?'active':''}`} onClick={() => setTab('groups')}>
          <Icon name="groups" size={12} style={{ marginRight:4, verticalAlign:-1 }}/> Guruhlar
        </button>
        <button className={`tab ${tab==='students'?'active':''}`} onClick={() => setTab('students')}>
          <Icon name="user" size={12} style={{ marginRight:4, verticalAlign:-1 }}/> O'quvchilar
        </button>
      </div>

      {tab === 'students' ? (
        <StudentsPage embedded onOpenStudent={onOpenStudent}/>
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
              onAddStudents={setAddForGroup}
              onRemove={remove}/>
          ))}
        </motion.div>
      )}

      <GroupCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={refetch}/>

      <AddStudentsModal
        open={!!addForGroup}
        group={addForGroup}
        onClose={() => setAddForGroup(null)}
        onSaved={refetch}/>
    </motion.div>
  );
}
