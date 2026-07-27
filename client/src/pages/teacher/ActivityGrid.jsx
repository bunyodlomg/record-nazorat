import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Icon, Avatar } from '../../components/ui.jsx';
import { Spinner, ErrorBox } from '../../components/Feedback.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useStickyState } from '../../hooks/useStickyState.js';
import { sfx } from '../../hooks/useSound.js';
import api from '../../services/api.js';

const cellTitle = (cell) => {
  const multi = cell.total > 1 ? ` (${cell.done}/${cell.total})` : '';
  switch (cell.status) {
    case 'done':     return `Topshirgan${multi} — bekor qilish uchun bosing`;
    case 'partial':  return `Qisman (${cell.done}/${cell.total}) — belgilash uchun bosing`;
    case 'missed':   return `Topshirmagan${multi} — belgilash uchun bosing`;
    case 'upcoming': return 'Muddati kelmagan';
    default:         return "Vazifa yo'q";
  }
};

/* Bitta kun katakchasi — neon nuqta (yashil = topshirgan, qizil = topshirmagan).
   Bosilganda o'sha kunning barcha vazifalari belgilanadi / bekor qilinadi. */
function Cell({ cell, busy, onToggle }) {
  const status = cell?.status || 'none';
  const title  = cellTitle(cell || {});

  if (status === 'none') {
    return <span className="ag-cell"><span className="ag-dash" title={title}/></span>;
  }

  const canToggle = status !== 'upcoming' && (cell.ids?.length > 0);
  const dot = <span className={`ag-dot ag-${status}`}/>;

  if (!canToggle) {
    return <span className="ag-cell" title={title}>{dot}</span>;
  }
  return (
    <button
      type="button"
      className={`ag-cell ${busy ? 'ag-busy' : ''}`}
      title={title}
      disabled={busy}
      onClick={() => onToggle(cell)}>
      {dot}
    </button>
  );
}

function StatChip({ value, label, bg, color, icon }) {
  return (
    <span className="ag-chip" style={{ background: bg, color }}>
      <Icon name={icon} size={12}/> {value} <span style={{ opacity: 0.75, fontWeight: 500 }}>{label}</span>
    </span>
  );
}

export default function ActivityGrid() {
  const [range, setRange]     = useStickyState('activity:range', 'week');   // 'week' | 'month'
  const [groupId, setGroupId] = useStickyState('activity:groupId', null);
  const [busyKey, setBusyKey] = useState(null);

  const { data, loading, error, refetch } = useFetch(
    () => api.submissions.grid({ range, ...(groupId ? { groupId } : {}) }),
    [range, groupId]
  );
  const { data: groupListData } = useFetch(() => api.groups.list({ limit: 100 }), []);
  // useFetch javobni yechib beradi — bu yerda to'g'ridan-to'g'ri massiv keladi
  const groupOptions = Array.isArray(groupListData) ? groupListData : (groupListData?.data ?? []);

  const days     = data?.days ?? [];
  const students = data?.students ?? [];

  const totalDone   = students.reduce((s, x) => s + (x.stats?.done   || 0), 0);
  const totalMissed = students.reduce((s, x) => s + (x.stats?.missed || 0), 0);

  /* Katakni belgilash: yashil bo'lsa bekor qilinadi, aks holda hammasi "reviewed" */
  const toggleCell = useCallback(async (studentId, dayKey, cell) => {
    const key = `${studentId}|${dayKey}`;
    if (busyKey) return;
    const next = cell.done >= cell.total ? 'pending' : 'reviewed';
    setBusyKey(key);
    try {
      await api.submissions.bulk(cell.ids, next);
      next === 'reviewed' ? sfx.success() : sfx.click();
      await refetch({ silent: true });
    } catch (e) {
      alert(e.message || 'Xatolik');
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, refetch]);

  return (
    <motion.div className="page ag-page"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

      <div className="ag-top">
        <div className="ag-hd">
          <span className="ag-hd-title">📊 Faollik jadvali</span>
          <StatChip value={students.length} label="o'quvchi" icon="user"
            bg="rgba(56,189,248,0.14)" color="#0ea5e9"/>
          <StatChip value={totalDone} label="topshirgan" icon="check"
            bg="rgba(16,185,129,0.14)" color="#10b981"/>
          <StatChip value={totalMissed} label="topshirmagan" icon="alert"
            bg="rgba(244,63,94,0.14)" color="#f43f5e"/>
        </div>

        {/* Hafta / Oy + guruh filtri — bitta qatorda */}
        <div className="ag-ctl">
          <button className={`tab ${range === 'week'  ? 'active' : ''}`} onClick={() => setRange('week')}>
            <Icon name="calendar" size={12} style={{ marginRight: 4, verticalAlign: -1 }}/> 1 hafta
          </button>
          <button className={`tab ${range === 'month' ? 'active' : ''}`} onClick={() => setRange('month')}>
            <Icon name="calendar" size={12} style={{ marginRight: 4, verticalAlign: -1 }}/> 1 oy
          </button>

          {groupOptions.length > 1 && <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }}/>}
          {groupOptions.length > 1 && (
            <button className={`tab ${!groupId ? 'active' : ''}`} onClick={() => setGroupId(null)}>
              Barcha guruh
            </button>
          )}
          {groupOptions.length > 1 && groupOptions.map(g => (
            <button key={g._id} className={`tab ${groupId === g._id ? 'active' : ''}`}
              onClick={() => setGroupId(g._id)}>
              {g.code || g.name}
            </button>
          ))}
        </div>

        <div className="ag-legend">
          <span><span className="ag-dot ag-done"/> Topshirgan</span>
          <span><span className="ag-dot ag-missed"/> Topshirmagan</span>
          <span><span className="ag-dot ag-partial"/> Qisman</span>
          <span style={{ color: 'var(--text-3)' }}>· Belgilash uchun katakni bosing</span>
        </div>
      </div>

      {loading ? <Spinner/> :
       error   ? <ErrorBox message={error} onRetry={refetch}/> :
       students.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>O'quvchi topilmadi</div>
        </div>
       ) : (
        <div className="card ag-card">
          <div className="ag-scroll">
            <table className={`ag-table ${range === 'month' ? 'ag-compact' : ''}`}>
              <thead>
                <tr>
                  <th className="ag-name-col">O'quvchi</th>
                  {days.map(d => (
                    <th key={d.key} className={`ag-day ${d.weekend ? 'ag-weekend' : ''} ${d.isToday ? 'ag-today' : ''}`}>
                      <span className="ag-dow">{d.dow}</span>
                      <span className="ag-dom">{d.dom}</span>
                    </th>
                  ))}
                  <th className="ag-rate-col">%</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
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
                        <Cell
                          cell={c}
                          busy={busyKey === `${s._id}|${days[ci]?.key}`}
                          onToggle={cell => toggleCell(s._id, days[ci]?.key, cell)}/>
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
  );
}
