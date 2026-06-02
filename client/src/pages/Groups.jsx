import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Avatar } from '../components/ui.jsx';
import { Spinner, ErrorBox, listContainer, listItem } from '../components/Feedback.jsx';
import { Modal, Field, Input, Select, UserPicker } from '../components/Modal.jsx';
import { useFetch } from '../hooks/useFetch.js';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const LVL_CHIP = {
  A1:'chip-neutral', A2:'chip-neutral',
  B1:'chip-info',    B2:'chip-info',
  C1:'chip-accent',  C2:'chip-success',
  Beginner:'chip-neutral', Intermediate:'chip-info', Advanced:'chip-accent', Olympiad:'chip-success',
};
const LVL_LABEL = {
  A1:'A1', A2:'A2', B1:'B1', B2:'B2', C1:'C1', C2:'C2',
  Beginner:"Boshlang'ich", Intermediate:"O'rta", Advanced:'Yuqori', Olympiad:'Olimpiada',
};
const DAYS = [
  { id:'mon', label:'Du' },{ id:'tue', label:'Se' },{ id:'wed', label:'Ch' },
  { id:'thu', label:'Pa' },{ id:'fri', label:'Ju' },{ id:'sat', label:'Sh' },{ id:'sun', label:'Ya' },
];

const EMPTY_FORM = {
  name:'', teacher:'',
  scheduleDays:[],
};

function GroupForm({ open, onClose, initial, onSaved, teachers, isAdmin }) {
  const [form, setForm] = useState(() => {
    if (initial) return {
      ...EMPTY_FORM, ...initial,
      teacher: initial.teacher?._id || initial.teacher || '',
      scheduleDays: initial.scheduleDays || [],
    };
    return EMPTY_FORM;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const isEdit = !!initial?._id;

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
      };
      if (isAdmin && form.teacher) payload.teacher = form.teacher;
      if (isEdit) await api.groups.update(initial._id, payload);
      else        await api.groups.create(payload);
      onSaved?.(); onClose();
    } catch (e) { setError(e.message || 'Saqlashda xatolik'); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      open={open} onClose={onClose}
      title={isEdit ? 'Guruhni tahrirlash' : 'Yangi guruh'}
      subtitle={isEdit ? "Guruh ma'lumotlarini yangilash" : "Asosiy ma'lumotlarni kiriting"}
      width={520}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Bekor qilish</button>
        <button className="btn btn-primary" onClick={submit}
          disabled={saving || !form.name || (isAdmin && !form.teacher)}>
          {saving ? 'Saqlanmoqda...' : (isEdit ? 'Saqlash' : 'Yaratish')}
        </button>
      </>}
    >
      {error && (
        <div style={{ marginBottom:12, padding:'10px 12px', background:'var(--rose-bg)', borderRadius:8, color:'var(--rose)', fontSize:12.5 }}>
          {error}
        </div>
      )}

      <Field label="Guruh nomi" hint="Masalan: Speaking Club B2, IELTS Prep">
        <Input value={form.name} onChange={e=>upd('name', e.target.value)} placeholder="Speaking Club B2" autoFocus/>
      </Field>

      {isAdmin && (
        <Field label="Mas'ul o'qituvchi">
          <Select value={form.teacher} onChange={e=>upd('teacher', e.target.value)}>
            <option value="">— O'qituvchini tanlang —</option>
            {teachers.map(t => <option key={t._id} value={t._id}>{t.name}{t.subject ? ` · ${t.subject}` : ''}</option>)}
          </Select>
        </Field>
      )}

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
                  transition:'all 180ms',
                }}>
                {d.label}
              </button>
            );
          })}
        </div>
      </Field>

      <div style={{
        marginTop:6, padding:'10px 12px', background:'var(--primary-bg)',
        border:'1px solid var(--border)', borderRadius:10,
        fontSize:12, color:'var(--text-2)', lineHeight:1.6,
      }}>
        <Icon name="sparkles" size={12} style={{ verticalAlign:-1, marginRight:4, color:'var(--primary-l)' }}/>
        Guruh kodi avtomatik beriladi. Yaratgandan so'ng o'quvchilarni qo'lda qo'shasiz.
      </div>
    </Modal>
  );
}

const dayLabels = (days = []) => DAYS.filter(d => days.includes(d.id)).map(d => d.label).join(' · ');

