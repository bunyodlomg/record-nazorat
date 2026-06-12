import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Avatar } from '../components/ui.jsx';
import { Spinner, ErrorBox, listContainer, listItem } from '../components/Feedback.jsx';
import { Modal, Field, Input, Select, UserPicker } from '../components/Modal.jsx';
import PageHero from '../components/PageHero.jsx';
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

const GROUP_GRADS = [
  'linear-gradient(165deg,#60a5fa,#4f46e5)', // G1 — blue→indigo
  'linear-gradient(165deg,#a78bfa,#7c3aed)', // G2 — violet
  'linear-gradient(165deg,#34d399,#059669)', // G3 — emerald
  'linear-gradient(165deg,#fbbf24,#f59e0b)', // G4 — amber
  'linear-gradient(165deg,#fb7185,#e11d48)', // G5 — rose
  'linear-gradient(165deg,#38bdf8,#0891b2)', // G6 — cyan
];

/* "Iyun-G1" → { num:1, big:"G1", sub:"IYUN" } */
function codeParts(code = '') {
  const s = String(code || '');
  const m = s.match(/G\s*(\d+)/i);
  const num = m ? parseInt(m[1], 10) : 0;
  const big = m ? `G${num}` : (s.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'GR');
  const sub = s.replace(/-?G\s*\d+/i, '').replace(/[-_]+/g, ' ').trim().toUpperCase();
  return { num, big, sub };
}

function GroupCard({ g, onOpenTeacher, onOpenGroup, onEdit, onRemove, isAdmin }) {
  const { num, big, sub } = codeParts(g.code);
  const grad = GROUP_GRADS[((num || 1) - 1) % GROUP_GRADS.length];
  const days = dayLabels(g.scheduleDays);
  return (
    <motion.div className="gcard card card-hov" variants={listItem}
      whileHover={{ y:-3 }}
      onClick={() => onOpenGroup?.(g._id)}
      style={{ cursor: onOpenGroup ? 'pointer' : 'default' }}>

      <div className="gcard-side" style={{ background:grad }}>
        <span className="gcard-star"><Icon name="star" size={12}/></span>
        <div className="gcard-code">{big}</div>
        {sub && <div className="gcard-codesub">{sub}</div>}
      </div>

      <div className="gcard-main">
        <div className="gcard-r1">
          <div className="gcard-name">{g.name}</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }} onClick={e => e.stopPropagation()}>
            <span className={`chip ${g.isActive ? 'chip-success' : 'chip-neutral'}`}>
              <span style={{ width:6, height:6, borderRadius:'50%', background: g.isActive ? '#34d399' : 'var(--text-3)', display:'inline-block' }}/>
              {g.isActive ? 'Faol' : 'Yopilgan'}
            </span>
            {isAdmin && (
              <>
                <button className="btn btn-ghost btn-icon" style={{ width:28, height:28 }} onClick={() => onEdit(g)} title="Tahrirlash"><Icon name="settings" size={13}/></button>
                <button className="btn btn-ghost btn-icon" style={{ width:28, height:28, color:'var(--rose)' }} onClick={() => onRemove(g)} title="O'chirish"><Icon name="alert" size={13}/></button>
              </>
            )}
          </div>
        </div>

        <button className="gcard-meta"
          onClick={e => { e.stopPropagation(); g.teacher && onOpenTeacher?.(g.teacher._id); }}
          style={{ background:'transparent', padding:0, cursor: g.teacher && onOpenTeacher ? 'pointer' : 'default' }}>
          <Icon name="teachers" size={13} color="var(--text-3)"/>
          <span className="txt">{g.teacher?.name || "Mas'ul biriktirilmagan"}</span>
        </button>

        {days && (
          <div className="gcard-meta">
            <Icon name="calendar" size={13} color="var(--text-3)"/>
            <span className="txt">{days}{g.scheduleTime ? ` · ${g.scheduleTime}` : ''}</span>
          </div>
        )}

        <div className="gcard-foot">
          <span className="gcard-foot-lbl"><Icon name="user" size={13} color="var(--text-3)"/> O'quvchilar</span>
          <span className="gcard-count">{g.studentCount || 0}</span>
          <div style={{ flex:1 }}/>
          {g.totalGems > 0 && (
            <span className="chip chip-accent"><Icon name="gem" size={11}/> {g.totalGems}</span>
          )}
        </div>
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
  const totalGems     = allGroups.reduce((s, g) => s + (g.totalGems || 0), 0);
  const teacherCount  = new Set(allGroups.map(g => String(g.teacher?._id || g.teacher)).filter(v => v && v !== 'undefined')).size;

  const heroStats = [
    { value: allGroups.length, label:'Guruhlar',      icon:'groups',   bg:'var(--primary-bg)',       color:'var(--primary)' },
    { value: totalStudents,    label:"O'quvchilar",   icon:'user',     bg:'rgba(56,189,248,0.14)',   color:'#0ea5e9' },
    { value: teacherCount,     label:"O'qituvchilar", icon:'teachers', bg:'rgba(16,185,129,0.14)',   color:'#059669' },
    { value: totalGems,        label:'Olmoslar',      icon:'gem',      bg:'var(--accent-bg)',        color:'var(--accent)' },
  ];

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
      <PageHero
        title="Guruhlar"
        subtitle={`${allGroups.length} ta guruh · ${totalStudents} ta o'quvchi`}
        emoji="🎒"
        stats={heroStats}
      />

      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        <div className="sw" style={{ flex:'1 1 240px', height:42 }}>
          <Icon name="search" size={14} color="var(--text-3)"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Qidirish..." style={{ width:'100%' }}/>
        </div>
        <div className="seg" style={{ flexShrink:0 }}>
          <button className={`seg-btn ${groupBy==='group'?'active':''}`} onClick={()=>setGroupBy('group')}>
            <Icon name="groups" size={12}/> Guruh
          </button>
          <button className={`seg-btn ${groupBy==='teacher'?'active':''}`} onClick={()=>setGroupBy('teacher')}>
            <Icon name="teachers" size={12}/> O'qituvchi
          </button>
        </div>
        {isAdmin && (
          <button className="btn btn-primary btn-lg" onClick={openAdd} style={{ flexShrink:0 }}>
            <Icon name="plus" size={15}/> Yangi guruh
          </button>
        )}
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
