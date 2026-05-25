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

const EMPTY_FORM = { name:'', scheduleDays:[], speakingPerWeek:2 };

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
        speakingPerWeek: form.speakingPerWeek,
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

function InviteLinkModal({ open, onClose, group }) {
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !group?._id) return;
    setError(''); setCopied(false); setLoading(true);
    api.groups.inviteLink(group._id)
      .then(r => setLink(r?.data?.link || ''))
      .catch(e => setError(e.message || 'Xatolik'))
      .finally(() => setLoading(false));
  }, [open, group?._id]);

  const rotate = async () => {
    if (!group?._id) return;
    if (!confirm('Yangi link yaratilsa eski havola bekor bo\'ladi. Davom etamizmi?')) return;
    setLoading(true); setError(''); setCopied(false);
    try {
      const r = await api.groups.rotateInviteLink(group._id);
      setLink(r?.data?.link || '');
      sfx.success();
    } catch (e) { setError(e.message || 'Xatolik'); }
    finally { setLoading(false); }
  };

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); sfx.success(); setTimeout(() => setCopied(false), 1500); }
    catch { setError('Nusxalab bo\'lmadi'); }
  };

  const share = () => {
    if (!link) return;
    const text = `${group?.name || 'Guruh'}ga qo'shilish uchun:`;
    if (navigator.share) {
      navigator.share({ title: group?.name, text, url: link }).catch(() => {});
    } else {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  if (!group) return null;
  return (
    <Modal open={open} onClose={onClose}
      title={`${group.name} — taklif linki`}
      subtitle="O'quvchilar bot orqali ulanadi. Tasdiqlash sizga keladi."
      width={460}
      footer={<>
        <button className="btn btn-ghost" onClick={rotate} disabled={loading} title="Eski linkni bekor qilib yangisini yaratish">
          🔄 Yangi link
        </button>
        <button className="btn btn-primary" onClick={onClose}>Yopish</button>
      </>}>
      {error && <div style={{ marginBottom:12, padding:'10px 12px', background:'var(--rose-bg)', borderRadius:8, color:'var(--rose)', fontSize:12.5 }}>{error}</div>}

      {loading ? (
        <div style={{ padding:'30px 0', textAlign:'center', color:'var(--text-3)', fontSize:13 }}>Yuklanmoqda…</div>
      ) : (
        <>
          <div style={{
            padding:'12px 14px', background:'var(--bg-subtle)', border:'1px dashed var(--border)',
            borderRadius:10, fontSize:12.5, fontFamily:'var(--mono)', wordBreak:'break-all',
            color:'var(--text-1)', marginBottom:12,
          }}>
            {link || '—'}
          </div>

          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <button className="btn btn-primary" style={{ flex:1, justifyContent:'center' }} onClick={copy} disabled={!link}>
              <Icon name="check" size={12}/> {copied ? 'Nusxalandi' : 'Nusxalash'}
            </button>
            <button className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }} onClick={share} disabled={!link}>
              Ulashish
            </button>
          </div>

          <div style={{
            padding:'10px 12px', background:'var(--primary-bg)', borderRadius:10,
            border:'1px solid var(--border)', fontSize:12, color:'var(--text-2)', lineHeight:1.55,
          }}>
            <div style={{ fontWeight:700, color:'var(--primary-l)', marginBottom:4, fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em' }}>
              Qanday ishlaydi
            </div>
            1. O'quvchi linkni bosadi — bot ochiladi<br/>
            2. Ismini yozadi — siz bu yerda "Yangi o'quvchilar"da ko'rasiz<br/>
            3. Siz tasdiqlaganingizdan keyin u bot orqali vazifa va baholaringizni oladi
          </div>
        </>
      )}
    </Modal>
  );
}

function GroupCard({ g, onAddStudents, onShareLink, onRemove, onOpenGroup }) {
  return (
    <motion.div className="card card-hov" variants={listItem}
      whileHover={{ y:-2 }}
      onClick={() => onOpenGroup?.(g._id)}
      style={{ padding:14, display:'flex', flexDirection:'column', cursor: onOpenGroup ? 'pointer' : 'default' }}>
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
        border:'1px solid var(--border)', marginBottom:8,
      }}>
        <span style={{ fontSize:11.5, color:'var(--text-2)' }}>O'quvchilar</span>
        <span style={{ fontFamily:'var(--display)', fontSize:17, fontWeight:700, color:'var(--primary-l)' }}>
          {g.studentCount || 0}
        </span>
      </div>

      {g.topStudent && (
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          padding:'7px 10px', borderRadius:9,
          background:'var(--bg-subtle)', border:'1px solid var(--border)',
          marginBottom:10, fontSize:11.5,
        }} title="Eng ko'p olmos to'plagan o'quvchi">
          <span style={{ fontSize:13 }}>🏆</span>
          <span style={{ flex:1, color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {g.topStudent.name}
          </span>
          <span style={{ fontWeight:700, color:'var(--primary-l)', display:'flex', alignItems:'center', gap:3 }}>
            💎 {g.topStudent.gems}
          </span>
        </div>
      )}

      <div style={{ display:'flex', gap:6, marginTop:'auto' }} onClick={e => e.stopPropagation()}>
        <button className="btn btn-primary btn-sm" style={{ flex:1, justifyContent:'center', fontSize:12 }}
          onClick={() => onAddStudents(g)}>
          <Icon name="plus" size={11}/> Qo'lda
        </button>
        <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:'center', fontSize:12 }}
          onClick={() => onShareLink(g)} title="Telegram orqali ulashish">
          🔗 Link
        </button>
        <button className="btn btn-ghost btn-icon" style={{ width:30, height:30, color:'var(--rose)' }}
          onClick={() => onRemove(g)} title="O'chirish">
          <Icon name="alert" size={12}/>
        </button>
      </div>
    </motion.div>
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
              {s.telegramUsername && <> · @{s.telegramUsername}</>}
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
  const [createOpen, setCreateOpen] = useState(false);
  const [addForGroup, setAddForGroup] = useState(null);
  const [linkForGroup, setLinkForGroup] = useState(null);
  const { data, loading, error, refetch } = useFetch(() => api.groups.list({ limit:100 }));
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

  if (loading) return <div className="page"><Spinner/></div>;
  if (error)   return <div className="page"><ErrorBox message={error} onRetry={refetch}/></div>;

  const totalStudents = groups.reduce((s, g) => s + (g.studentCount || 0), 0);

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.32 }}>
      <div className="page-hd">
        <div>
          <h1 className="page-title">
            {tab === 'groups' ? 'Mening guruhlarim' : tab === 'pending' ? "Yangi o'quvchilar" : "O'quvchilarim"}
          </h1>
          <div className="page-sub">
            {tab === 'groups'
              ? `${groups.length} ta guruh · jami ${totalStudents} ta o'quvchi`
              : tab === 'pending'
              ? `${pendingCount} ta tasdiq kutmoqda`
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
              onAddStudents={setAddForGroup}
              onShareLink={setLinkForGroup}
              onRemove={remove}
              onOpenGroup={onOpenGroup}/>
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

      <InviteLinkModal
        open={!!linkForGroup}
        group={linkForGroup}
        onClose={() => setLinkForGroup(null)}/>
    </motion.div>
  );
}