function GroupCard({ g, onOpenTeacher, onOpenGroup, onEdit, onRemove, isAdmin }) {
  return (
    <motion.div className="card card-hov" variants={listItem}
      whileHover={{ y:-3 }}
      onClick={() => onOpenGroup?.(g._id)}
      style={{ padding:17, position:'relative', cursor: onOpenGroup ? 'pointer' : 'default' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontFamily:'var(--display)', fontSize:16, fontWeight:700, letterSpacing:'-0.02em' }}>{g.name}</div>
          <div style={{ fontSize:12, color:'var(--text-2)', marginTop:5 }}>
            {dayLabels(g.scheduleDays) || 'Jadval kiritilmagan'}{g.scheduleTime ? ` · ${g.scheduleTime}` : ''}
          </div>
        </div>
        {isAdmin && (
          <div style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
            <button className="btn btn-ghost btn-icon" style={{ width:28, height:28 }} onClick={() => onEdit(g)}><Icon name="settings" size={13}/></button>
            <button className="btn btn-ghost btn-icon" style={{ width:28, height:28, color:'var(--rose)' }} onClick={() => onRemove(g)}><Icon name="alert" size={13}/></button>
          </div>
        )}
      </div>

      {g.teacher && (
        <button onClick={e=>{e.stopPropagation();onOpenTeacher && onOpenTeacher(g.teacher._id)}}
          style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px',
            background:'var(--bg-subtle)', borderRadius:9, border:'1px solid var(--border)',
            marginBottom:12, width:'100%', cursor: onOpenTeacher ? 'pointer' : 'default' }}>
          <Avatar name={g.teacher.name} hue={g.teacher.hue} size="sm" photoUrl={g.teacher.photoUrl}/>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:12.5, fontWeight:600 }}>{g.teacher.name}</div>
            <div style={{ fontSize:10.5, color:'var(--text-3)' }}>Mas'ul o'qituvchi</div>
          </div>
        </button>
      )}

      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'8px 10px', background:'var(--primary-bg)', borderRadius:9,
        border:'1px solid rgba(45,212,191,0.18)',
      }}>
        <span style={{ fontSize:11.5, color:'var(--text-2)' }}>O'quvchilar</span>
        <span style={{ fontFamily:'var(--display)', fontSize:18, fontWeight:700, color:'var(--primary-l)' }}>
          {g.studentCount || 0}
        </span>
      </div>
    </motion.div>
  );
}

function TeacherGroupSection({ teacher, groups, onOpenTeacher, onOpenGroup, onEdit, onRemove, isAdmin }) {
  const totalStudents = groups.reduce((s, g) => s + (g.studentCount || 0), 0);
  const noTeacher = !teacher;
  return (
    <motion.div variants={listItem}
      className="card"
      style={{ padding:'14px 16px 16px', marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12, flexWrap:'wrap' }}>
        <button onClick={() => !noTeacher && onOpenTeacher?.(teacher._id)}
          disabled={noTeacher}
          style={{
            display:'flex', alignItems:'center', gap:11, padding:'4px 10px 4px 4px',
            background:'var(--bg-subtle)', borderRadius:'var(--r-full)',
            border:'1px solid var(--border)',
            cursor: noTeacher ? 'default' : 'pointer',
            transition:'all 160ms',
          }}
          onMouseEnter={e => { if (!noTeacher) { e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.borderColor='rgba(45,212,191,0.30)'; } }}
          onMouseLeave={e => { if (!noTeacher) { e.currentTarget.style.background='var(--bg-subtle)'; e.currentTarget.style.borderColor='var(--border)'; } }}>
          {noTeacher
            ? <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--bg-subtle)', display:'grid', placeItems:'center', color:'var(--text-3)' }}><Icon name="alert" size={14}/></div>
            : <Avatar name={teacher.name} hue={teacher.hue} size="md" photoUrl={teacher.photoUrl}/>}
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:13.5, fontWeight:600, letterSpacing:'-0.01em' }}>{noTeacher ? "Mas'ul biriktirilmagan" : teacher.name}</div>
            {!noTeacher && teacher.subject && <div style={{ fontSize:11, color:'var(--text-3)' }}>{teacher.subject}</div>}
          </div>
        </button>
        <div style={{ flex:1 }}/>
        <span className="chip chip-neutral" style={{ fontSize:11 }}>{groups.length} guruh</span>
        <span className="chip chip-success" style={{ fontSize:11 }}>{totalStudents} o'quvchi</span>
      </div>
      <div className="groups-grid">
        {groups.map(g => (
          <GroupCard key={g._id} g={g} onOpenTeacher={onOpenTeacher} onOpenGroup={onOpenGroup} onEdit={onEdit} onRemove={onRemove} isAdmin={isAdmin}/>
        ))}
      </div>
    </motion.div>
  );
}

