import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal, Field, Textarea } from './Modal.jsx';
import { Icon, Avatar } from './ui.jsx';
import { Spinner, ErrorBox } from './Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { sfx } from '../hooks/useSound.js';
import api from '../services/api.js';

export const STATUS_LABEL = {
  pending:   "Kutilmoqda",
  submitted: "Topshirildi",
  reviewed:  "Belgilandi",
  returned:  "Qaytarildi",
};
export const STATUS_CHIP = {
  pending:   'chip-neutral',
  submitted: 'chip-info',
  reviewed:  'chip-success',
  returned:  'chip-warning',
};
export const STATUS_ICON = {
  pending:   'clock',
  submitted: 'send',
  reviewed:  'check',
  returned:  'alert',
};

/* ── Katta tap-target checkbox ── */
export function ReviewCheckbox({ checked, onChange, disabled, size = 26 }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={e => { e.stopPropagation(); onChange(!checked); }}
      style={{
        width:size, height:size, minWidth:size, flexShrink:0,
        borderRadius:8,
        border: checked ? 'none' : '2px solid var(--border-md)',
        background: checked
          ? 'linear-gradient(135deg, var(--primary), var(--primary-d))'
          : 'var(--bg-card)',
        boxShadow: checked ? '0 2px 10px rgba(99,102,241,0.35)' : 'none',
        display:'grid', placeItems:'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition:'all 160ms',
      }}>
      <AnimatePresence>
        {checked && (
          <motion.span
            initial={{ scale:0, rotate:-30 }} animate={{ scale:1, rotate:0 }}
            exit={{ scale:0 }} transition={{ duration:0.18 }}
            style={{ display:'inline-flex', color:'#fff' }}>
            <Icon name="check" size={Math.round(size * 0.6)}/>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/* ── Bitta o'quvchi qatori (checkbox-fokusli) ── */
export function StudentRow({ sub, onUpdate, canEdit, busy }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(sub.score ?? '');
  const [feedback, setFeedback] = useState(sub.feedback || '');
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState(sub.status);

  useEffect(() => {
    setScore(sub.score ?? '');
    setFeedback(sub.feedback || '');
    setLocalStatus(sub.status);
  }, [sub._id, sub.score, sub.feedback, sub.status]);

  const setStatus = async (next) => {
    if (!canEdit || busy) return;
    const prev = localStatus;
    setLocalStatus(next);
    if (next === 'reviewed') sfx.success();
    else if (next === 'returned') sfx.error?.();
    else sfx.click();
    try {
      await onUpdate(sub._id, { status: next });
    } catch {
      setLocalStatus(prev);
    }
  };

  const toggleReviewed = (next) => setStatus(next ? 'reviewed' : 'pending');

  const saveDetails = async () => {
    setSaving(true);
    try {
      await onUpdate(sub._id, {
        score: score === '' ? null : Number(score),
        feedback: feedback.trim(),
      });
      setOpen(false);
    } finally { setSaving(false); }
  };

  const s = sub.student || {};
  const isReviewed  = localStatus === 'reviewed';
  const isSubmitted = localStatus === 'submitted';
  const isReturned  = localStatus === 'returned';

  const rowBg     = isReviewed ? 'var(--primary-bg)' : isReturned ? 'var(--rose-bg)' : isSubmitted ? 'var(--amber-bg)' : 'var(--bg-subtle)';
  const rowBorder = isReviewed ? 'var(--primary)'   : isReturned ? 'var(--rose)'    : isSubmitted ? 'var(--amber)'    : 'var(--border)';
  const statusText  =
    isReviewed  ? 'Belgilandi · ✓'   :
    isReturned  ? 'Qaytarildi · ✕'   :
    isSubmitted ? '📩 Topshirildi'   :
                  'Hali topshirmagan';
  const statusColor =
    isReviewed  ? 'var(--primary-l)' :
    isReturned  ? 'var(--rose)'      :
    isSubmitted ? 'var(--amber)'     :
                  'var(--text-3)';

  return (
    <motion.div layout
      style={{
        background: rowBg,
        border:'1px solid var(--border)',
        borderColor: rowBorder,
        borderRadius:11,
        overflow:'hidden',
        transition:'background 200ms, border-color 200ms',
      }}>
      <div
        style={{
          display:'flex', alignItems:'center', gap:11,
          padding:'11px 12px',
          userSelect:'none',
        }}>
        <Avatar name={s.name || '?'} hue={s.hue ?? 200} size="sm" photoUrl={s.photoUrl}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{
            fontSize:13.5, fontWeight:600,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            color:'var(--text)',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{s.name || '—'}</span>
            {sub.isLate && (
              <span style={{
                fontSize:9.5, fontWeight:700, padding:'1px 6px', borderRadius:5,
                background:'var(--rose-bg)', color:'var(--rose)',
                border:'1px solid var(--rose)', textTransform:'uppercase', letterSpacing:'0.04em',
                flexShrink:0,
              }}>Kech</span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
            <span style={{ fontSize:11, color: statusColor, fontWeight:600 }}>
              {statusText}
            </span>
            {sub.score != null && (
              <span style={{ fontSize:11, color:'var(--text-3)', fontVariantNumeric:'tabular-nums' }}>
                · {sub.score}%
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <div style={{ display:'flex', gap:5, flexShrink:0 }}>
            <button
              type="button"
              onClick={() => setStatus(isReviewed ? 'pending' : 'reviewed')}
              disabled={busy}
              title="Qabul qildim (+olmos)"
              style={{
                width:34, height:34, borderRadius:9,
                background: isReviewed ? 'linear-gradient(135deg, var(--primary), var(--primary-d))' : 'var(--bg-card)',
                color: isReviewed ? '#fff' : 'var(--primary-l)',
                border: isReviewed ? 'none' : '1.5px solid var(--border-md)',
                fontSize:16, fontWeight:800, cursor:'pointer',
                boxShadow: isReviewed ? '0 2px 10px rgba(99,102,241,0.35)' : 'none',
              }}>+</button>
            <button
              type="button"
              onClick={() => setStatus(isReturned ? 'pending' : 'returned')}
              disabled={busy}
              title="Qaytarish"
              style={{
                width:34, height:34, borderRadius:9,
                background: isReturned ? 'var(--rose)' : 'var(--bg-card)',
                color: isReturned ? '#fff' : 'var(--rose)',
                border: isReturned ? 'none' : '1.5px solid var(--border-md)',
                fontSize:18, fontWeight:800, cursor:'pointer',
                boxShadow: isReturned ? '0 2px 10px rgba(244,63,94,0.30)' : 'none',
              }}>−</button>
            <button className="btn btn-ghost btn-icon"
              onClick={() => setOpen(o => !o)}
              style={{ width:30, height:30 }}
              title="Izoh va ball">
              <Icon name={open ? 'chevronUp' : 'chevronDown'} size={13}/>
            </button>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && canEdit && (
          <motion.div
            initial={{ height:0, opacity:0 }}
            animate={{ height:'auto', opacity:1 }}
            exit={{ height:0, opacity:0 }}
            transition={{ duration:0.2, ease:[0.22,1,0.36,1] }}
            style={{ overflow:'hidden' }}>
            <div style={{ padding:'10px 12px 12px', borderTop:'1px solid var(--border)', display:'grid', gap:8 }} onClick={e => e.stopPropagation()}>
              <div>
                <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-3)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Ball (0–100, ixtiyoriy)</div>
                <input type="number" min="0" max="100" value={score}
                  onChange={e => setScore(e.target.value)}
                  className="input" style={{ width:'100%' }}
                  placeholder="—"/>
              </div>
              <div>
                <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-3)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Izoh (ixtiyoriy)</div>
                <Textarea value={feedback}
                  onChange={e => setFeedback(e.target.value)} maxLength={500}
                  placeholder="O'quvchiga izoh..."
                  style={{ minHeight:60 }}/>
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:6 }}>
                <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>Bekor</button>
                <button className="btn btn-primary" onClick={saveDetails} disabled={saving}>
                  {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Modal wrapper (eski API'ni saqlash uchun, hozir HomeworkDetail page'da ham ishlatiladi) ── */
export default function SubmissionsModal({ open, onClose, homework, onChanged }) {
  const { user } = useAuth();
  const isAdmin   = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const myTeacherId = user?.teacherRef?._id || user?.teacherRef;
  const hwTeacherId = homework?.teacher?._id || homework?.teacher;
  const canEdit = isAdmin || (isTeacher && String(myTeacherId) === String(hwTeacherId));

  const [subs, setSubs]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);

  const load = async () => {
    if (!homework?._id) return;
    setLoading(true); setError('');
    try {
      const res = await api.homework.submissions(homework._id);
      setSubs(res?.data || res || []);
    } catch (e) {
      setError(e.message || 'Xatolik');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, homework?._id]);

  const update = async (id, data) => {
    setBusy(true);
    try {
      await api.submissions.update(id, data);
      await load();
      onChanged?.();
    } finally { setBusy(false); }
  };

  const counts = useMemo(() => {
    const c = { pending:0, submitted:0, reviewed:0, returned:0 };
    for (const s of subs) c[s.status] = (c[s.status] || 0) + 1;
    return c;
  }, [subs]);
  const total = subs.length;

  if (!homework) return null;

  return (
    <Modal open={open} onClose={onClose}
      title={homework.title}
      subtitle={`${homework.group?.name || ''}${homework.group?.code ? ' · ' + homework.group.code : ''}`}
      width={520}
      footer={<button className="btn btn-ghost" onClick={onClose}>Yopish</button>}>

      {loading ? <Spinner/>
      : error  ? <ErrorBox message={error} onRetry={load}/>
      : total === 0 ? (
        <div style={{ padding:'30px 0', textAlign:'center', color:'var(--text-3)' }}>
          <div style={{ fontSize:32, marginBottom:6 }}>👥</div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-2)' }}>Bu vazifaga o'quvchi yo'q</div>
          <div style={{ fontSize:11.5, marginTop:4 }}>Guruhga o'quvchi qo'shgach, ular avtomatik biriktiriladi.</div>
        </div>
      ) : (
        <>
          {/* Umumiy hisob */}
          {canEdit && (
            <div style={{
              padding:'10px 12px', marginBottom:10,
              background:'var(--bg-subtle)', borderRadius:10,
              border:'1px solid var(--border)',
              fontSize:12.5, color:'var(--text-2)',
            }}>
              {counts.reviewed} / {total} belgilandi
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {subs.map(sub => (
              <StudentRow key={sub._id} sub={sub} onUpdate={update} canEdit={canEdit} busy={busy}/>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
