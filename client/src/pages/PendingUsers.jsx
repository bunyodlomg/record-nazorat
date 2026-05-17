import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Avatar } from '../components/ui.jsx';
import { Spinner, ErrorBox, listContainer, listItem } from '../components/Feedback.jsx';
import { Modal, Field } from '../components/Modal.jsx';
import { useFetch } from '../hooks/useFetch.js';
import api from '../services/api.js';

const ROLE_LABEL = { admin:'Admin', teacher:"O'qituvchi", student:"O'quvchi" };

function ApproveModal({ open, onClose, user, onDone }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError(''); setSaving(true);
    try {
      // Teacher uchun subject avtomatik 'Ingliz tili' (backend default)
      // student bo'lsa pendingGroupRef avtomatik ishlatiladi
      await api.users.approve(user._id, {});
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Xatolik');
    } finally { setSaving(false); }
  };

  if (!user) return null;
  const groupName = user.pendingGroupRef?.name || user.studentRef?.group?.name;
  const groupCode = user.pendingGroupRef?.code;

  return (
    <Modal open={open} onClose={onClose}
      title="Tasdiqlash"
      subtitle={`${user.name} (${ROLE_LABEL[user.role] || user.role}) tasdiqlangach kira oladi.`}
      width={420}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Bekor qilish</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'Tasdiqlanmoqda...' : 'Tasdiqlash'}
        </button>
      </>}
    >
      {error && (
        <div style={{ marginBottom:12, padding:'10px 12px', background:'var(--rose-bg)', border:'1px solid var(--rose)', borderRadius:8, color:'var(--rose)', fontSize:12.5 }}>{error}</div>
      )}
      {user.role === 'teacher' && (
        <div style={{
          marginBottom:14, padding:'10px 12px',
          background:'var(--primary-bg)', border:'1px solid rgba(45,212,191,0.20)',
          borderRadius:10, fontSize:12.5, color:'var(--text-2)', lineHeight:1.6,
        }}>
          <Icon name="sparkles" size={12} style={{ verticalAlign:-1, marginRight:4, color:'var(--primary-l)' }}/>
          Ingliz tili o'qituvchisi profili avtomatik yaratiladi.
        </div>
      )}
      {user.role === 'student' && groupName && (
        <Field label="Guruh" hint="Taklif linkida ko'rsatilgan guruh">
          <div style={{
            padding:'10px 12px', background:'var(--primary-bg)',
            border:'1px solid rgba(45,212,191,0.20)', borderRadius:8,
            fontSize:13, fontWeight:600, color:'var(--primary-l)',
          }}>
            {groupName} {groupCode && <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-3)', marginLeft:6 }}>{groupCode}</span>}
          </div>
        </Field>
      )}
      <div style={{
        padding:'12px 14px', background:'var(--bg-subtle)',
        borderRadius:10, fontSize:12.5, color:'var(--text-2)', lineHeight:1.6,
      }}>
        Telegram: <b style={{ color:'var(--text)' }}>{user.telegramUsername ? `@${user.telegramUsername}` : '—'}</b><br/>
        ID: <code style={{ fontFamily:'var(--mono)', fontSize:11.5 }}>{user.telegramId || '—'}</code>
      </div>
    </Modal>
  );
}

const ROLE_COLOR = {
  admin:   ['var(--violet-bg)','var(--violet)'],
  teacher: ['var(--accent-bg)','var(--accent-l)'],
  student: ['var(--primary-bg)','var(--primary)'],
};

