import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Avatar } from '../../components/ui.jsx';
import { Spinner, ErrorBox } from '../../components/Feedback.jsx';
import PageHero from '../../components/PageHero.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import api from '../../services/api.js';

/* Bitta kun katakchasi — neon nuqta (yashil = topshirgan, qizil = topshirmagan) */
function Dot({ cell, delay = 0 }) {
  const status = cell?.status || 'none';
  const title =
    status === 'done'     ? `Topshirgan${cell.total > 1 ? ` (${cell.done}/${cell.total})` : ''}` :
    status === 'partial'  ? `Qisman (${cell.done}/${cell.total})` :
    status === 'missed'   ? `Topshirmagan${cell.total > 1 ? ` (0/${cell.total})` : ''}` :
    status === 'upcoming' ? 'Muddati kelmagan' :
                            'Vazifa yo\'q';

  if (status === 'none') {
    return <span className="ag-cell"><span className="ag-dash" title={title}/></span>;
  }
  return (
    <span className="ag-cell">
      <motion.span
        className={`ag-dot ag-${status}`}
        title={title}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay, type: 'spring', stiffness: 500, damping: 22 }}
      />
    </span>
  );
}

export default function ActivityGrid() {
  const [range, setRange]     = useState('week');   // 'week' | 'month'
  const [groupId, setGroupId] = useState(null);

  const { data, loading, error, refetch } = useFetch(
    () => api.submissions.grid({ range, ...(groupId ? { groupId } : {}) }),
    [range, groupId]
  );
  const { data: groupListData } = useFetch(() => api.groups.list({ limit: 100 }), []);
  const groupOptions = groupListData?.data ?? [];

  const days     = data?.days ?? [];
  const students = data?.students ?? [];

  const totalDone   = students.reduce((s, x) => s + (x.stats?.done   || 0), 0);
  const totalMissed = students.reduce((s, x) => s + (x.stats?.missed || 0), 0);

  const heroStats = [
    { value: students.length, label: "O'quvchilar", icon: 'user',   bg: 'rgba(56,189,248,0.14)', color: '#0ea5e9' },
    { value: totalDone,        label: 'Topshirgan',  icon: 'check',  bg: 'rgba(16,185,129,0.14)', color: '#10b981' },
    { value: totalMissed,      label: 'Topshirmagan', icon: 'alert', bg: 'rgba(244,63,94,0.14)',  color: '#f43f5e' },
  ];

  return (
    <motion.div className="page"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <PageHero
        title="Faollik jadvali"
        subtitle={range === 'week' ? "So'nggi 7 kun — topshirgan va topshirmagan kunlar" : "So'nggi 30 kun — topshirgan va topshirmagan kunlar"}
        emoji="📊"
        stats={heroStats}
      />

      {/* Hafta / Oy almashtirgich */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${range === 'week' ? 'active' : ''}`} onClick={() => setRange('week')}>
          <Icon name="calendar" size={12} style={{ marginRight: 4, verticalAlign: -1 }}/> 1 hafta
        </button>
        <button className={`tab ${range === 'month' ? 'active' : ''}`} onClick={() => setRange('month')}>
          <Icon name="calendar" size={12} style={{ marginRight: 4, verticalAlign: -1 }}/> 1 oy
        </button>
      </div>

      {/* Guruh filtri */}
      {groupOptions.length > 1 && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setGroupId(null)} className="chip"
            style={{
              cursor: 'pointer', padding: '6px 12px', fontSize: 12,
              background: !groupId ? 'var(--primary)' : 'var(--bg-subtle)',
              color: !groupId ? '#fff' : 'var(--text-2)',
              border: !groupId ? 'none' : '1px solid var(--border)',
            }}>
            Barchasi
          </button>
          {groupOptions.map(g => (
            <button key={g._id} onClick={() => setGroupId(g._id)} className="chip"
              style={{
                cursor: 'pointer', padding: '6px 12px', fontSize: 12,
                background: groupId === g._id ? 'var(--primary)' : 'var(--bg-subtle)',
                color: groupId === g._id ? '#fff' : 'var(--text-2)',
                border: groupId === g._id ? 'none' : '1px solid var(--border)',
              }}>
              {g.code || g.name}
            </button>
          ))}
        </div>
      )}

      {/* Belgilar izohi */}
      <div className="ag-legend">
        <span><span className="ag-dot ag-done"/> Topshirgan</span>
        <span><span className="ag-dot ag-missed"/> Topshirmagan</span>
        <span><span className="ag-dot ag-partial"/> Qisman</span>
        <span><span className="ag-dot ag-upcoming"/> Kutilmoqda</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={range + (groupId || '')}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}>
          {loading ? <Spinner/> :
           error   ? <ErrorBox message={error} onRetry={refetch}/> :
           students.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-3)' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>O'quvchi topilmadi</div>
            </div>
           ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="ag-scroll">
                <table className={`ag-table ${range === 'month' ? 'ag-compact' : ''}`}>
                  <thead>
                    <tr>
                      <th className="ag-name-col">O'quvchi</th>
                      {days.map((d, i) => (
                        <th key={d.key} className={`ag-day ${d.weekend ? 'ag-weekend' : ''} ${d.isToday ? 'ag-today' : ''}`}>
                          <span className="ag-dow">{d.dow}</span>
                          <span className="ag-dom">{d.dom}</span>
                        </th>
                      ))}
                      <th className="ag-rate-col">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, ri) => (
                      <tr key={s._id}>
                        <td className="ag-name-col">
                          <div className="ag-student">
                            <Avatar name={s.name} hue={s.hue || 200} size="sm" photoUrl={s.photoUrl}/>
                            <div style={{ minWidth: 0 }}>
                              <div className="ag-student-name">{s.name}</div>
                              <div className="ag-student-sub">
                                <span style={{ color: 'var(--primary-l, #10b981)' }}>{s.stats.done}✓</span>
                                {' · '}
                                <span style={{ color: '#fb7185' }}>{s.stats.missed}✗</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        {s.cells.map((c, ci) => (
                          <td key={ci} className={days[ci]?.isToday ? 'ag-today' : ''}>
                            <Dot cell={c} delay={Math.min(0.15 + (ri * 0.015) + (ci * 0.012), 1.1)}/>
                          </td>
                        ))}
                        <td className="ag-rate-col">
                          {s.stats.rate == null
                            ? <span style={{ color: 'var(--text-3)' }}>—</span>
                            : <span style={{ fontWeight: 700, color: s.stats.rate >= 70 ? '#10b981' : s.stats.rate >= 40 ? '#f59e0b' : '#fb7185' }}>{s.stats.rate}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
           )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
