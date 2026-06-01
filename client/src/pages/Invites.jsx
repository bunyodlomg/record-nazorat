import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Avatar } from '../components/ui.jsx';
import { Spinner, ErrorBox, listContainer, listItem } from '../components/Feedback.jsx';
import { Modal, Field, Input, Select } from '../components/Modal.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import { haptic } from '../hooks/useTelegram.js';
import SwipeToDelete from '../components/SwipeToDelete.jsx';

const ROLE_LABEL = { admin:'Admin', teacher:"O'qituvchi", student:"O'quvchi" };
const STATUS_LABEL = { pending:'Kutilmoqda', active:'Tasdiqlangan', rejected:'Rad etilgan' };
const STATUS_COLOR = {
  pending:  ['var(--amber-bg)',   'var(--amber)'],
  active:   ['var(--primary-bg)', 'var(--primary)'],
  rejected: ['var(--rose-bg)',    'var(--rose)'],
};

function formatDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('uz-UZ', { day:'numeric', month:'short', year:'numeric' });
}

function statusOf(inv) {
  if (inv.revokedAt) return { label:'Bekor qilingan', color:'var(--rose)',   bg:'var(--rose-bg)' };
  if (inv.isExpired) return { label:'Muddati tugagan',color:'var(--text-3)', bg:'var(--bg-subtle)' };
  if (inv.isUsed)    return { label:'Tugatildi',      color:'var(--text-2)', bg:'var(--bg-subtle)' };
  return                   { label:'Faol',          color:'var(--emerald)',bg:'var(--primary-bg)' };
}

function CreateInviteModal({ open, onClose, onCreated, isTeacher, groups }) {
  const [role, setRole] = useState(isTeacher ? 'student' : 'teacher');
  const [groupId, setGroupId] = useState('');
  const [maxUses, setMaxUses] = useState(20);
  const [expiresInHours, setExpires] = useState(1); // 1 soat default
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const resetForm = () => {
    setRole(isTeacher ? 'student' : 'teacher');
    setGroupId('');
    setMaxUses(20);
    setExpires(1); setError('');
  };

  const submit = async () => {
    setError(''); setSaving(true);
    try {
      const payload = {
        role,
        maxUses: Number(maxUses) || 1,
        expiresInHours: expiresInHours ? Number(expiresInHours) : undefined,
      };
      if (role === 'student') {
        if (!groupId) { setError("Guruh tanlang"); setSaving(false); return; }
        payload.group = groupId;
      }
      const res = await api.invites.create(payload);
      onCreated?.(res.data);
      onClose();
      resetForm();
    } catch (e) {
      setError(e.message || 'Xatolik');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); resetForm(); }}
      title="Yangi taklif link"
      subtitle="Bot orqali ulanish uchun havola"
      width={460}
      footer={<>
        <button className="btn btn-ghost" onClick={() => { onClose(); resetForm(); }} disabled={saving}>Bekor</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving || (role === 'student' && !groupId)}>
          {saving ? 'Yaratilmoqda...' : 'Link yaratish'}
        </button>
      </>}
    >
      {error && (
        <div style={{ marginBottom:12, padding:'10px 12px', background:'var(--rose-bg)', border:'1px solid var(--rose)', borderRadius:8, color:'var(--rose)', fontSize:12.5 }}>
          {error}
        </div>
      )}

      {!isTeacher && (
        <Field label="Kim uchun">
          <Select value={role} onChange={e => { setRole(e.target.value); setGroupId(''); }}>
            <option value="teacher">O'qituvchi</option>
            <option value="admin">Administrator</option>
            <option value="student">O'quvchi (guruhga)</option>
          </Select>
        </Field>
      )}

      {role === 'student' && (
        <Field label="Qaysi guruhga" hint="O'quvchi link orqali bu guruhga so'rov yuboradi">
          <Select value={groupId} onChange={e => setGroupId(e.target.value)}>
            <option value="">— Guruhni tanlang —</option>
            {groups.map(g => (
              <option key={g._id} value={g._id}>{g.name} ({g.code})</option>
            ))}
          </Select>
        </Field>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Field label="Necha marta ishlaydi" hint="1 — bir martalik">
          <Input type="number" min="1" max="1000" value={maxUses} onChange={e => setMaxUses(e.target.value)}/>
        </Field>
        <Field label="Amal qilish (soat)" hint="Bo'sh — cheksiz">
          <Input type="number" min="0" value={expiresInHours} onChange={e => setExpires(e.target.value)} placeholder="1"/>
        </Field>
      </div>
    </Modal>
  );
}