function PendingTable({ users, onApprove, onReject }) {
  return (
    <motion.div variants={listItem} className="card" style={{ overflow:'hidden' }}>
      <div style={{ overflowX:'auto' }}>
        <table className="tbl">
          <thead><tr>
            <th>Foydalanuvchi</th>
            <th>Roli</th>
            <th>Telegram</th>
            <th>Guruh</th>
            <th style={{ textAlign:'right' }}>Amallar</th>
          </tr></thead>
          <tbody>
            {users.map(u => {
              const [bg, fg] = ROLE_COLOR[u.role] || ROLE_COLOR.student;
              return (
                <tr key={u._id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      {u.photoUrl ? (
                        <img src={u.photoUrl} alt={u.name}
                          style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>
                      ) : (
                        <Avatar name={u.name} hue={u.role === 'student' ? 200 : u.role === 'teacher' ? 165 : 270} size="sm"/>
                      )}
                      <div style={{ fontWeight:600 }}>{u.name}</div>
                    </div>
                  </td>
                  <td>
                    <span className="chip" style={{ background:bg, color:fg, fontSize:10.5 }}>
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </td>
                  <td style={{ color:'var(--text-2)', fontSize:12.5 }}>
                    {u.telegramUsername ? `@${u.telegramUsername}` : (u.telegramId ? `ID ${u.telegramId}` : '—')}
                  </td>
                  <td style={{ color:'var(--text-2)', fontSize:12.5 }}>
                    {u.pendingGroupRef
                      ? (u.pendingGroupRef.code || u.pendingGroupRef.name)
                      : '—'}
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                      <button className="btn btn-primary" style={{ fontSize:12, padding:'6px 12px' }}
                        onClick={() => onApprove(u)} title="Tasdiqlash">
                        <Icon name="check" size={13}/>
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize:12, padding:'6px 10px', color:'var(--rose)' }}
                        onClick={() => onReject(u)} title="Rad etish">
                        <Icon name="close" size={13}/>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

export default function PendingUsersPage({ embedded = false, onChange }) {
  const [target, setTarget] = useState(null);
  const { data, loading, error, refetch } = useFetch(() => api.users.list({ status:'pending' }), []);
  const users = data ?? [];

  const reload = () => { refetch(); onChange?.(); };

  const reject = async (u) => {
    if (!confirm(`${u.name} ni rad etishni tasdiqlang?`)) return;
    try { await api.users.reject(u._id); reload(); } catch (e) { alert(e.message); }
  };

  const wrapperProps = embedded
    ? { initial:{ opacity:0 }, animate:{ opacity:1 }, transition:{ duration:0.25 }, style:{ display:'flex', flexDirection:'column', gap:14 } }
    : { className:'page', initial:{ opacity:0, y:8 }, animate:{ opacity:1, y:0 }, transition:{ duration:0.35 } };

  return (
    <motion.div {...wrapperProps}>
      {!embedded && (
        <div className="page-hd">
          <div>
            <h1 className="page-title">Kutayotganlar</h1>
            <div className="page-sub">{users.length} ta tasdiqlash kutilmoqda</div>
          </div>
          <div className="page-acts">
            <button className="btn btn-ghost" onClick={refetch}>
              <Icon name="activity" size={13}/> Yangilash
            </button>
          </div>
        </div>
      )}
      {embedded && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:12.5, color:'var(--text-3)' }}>
            {users.length} ta kutayotgan foydalanuvchi
          </div>
          <button className="btn btn-ghost" onClick={refetch} style={{ fontSize:12.5 }}>
            <Icon name="activity" size={13}/> Yangilash
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {loading ? <motion.div key="l" exit={{ opacity:0 }}><Spinner/></motion.div>
        : error ? <ErrorBox message={error} onRetry={refetch}/>
        : users.length === 0 ? (
          <div style={{ padding:'60px 0', textAlign:'center', color:'var(--text-3)' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>✓</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Bo'sh — hammasi tasdiqlangan</div>
          </div>
        ) : (
          <motion.div key="g" variants={listContainer} initial="hidden" animate="show">
            <PendingTable users={users} onApprove={setTarget} onReject={reject}/>
          </motion.div>
        )}
      </AnimatePresence>

      <ApproveModal
        open={!!target}
        user={target}
        onClose={() => setTarget(null)}
        onDone={reload}
      />
    </motion.div>
  );
}