export default function GroupsPage({ onOpenTeacher, onOpenGroup }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState('group'); // 'group' | 'teacher'
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { data, loading, error, refetch } = useFetch(() => api.groups.list({ limit:100 }));
  const { data: teachersData } = useFetch(() => isAdmin ? api.teachers.list({ limit:100 }) : Promise.resolve({ data:[] }), [isAdmin]);
  const teachers = Array.isArray(teachersData) ? teachersData : (teachersData?.data ?? []);

  const allGroups = Array.isArray(data) ? data : (data?.data ?? []);
  const groups = allGroups.filter(g => !search ||
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.code.toLowerCase().includes(search.toLowerCase()) ||
    g.teacher?.name?.toLowerCase().includes(search.toLowerCase()));

  const totalStudents = allGroups.reduce((s, g) => s + (g.studentCount || 0), 0);

  const groupedByTeacher = useMemo(() => {
    if (groupBy !== 'teacher') return [];
    const map = new Map();
    for (const g of groups) {
      const key = g.teacher?._id || '__none__';
      if (!map.has(key)) map.set(key, { teacher: g.teacher || null, groups: [] });
      map.get(key).groups.push(g);
    }
    // saralash: avval mas'ul o'qituvchi bor bo'lganlar (alfabit), oxirida "biriktirilmagan"
    return Array.from(map.values()).sort((a, b) => {
      if (!a.teacher) return 1;
      if (!b.teacher) return -1;
      return a.teacher.name.localeCompare(b.teacher.name);
    });
  }, [groupBy, groups]);

  const openAdd  = () => { setEditing(null); setModalOpen(true); };
  const openEdit = g => { setEditing(g); setModalOpen(true); };
  const remove = async g => {
    if (!confirm(`"${g.name}" guruhni o'chirishni tasdiqlang?`)) return;
    try { await api.groups.delete(g._id); refetch(); } catch (e) { alert(e.message); }
  };

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.35 }}>
      <div className="page-hd">
        <div>
          <h1 className="page-title">Guruhlar</h1>
          <div className="page-sub">{allGroups.length} ta guruh · {totalStudents} ta o'quvchi</div>
        </div>
        <div className="page-acts">
          <div className="seg">
            <button className={`seg-btn ${groupBy==='group'?'active':''}`} onClick={()=>setGroupBy('group')}>
              <Icon name="groups" size={12}/> Guruh
            </button>
            <button className={`seg-btn ${groupBy==='teacher'?'active':''}`} onClick={()=>setGroupBy('teacher')}>
              <Icon name="teachers" size={12}/> O'qituvchi
            </button>
          </div>
          <div className="sw">
            <Icon name="search" size={13} color="var(--text-3)"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Qidirish..." style={{ width:160 }}/>
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={13}/> Yangi guruh</button>
          )}
        </div>
      </div>

      {loading && <Spinner/>}
      {error   && <ErrorBox message={error} onRetry={refetch}/>}
      {!loading && !error && groups.length === 0 && (
        <div style={{ padding:'60px 0', textAlign:'center', color:'var(--text-3)' }}>
          <div style={{ fontSize:40, marginBottom:8 }}>👥</div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Guruhlar yo'q</div>
          <div style={{ fontSize:12.5, marginTop:5 }}>
            {isAdmin ? "Birinchi guruhni yaratish uchun \"Yangi guruh\" tugmasini bosing." : 'Hozircha guruhlar mavjud emas.'}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!loading && !error && groups.length > 0 && groupBy === 'group' && (
          <motion.div key="by-group" className="groups-grid"
            variants={listContainer} initial="hidden" animate="show" exit={{ opacity:0 }}>
            {groups.map(g => (
              <GroupCard key={g._id} g={g} onOpenTeacher={onOpenTeacher} onOpenGroup={onOpenGroup} onEdit={openEdit} onRemove={remove} isAdmin={isAdmin}/>
            ))}
          </motion.div>
        )}

        {!loading && !error && groups.length > 0 && groupBy === 'teacher' && (
          <motion.div key="by-teacher"
            variants={listContainer} initial="hidden" animate="show" exit={{ opacity:0 }}>
            {groupedByTeacher.map(({ teacher, groups: tGroups }) => (
              <TeacherGroupSection key={teacher?._id || 'none'}
                teacher={teacher} groups={tGroups}
                onOpenTeacher={onOpenTeacher} onOpenGroup={onOpenGroup} onEdit={openEdit} onRemove={remove} isAdmin={isAdmin}/>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <GroupForm
        open={modalOpen}
        initial={editing}
        teachers={teachers}
        isAdmin={isAdmin}
        onClose={() => setModalOpen(false)}
        onSaved={refetch}
      />
    </motion.div>
  );
}