function UseChip({ user }) {
  const status = user?.status || 'pending';
  const [bg, color] = STATUS_COLOR[status] || STATUS_COLOR.pending;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8, padding:'8px 10px',
      background:'var(--bg-subtle)', borderRadius:8,
    }}>
      {user?.photoUrl ? (
        <img src={user.photoUrl} alt={user.name}
          style={{ width:26, height:26, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>
      ) : (
        <Avatar name={user?.name || '?'} hue={user?.hue ?? 210} size="sm"/>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {user?.name || 'Nomalum'}
        </div>
        {user?.telegramUsername && (
          <div style={{ fontSize:10.5, color:'var(--text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            @{user.telegramUsername}
          </div>
        )}
      </div>
      <span className="chip" style={{ background:bg, color, fontSize:10, flexShrink:0 }}>
        {STATUS_LABEL[status] || status}
      </span>
    </div>
  );
}

function InviteRow({ inv, onRevoke, onCopy }) {
  const [expanded, setExpanded] = useState(false);
  const st = statusOf(inv);
  const userUses    = inv.uses || [];
  const studentUses = inv.studentUses || [];
  const usesCount   = userUses.length + studentUses.length;
  const hasUses     = usesCount > 0;

  const isStudent = inv.role === 'student';
  const iconName  = inv.role === 'admin'   ? 'shield'
                  : inv.role === 'student' ? 'user'
                  : 'teachers';
  const iconBg    = inv.role === 'admin'   ? 'var(--violet-bg)'
                  : inv.role === 'student' ? 'var(--accent-bg)'
                  : 'var(--primary-bg)';
  const iconFg    = inv.role === 'admin'   ? 'var(--violet)'
                  : inv.role === 'student' ? 'var(--accent-l)'
                  : 'var(--primary)';

  return (
    <motion.div variants={listItem} className="card"
      style={{ padding:14, display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <div style={{
            width:36, height:36, borderRadius:10,
            background: iconBg, color: iconFg,
            display:'grid', placeItems:'center', flexShrink:0,
          }}>
            <Icon name={iconName} size={16}/>
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13.5, fontWeight:700, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              {inv.label || (isStudent && inv.group?.name) || ROLE_LABEL[inv.role]}
              <span className="chip" style={{ background:st.bg, color:st.color, fontSize:10.5 }}>{st.label}</span>
            </div>
            <div style={{ fontSize:11.5, color:'var(--text-3)', marginTop:2 }}>
              {ROLE_LABEL[inv.role]}
              {isStudent && inv.group && <> · <span style={{ fontFamily:'var(--mono)' }}>{inv.group.code}</span></>}
              {' · '}
              <span style={{ fontWeight:600, color:'var(--text-2)' }}>{usesCount}/{inv.maxUses}</span> ishlatilgan
              {inv.expiresAt && <> · {formatDate(inv.expiresAt)} gacha</>}
            </div>
          </div>
        </div>
      </div>

      <div style={{
        display:'flex', alignItems:'center', gap:8,
        padding:'8px 10px',
        background:'var(--bg-subtle)', borderRadius:8,
      }}>
        <code style={{
          flex:1, fontSize:11, fontFamily:'var(--mono)', color:'var(--text-2)',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{inv.link || '—'}</code>
        <button className="btn btn-ghost btn-icon" style={{ width:28, height:28 }}
          disabled={!inv.link} onClick={() => onCopy(inv.link)}>
          <Icon name="copy" size={13}/>
        </button>
      </div>

      {hasUses && (
        <div>
          <button onClick={() => setExpanded(e => !e)}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'6px 10px', fontSize:12, color:'var(--text-2)',
              background:'transparent', borderRadius:6, cursor:'pointer',
              width:'100%', textAlign:'left',
            }}>
            <Icon name={expanded ? 'arrowDown' : 'arrowRight'} size={12}/>
            <span style={{ fontWeight:600 }}>{usesCount} foydalanuvchi</span>
            <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-3)' }}>
              {expanded ? "yopish" : "ko'rish"}
            </span>
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                style={{ overflow:'hidden' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:6, paddingTop:6 }}>
                  {userUses.map(u => <UseChip key={u._id} user={u}/>)}
                  {studentUses.map(u => <UseChip key={u._id} user={u}/>)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {!inv.revokedAt && !inv.isExpired && !inv.isUsed && (
        <div style={{ display:'flex', gap:6 }}>
          <button className="btn btn-ghost" onClick={() => onRevoke(inv)} style={{ fontSize:12 }}>
            <Icon name="alert" size={12}/> Bekor qilish
          </button>
          <span style={{ fontSize:11, color:'var(--text-3)', alignSelf:'center', marginLeft:'auto' }}>
            ← O'chirish uchun suring
          </span>
        </div>
      )}
    </motion.div>
  );
}

export default function InvitesPage({ embedded = false }) {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const { data, loading, error, refetch } = useFetch(() => api.invites.list(), []);
  const { data: groupsData } = useFetch(() => api.groups.list({ limit: 100 }), []);
  const invites = data ?? [];
  const groups = useMemo(() => {
    const list = Array.isArray(groupsData) ? groupsData : (groupsData?.data ?? []);
    return list;
  }, [groupsData]);

  const copy = async (link) => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      haptic.success();
      setCopiedId(link);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      try { window.Telegram?.WebApp?.openTelegramLink?.(link); } catch {}
    }
  };

  const revoke = async (inv) => {
    if (!confirm('Bu havola bekor qilinsinmi?')) return;
    try { await api.invites.revoke(inv._id); refetch(); } catch (e) { alert(e.message); }
  };
  const remove = async (inv) => {
    try { await api.invites.delete(inv._id); refetch(); }
    catch (e) { alert(e.message); throw e; }
  };

  const title = isTeacher ? "Takliflar" : 'Invite linklar';
  const subtitle = isTeacher
    ? "Bot orqali o'quvchilarni guruhga taklif qilish uchun havolalar"
    : 'Bot orqali kirish uchun';

  const Wrapper = embedded ? motion.div : motion.div;
  const wrapperProps = embedded
    ? { initial:{ opacity:0 }, animate:{ opacity:1 }, transition:{ duration:0.25 }, style:{ display:'flex', flexDirection:'column', gap:14 } }
    : { className:'page', initial:{ opacity:0, y:8 }, animate:{ opacity:1, y:0 }, transition:{ duration:0.35 } };

  return (
    <Wrapper {...wrapperProps}>
      {!embedded && (
        <div className="page-hd">
          <div>
            <h1 className="page-title">{title}</h1>
            <div className="page-sub">{invites.length} ta link · {subtitle}</div>
          </div>
          <div className="page-acts">
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}
              disabled={isTeacher && groups.length === 0}
              title={isTeacher && groups.length === 0 ? "Avval guruh yarating" : ''}>
              <Icon name="plus" size={13}/> Yangi link
            </button>
          </div>
        </div>
      )}
      {embedded && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:12.5, color:'var(--text-3)' }}>
            {invites.length} ta link · {subtitle}
          </div>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}
            disabled={isTeacher && groups.length === 0} style={{ fontSize:12.5 }}>
            <Icon name="plus" size={13}/> Yangi link
          </button>
        </div>
      )}

      {copiedId && (
        <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }}
          style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)',
            background:'var(--primary)', color:'#fff', padding:'8px 14px',
            borderRadius:8, fontSize:12.5, fontWeight:600, zIndex:300, boxShadow:'var(--shadow-lg)' }}>
          Nusxa olindi
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {loading ? <motion.div key="l" exit={{ opacity:0 }}><Spinner/></motion.div>
        : error ? <ErrorBox message={error} onRetry={refetch}/>
        : invites.length === 0 ? (
          <div style={{ padding:'60px 0', textAlign:'center', color:'var(--text-3)' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🔗</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Hech qanday taklif yo'q</div>
            <div style={{ fontSize:12.5, marginTop:5 }}>
              {isTeacher && groups.length === 0
                ? "Avval guruh yarating, keyin taklif link beriladi."
                : '"Yangi link" tugmasini bosing.'}
            </div>
          </div>
        ) : (
          <motion.div key="g" variants={listContainer} initial="hidden" animate="show"
            style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:12 }}>
            {invites.map(inv => (
              <SwipeToDelete key={inv._id} onDelete={() => remove(inv)}>
                <InviteRow inv={inv} onRevoke={revoke} onCopy={copy}/>
              </SwipeToDelete>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <CreateInviteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => refetch()}
        isTeacher={isTeacher}
        groups={groups}
      />
    </Wrapper>
  );
}
