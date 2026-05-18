import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Avatar } from '../components/ui.jsx';
import { Spinner, ErrorBox } from '../components/Feedback.jsx';
import { Modal, Select } from '../components/Modal.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

const MONTHS = [
  'Yanvar','Fevral','Mart','Aprel','May','Iyun',
  'Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr',
];
const DAYS_SHORT = ['Du','Se','Ch','Pa','Ju','Sh','Ya'];
const DAYS_LONG  = ['Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba','Yakshanba'];

const fmtDateKey = (y, m, d) =>
  `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

const TONE = {
  green:  { bg:'rgba(16,185,129,0.16)',  color:'#6ee7b7', border:'rgba(16,185,129,0.55)', solid:'#10b981' },
  amber:  { bg:'rgba(251,191,36,0.16)',  color:'#fcd34d', border:'rgba(251,191,36,0.55)', solid:'#fbbf24' },
  indigo: { bg:'rgba(99,102,241,0.18)',  color:'#c7d2fe', border:'rgba(99,102,241,0.6)',  solid:'#6366f1' },
  violet: { bg:'rgba(167,139,250,0.16)', color:'#c4b5fd', border:'rgba(167,139,250,0.55)', solid:'#a78bfa' },
};

/* Dushanba'dan boshlangan haftaning birinchi kunini topish */
function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Yak
  const diff = (dow + 6) % 7; // Du=0
  d.setDate(d.getDate() - diff);
  return d;
}

/* "Bugungi vaqt" chizig'i uchun (HH:MM → ofset 0..1) */
function nowFraction() {
  const n = new Date();
  return (n.getHours() * 60 + n.getMinutes()) / (24 * 60);
}

/* ── Admin uchun teacher dropdown paneli ── */
function AdminTeacherFilterPanel({ teachers, selectedTeacherId, onSelect, onOpenDetail }) {
  const sorted = useMemo(() => {
    return [...teachers].sort((a, b) => {
      const ap = (a.submissions?.pending || 0) + (a.groupsStats?.partial || 0) * 100;
      const bp = (b.submissions?.pending || 0) + (b.groupsStats?.partial || 0) * 100;
      return bp - ap;
    });
  }, [teachers]);

  const selected = useMemo(
    () => teachers.find(t => t._id === selectedTeacherId) || null,
    [teachers, selectedTeacherId],
  );

  const totals = useMemo(() => {
    let pending = 0, partial = 0;
    for (const t of teachers) {
      pending += t.submissions?.pending || 0;
      partial += t.groupsStats?.partial || 0;
    }
    return { pending, partial };
  }, [teachers]);

  // Tanlangan teacher uchun individual stats
  const sel = selected;
  const selSubs = sel?.submissions || { reviewed:0, pending:0 };
  const selGs   = sel?.groupsStats || { total:0, partial:0, complete:0 };
  const selHasIssue = selSubs.pending > 0 || selGs.partial > 0;

  return (
    <div className="card" style={{ padding:'12px 13px', marginBottom:14, overflow:'visible', position:'relative', zIndex:50 }}>
      <div style={{ marginBottom:8, fontSize:11.5, color:'var(--text-2)' }}>
        {sel
          ? <span style={{ color:'var(--primary-l)', fontWeight:600 }}>Tanlangan o'qituvchi bo'yicha filter</span>
          : (totals.pending > 0
              ? <><span style={{ color:'var(--amber)', fontWeight:600 }}>{totals.partial} chala</span> · {totals.pending} ta tekshirilmagan</>
              : "Hammasi to'liq")}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: sel ? 10 : 0 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <Select
            value={selectedTeacherId || ''}
            onChange={e => onSelect(e.target.value || null)}>
            <option value="">Hamma o'qituvchilar</option>
            {sorted.map(t => {
              const p = t.submissions?.pending || 0;
              return (
                <option key={t._id} value={t._id}>
                  {t.name}{p > 0 ? ` · ${p} tekshirilmagan` : ''}
                </option>
              );
            })}
          </Select>
        </div>
        {sel && (
          <button onClick={() => onSelect(null)}
            className="btn btn-ghost btn-sm" style={{ fontSize:11.5, flexShrink:0 }}>
            <Icon name="close" size={11}/> Tozalash
          </button>
        )}
      </div>

      {/* Tanlangan teacher ma'lumoti */}
      {sel && (
        <motion.div
          initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.2 }}
          style={{
            display:'flex', alignItems:'center', gap:11,
            padding:'10px 11px', borderRadius:10,
            background:'var(--bg-subtle)',
            border:`1px solid ${selHasIssue ? 'rgba(251,191,36,0.30)' : 'var(--border)'}`,
            borderLeft: `3px solid ${selHasIssue ? 'var(--amber)' : 'var(--primary)'}`,
          }}>
          <div style={{ position:'relative', flexShrink:0 }}>
            <Avatar name={sel.name} hue={sel.hue} size="sm"/>
            {sel.presence === 'online' && (
              <span style={{
                position:'absolute', bottom:-1, right:-1, width:9, height:9, borderRadius:'50%',
                background:'#10b981', border:'2px solid var(--bg-subtle)',
              }}/>
            )}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {sel.name}
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
              {selGs.total > 0 ? (
                <>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                    <Icon name="groups" size={10}/>
                    <strong style={{ color:'var(--text-2)' }}>{selGs.total}</strong> guruh
                  </span>
                  {selGs.partial > 0
                    ? <span style={{ color:'var(--amber)', fontWeight:600 }}>· {selGs.partial} chala</span>
                    : <span style={{ color:'var(--primary-l)', fontWeight:600 }}>· to'liq</span>}
                </>
              ) : <span>Guruh yo'q</span>}
            </div>
          </div>
          {selSubs.pending > 0 && (
            <span style={{
              background:'var(--amber-bg)', color:'var(--amber)',
              fontSize:12, fontWeight:700, padding:'4px 9px', borderRadius:7,
              flexShrink:0, minWidth:36, textAlign:'center',
            }}>
              {selSubs.pending}
            </span>
          )}
          <button
            onClick={() => onOpenDetail?.(sel._id)}
            title="To'liq profil"
            className="btn btn-ghost btn-icon"
            style={{ width:30, height:30, flexShrink:0 }}>
            <Icon name="chevronRight" size={13}/>
          </button>
        </motion.div>
      )}
    </div>
  );
}

export default function CalendarPage({ onOpenTeacher }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Admin uchun teachers ro'yxati — kun modali ichida ko'rsatish uchun
  const { data: teachersData } = useFetch(
    () => isAdmin ? api.teachers.list({ limit:200 }) : Promise.resolve({ data:[] }),
    [isAdmin],
  );
  const teachers = useMemo(() => {
    const list = Array.isArray(teachersData) ? teachersData : (teachersData?.data ?? []);
    return list.filter(t => t.status === 'active');
  }, [teachersData]);

  const today = new Date();
  const [mode, setMode]     = useState(isAdmin ? 'month' : 'month'); // 'month' | 'week'
  const [cursor, setCursor] = useState(() => ({ y: today.getFullYear(), m: today.getMonth(), d: today.getDate() }));
  const [picked, setPicked] = useState(null);
  const [nowF, setNowF]     = useState(nowFraction());
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const selectedTeacher = useMemo(
    () => teachers.find(t => t._id === selectedTeacherId) || null,
    [teachers, selectedTeacherId],
  );

  // "Hozir" chizig'i — har daqiqada yangilash
  useEffect(() => {
    const t = setInterval(() => setNowF(nowFraction()), 60_000);
    return () => clearInterval(t);
  }, []);

  /* Range — server'dan tortish uchun */
  const range = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeek(new Date(cursor.y, cursor.m, cursor.d));
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { from: start.toISOString().slice(0,10), to: end.toISOString().slice(0,10) };
    }
    const from = new Date(cursor.y, cursor.m, 1).toISOString().slice(0,10);
    const to   = new Date(cursor.y, cursor.m + 1, 0).toISOString().slice(0,10);
    return { from, to };
  }, [mode, cursor.y, cursor.m, cursor.d]);

  const { data, loading, error, refetch } = useFetch(
    () => api.calendar.events(range.from, range.to, selectedTeacherId || undefined),
    [range.from, range.to, selectedTeacherId],
  );
  const eventsByDate = (data?.data || data || {});
  const totalEvents = Object.values(eventsByDate).reduce((s, arr) => s + arr.length, 0);

  /* Navigatsiya */
  const prev = () => {
    if (mode === 'week') {
      const d = new Date(cursor.y, cursor.m, cursor.d - 7);
      setCursor({ y:d.getFullYear(), m:d.getMonth(), d:d.getDate() });
    } else {
      setCursor(c => c.m === 0 ? { ...c, y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 });
    }
  };
  const next = () => {
    if (mode === 'week') {
      const d = new Date(cursor.y, cursor.m, cursor.d + 7);
      setCursor({ y:d.getFullYear(), m:d.getMonth(), d:d.getDate() });
    } else {
      setCursor(c => c.m === 11 ? { ...c, y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 });
    }
  };
  const goToday = () => setCursor({ y: today.getFullYear(), m: today.getMonth(), d: today.getDate() });

  const headerLabel = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeek(new Date(cursor.y, cursor.m, cursor.d));
      const end = new Date(start); end.setDate(end.getDate() + 6);
      const sm = MONTHS[start.getMonth()].slice(0,3);
      const em = MONTHS[end.getMonth()].slice(0,3);
      if (start.getMonth() === end.getMonth())
        return `${start.getDate()}–${end.getDate()} ${sm} ${end.getFullYear()}`;
      return `${start.getDate()} ${sm} – ${end.getDate()} ${em} ${end.getFullYear()}`;
    }
    return `${MONTHS[cursor.m]} ${cursor.y}`;
  }, [mode, cursor]);

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.35 }}>
      <div className="page-hd">
        <div>
          <h1 className="page-title">Kalendar</h1>
          <div className="page-sub">
            {isAdmin
              ? (selectedTeacher
                  ? <>Filter: <strong style={{ color:'var(--primary-l)' }}>{selectedTeacher.name}</strong> · {headerLabel}</>
                  : `Tekshirish aktivligi · ${headerLabel}`)
              : `Darslar jadvali · ${headerLabel}`}
            {loading ? ' · yangilanmoqda' : ` · ${totalEvents} ta hodisa`}
          </div>
        </div>
        <div className="page-acts" style={{ flexWrap:'wrap' }}>
          <div className="seg">
            <button className={`seg-btn ${mode==='month'?'active':''}`} onClick={() => setMode('month')}>Oy</button>
            <button className={`seg-btn ${mode==='week'?'active':''}`} onClick={() => setMode('week')}>Hafta</button>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={prev} title="Oldingi"><Icon name="chevronLeft" size={14}/></button>
          <button className="btn btn-ghost" onClick={goToday} style={{ fontSize:12 }}>Bugun</button>
          <button className="btn btn-secondary btn-icon" onClick={next} title="Keyingi"><Icon name="chevronRight" size={14}/></button>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={refetch}/>}

      {/* Admin uchun — teacher dropdown filter tepada */}
      {isAdmin && teachers.length > 0 && (
        <AdminTeacherFilterPanel
          teachers={teachers}
          selectedTeacherId={selectedTeacherId}
          onSelect={setSelectedTeacherId}
          onOpenDetail={onOpenTeacher}/>
      )}

      {/* Legend */}
      <div style={{ display:'flex', gap:14, fontSize:12, color:'var(--text-2)', marginBottom:14, alignItems:'center', flexWrap:'wrap' }}>
        {(isAdmin
          ? [['indigo','Berildi'],['green','Tekshirildi'],['amber','Qoldi']]
          : [['green','Darslar']]
        ).map(([t, lbl]) => (
          <span key={lbl} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:10, height:10, borderRadius:3, background:TONE[t].solid, boxShadow:`0 0 8px ${TONE[t].solid}66` }}/>
            {lbl}
          </span>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {mode === 'month' ? (
          <MonthView key="m"
            cursor={cursor} today={today} eventsByDate={eventsByDate}
            onPick={setPicked} isAdmin={isAdmin}
          />
        ) : (
          <WeekView key="w"
            cursor={cursor} today={today} eventsByDate={eventsByDate}
            onPick={setPicked} nowF={nowF} isAdmin={isAdmin}
          />
        )}
      </AnimatePresence>

      {loading && !data && (
        <div style={{ marginTop:16 }}><Spinner/></div>
      )}

      {/* Day Modal */}
      <Modal
        open={!!picked}
        onClose={() => setPicked(null)}
        title={picked ? `${picked.d}-${MONTHS[picked.m]}, ${DAYS_LONG[picked.dow]}` : ''}
        subtitle={picked
          ? (isAdmin
              ? (() => {
                  const s = dayStats(picked.events);
                  if (s.assigned > 0) return `${s.reviewed}/${s.assigned} tekshirildi · ${s.remaining} qoldi`;
                  return `${s.reviewed + s.submitted} ta submission`;
                })()
              : `${picked.events.length} ta dars`)
          : ''}
        width={460}
      >
        {picked && (
          isAdmin
            ? <AdminDayDetails
                events={picked.events}
                teachers={selectedTeacherId ? teachers.filter(t => t._id === selectedTeacherId) : teachers}
                onOpenTeacher={onOpenTeacher}/>
            : <TeacherDayDetails events={picked.events}/>
        )}
      </Modal>
    </motion.div>
  );
}

/* Admin uchun shu kun teacher-day event'laridan umumiy stats — endi har teacher uchun {assigned,reviewed,remaining}.
   Eskirgan stats-reviewed/stats-pending eventlarini ham qoldiramiz (backward-compat). */
function dayStats(events) {
  const out = { assigned:0, reviewed:0, remaining:0, submitted:0 };
  for (const e of events || []) {
    if (e.type === 'teacher-day') {
      out.assigned  += e.assigned  || 0;
      out.reviewed  += e.reviewed  || 0;
      out.remaining += e.remaining || 0;
      out.submitted += e.pending   || 0;
    } else if (e.type === 'stats-reviewed') {
      out.reviewed += e.count || 0;
    } else if (e.type === 'stats-pending') {
      out.submitted += e.count || 0;
    }
  }
  return out;
}

/* Admin uchun kun ichida har teacher uchun breakdown ro'yxati */
function teacherDayBreakdown(events) {
  const list = [];
  for (const e of (events || [])) {
    if (e.type === 'teacher-day') list.push(e);
  }
  // Tekshirilmaganlar (remaining > 0) tepada, keyin assigned bo'yicha desc
  list.sort((a, b) => {
    if ((b.remaining || 0) !== (a.remaining || 0)) return (b.remaining || 0) - (a.remaining || 0);
    return (b.assigned || 0) - (a.assigned || 0);
  });
  return list;
}

/* ── OY KO'RINISHI ── */
function MonthView({ cursor, today, eventsByDate, onPick, isAdmin }) {
  const monthStartIdx = useMemo(() => {
    const dow = new Date(cursor.y, cursor.m, 1).getDay();
    return (dow + 6) % 7;
  }, [cursor.y, cursor.m]);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();

  const cells = [];
  const prevDays = new Date(cursor.y, cursor.m, 0).getDate();
  for (let i = 0; i < monthStartIdx; i++) {
    cells.push({ day: prevDays - monthStartIdx + i + 1, muted:true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = fmtDateKey(cursor.y, cursor.m, d);
    const evs = eventsByDate[key] || [];
    const isToday =
      cursor.y === today.getFullYear() &&
      cursor.m === today.getMonth() &&
      d === today.getDate();
    cells.push({ day:d, today:isToday, events:evs, key });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - daysInMonth - monthStartIdx + 1, muted:true });
  }

  return (
    <motion.div
      initial={{ opacity:0, scale:0.98 }} animate={{ opacity:1, scale:1 }}
      exit={{ opacity:0, scale:0.98 }} transition={{ duration:0.22 }}>
      <div className="cal">
        {DAYS_SHORT.map(d => <div key={d} className="cal-hd">{d}</div>)}
        {cells.map((c, i) => (
          <motion.div key={`${cursor.y}-${cursor.m}-${i}`} className={`cal-cell ${c.muted?'muted':''} ${c.today?'today':''}`}
            initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
            transition={{ delay: 0.04 + Math.floor(i/7)*0.018 + (i%7)*0.004, duration:0.28, ease:[0.22,1,0.36,1] }}
            whileHover={!c.muted ? { scale:1.02, zIndex:2 } : {}}
            onClick={() => {
              if (c.muted || !c.events?.length) return;
              const dow = (new Date(cursor.y, cursor.m, c.day).getDay() + 6) % 7;
              onPick({ y:cursor.y, m:cursor.m, d:c.day, dow, events:c.events });
            }}
            style={{ cursor: c.muted || !c.events?.length ? 'default' : 'pointer' }}>
            <span className="cal-day">{c.day}</span>
            {isAdmin
              ? <AdminCellSummary events={c.events}/>
              : (c.events || []).slice(0, 2).map((e, j) => (
                  <motion.div key={j} className={`cal-ev ${e.tone}`} title={`${e.time} · ${e.title}`}
                    initial={{ opacity:0, x:-4 }} animate={{ opacity:1, x:0 }}
                    transition={{ delay: 0.15 + j*0.04 }}>
                    <strong style={{ marginRight:3 }}>{e.time}</strong>{e.title}
                  </motion.div>
                ))}
            {!isAdmin && c.events && c.events.length > 2 && (
              <div style={{ fontSize:10, color:'var(--primary-l)', fontWeight:700, marginTop:2 }}>
                +{c.events.length - 2} ko'proq
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* Admin hafta view stat qatori */
function StatBar({ tone, label, n }) {
  const t = TONE[tone];
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:6,
      padding:'3px 7px', borderRadius:6,
      background: t.bg, border:`1px solid ${t.border}`,
    }}>
      <span style={{ fontSize:10.5, color: t.color, fontWeight:600 }}>{label}</span>
      <span style={{ fontSize:13, color: t.color, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{n}</span>
    </div>
  );
}

/* Admin uchun kun cell'idagi mini stats — "tekshirildi/qoldi" format */
function AdminCellSummary({ events }) {
  const s = dayStats(events);
  // assigned bo'lsa "reviewed / assigned" format, yo'q bo'lsa eski tarz
  if (s.assigned > 0) {
    const tone = s.remaining > 0 ? 'amber' : 'green';
    const t = TONE[tone];
    return (
      <motion.div
        initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}
        style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:4 }}>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:3,
          padding:'1px 6px', borderRadius:5,
          background: t.bg, color: t.color,
          border:`1px solid ${t.border}`,
          fontSize:10.5, fontWeight:700, fontVariantNumeric:'tabular-nums',
          lineHeight:1.3,
        }}>
          {s.reviewed}/{s.assigned}
        </span>
      </motion.div>
    );
  }
  const items = [];
  if (s.reviewed)  items.push(['green', s.reviewed]);
  if (s.submitted) items.push(['amber', s.submitted]);
  if (!items.length) return null;
  return (
    <motion.div
      initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}
      style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:4 }}>
      {items.map(([tone, n], i) => (
        <span key={i} style={{
          display:'inline-flex', alignItems:'center', gap:2,
          padding:'1px 5px', borderRadius:5,
          background: TONE[tone].bg, color: TONE[tone].color,
          border:`1px solid ${TONE[tone].border}`,
          fontSize:10.5, fontWeight:700, fontVariantNumeric:'tabular-nums',
          lineHeight:1.3,
        }}>{n}</span>
      ))}
    </motion.div>
  );
}

/* ── HAFTA KO'RINISHI ── */
function WeekView({ cursor, today, eventsByDate, onPick, nowF, isAdmin }) {
  const weekStart = useMemo(() => startOfWeek(new Date(cursor.y, cursor.m, cursor.d)), [cursor]);
  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = fmtDateKey(d.getFullYear(), d.getMonth(), d.getDate());
      out.push({
        date:d, key,
        events: eventsByDate[key] || [],
        isToday:
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate(),
      });
    }
    return out;
  }, [weekStart, eventsByDate, today]);

  // Admin uchun — vertical list (mobile-friendly)
  if (isAdmin) {
    return (
      <motion.div
        initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
        exit={{ opacity:0, y:-6 }} transition={{ duration:0.2 }}
        style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {days.map((d, i) => {
          const s = dayStats(d.events);
          const hasData = s.assigned > 0 || s.reviewed > 0 || s.submitted > 0;
          return (
            <motion.button key={i}
              onClick={() => hasData && onPick({ y:d.date.getFullYear(), m:d.date.getMonth(), d:d.date.getDate(), dow:i, events:d.events })}
              initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.04 }}
              whileTap={hasData ? { scale:0.99 } : {}}
              className="card"
              style={{
                background: d.isToday ? 'var(--primary-bg)' : 'var(--bg-card)',
                border: d.isToday ? '1px solid var(--primary)' : '1px solid var(--border)',
                padding:'12px 14px',
                display:'flex', alignItems:'center', gap:14,
                cursor: hasData ? 'pointer' : 'default',
                textAlign:'left', width:'100%',
              }}>
              <div style={{
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                minWidth:46, flexShrink:0, padding:'4px 0',
                borderRight:'1px solid var(--border)', paddingRight:14,
              }}>
                <div style={{ fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600 }}>
                  {DAYS_SHORT[i]}
                </div>
                <div style={{
                  fontFamily:'var(--display)', fontSize:22, fontWeight:700, lineHeight:1.1, marginTop:1,
                  color: d.isToday ? 'var(--primary-l)' : 'var(--text)',
                }}>
                  {d.date.getDate()}
                </div>
              </div>

              {hasData ? (
                <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                  {s.assigned > 0 && (
                    <div style={{
                      display:'inline-flex', alignItems:'center', gap:5,
                      padding:'4px 9px', borderRadius:8,
                      background: TONE.indigo.bg, border:`1px solid ${TONE.indigo.border}`,
                    }}>
                      <span style={{ fontSize:11.5, color:TONE.indigo.color, fontWeight:700 }}>{s.assigned}</span>
                      <span style={{ fontSize:10.5, color:TONE.indigo.color }}>berildi</span>
                    </div>
                  )}
                  {s.reviewed > 0 && (
                    <div style={{
                      display:'inline-flex', alignItems:'center', gap:5,
                      padding:'4px 9px', borderRadius:8,
                      background: TONE.green.bg, border:`1px solid ${TONE.green.border}`,
                    }}>
                      <Icon name="check" size={11} color={TONE.green.color}/>
                      <span style={{ fontSize:11.5, color:TONE.green.color, fontWeight:700 }}>{s.reviewed}</span>
                    </div>
                  )}
                  {s.remaining > 0 && (
                    <div style={{
                      display:'inline-flex', alignItems:'center', gap:5,
                      padding:'4px 9px', borderRadius:8,
                      background: TONE.amber.bg, border:`1px solid ${TONE.amber.border}`,
                    }}>
                      <Icon name="clock" size={11} color={TONE.amber.color}/>
                      <span style={{ fontSize:11.5, color:TONE.amber.color, fontWeight:700 }}>{s.remaining}</span>
                      <span style={{ fontSize:10.5, color:TONE.amber.color }}>qoldi</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ flex:1, fontSize:12, color:'var(--text-3)' }}>—</div>
              )}

              {hasData && <Icon name="chevronRight" size={13} color="var(--text-3)" style={{ flexShrink:0 }}/>}
            </motion.button>
          );
        })}
      </motion.div>
    );
  }

  // Daily timeline: 6:00 dan 22:00 gacha (16 soat)
  const START_HR = 6;
  const END_HR   = 22;
  const HOURS = END_HR - START_HR;
  const hours = Array.from({ length: HOURS + 1 }, (_, i) => START_HR + i);

  // Vaqtni 0..1 chizig'iga aylantirish (faqat 6:00-22:00 oralig'i)
  const nowPct = (() => {
    const fracInDay = nowF;
    const fracStart = START_HR / 24;
    const fracRange = HOURS / 24;
    const pct = (fracInDay - fracStart) / fracRange;
    return pct < 0 || pct > 1 ? null : pct;
  })();

  const parseTime = (str) => {
    const [h, m] = (str || '0:00').split(':').map(Number);
    return h + (m || 0) / 60;
  };

  return (
    <motion.div
      initial={{ opacity:0, scale:0.98 }} animate={{ opacity:1, scale:1 }}
      exit={{ opacity:0, scale:0.98 }} transition={{ duration:0.22 }}
      className="card" style={{ overflow:'hidden' }}>
      <div className="week-view">
        {/* Sarlavha: kun nomlari */}
        <div className="week-head">
          <div className="week-time-col"/>
          {days.map((d, i) => (
            <motion.button key={i}
              onClick={() => d.events.length && onPick({ y:d.date.getFullYear(), m:d.date.getMonth(), d:d.date.getDate(), dow:i, events:d.events })}
              initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.04 }}
              className={`week-day-hd ${d.isToday?'today':''}`}
              style={{ cursor: d.events.length ? 'pointer' : 'default', background:'transparent' }}>
              <div style={{ fontSize:10.5, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>
                {DAYS_SHORT[i]}
              </div>
              <div style={{
                marginTop:4, fontFamily:'var(--display)', fontSize:18, fontWeight:700,
                color: d.isToday ? '#fff' : 'var(--text)',
                width:30, height:30, borderRadius:'50%',
                display:'grid', placeItems:'center', margin:'4px auto 0',
                background: d.isToday ? 'linear-gradient(135deg,var(--primary-l),var(--primary))' : 'transparent',
                boxShadow: d.isToday ? 'var(--glow-primary)' : 'none',
              }}>
                {d.date.getDate()}
              </div>
              {d.events.length > 0 && (
                <div style={{ fontSize:10, color:'var(--text-3)', marginTop:3, fontWeight:500 }}>
                  {d.events.length}
                </div>
              )}
            </motion.button>
          ))}
        </div>

        {/* Body: soatlar + hodisalar */}
        <div className="week-body">
          <div className="week-time-col" style={{ position:'relative' }}>
            {hours.map((h, i) => (
              <div key={h} className="week-time-row">
                <span>{String(h).padStart(2,'0')}:00</span>
              </div>
            ))}
          </div>
          {days.map((d, dayIdx) => (
            <div key={dayIdx} className={`week-day-col ${d.isToday?'today':''}`} style={{ position:'relative' }}>
              {hours.map((h, i) => (
                <div key={h} className="week-cell"/>
              ))}
              {/* Hodisalarni absolute joylash */}
              {d.events.map((e, j) => {
                const t = parseTime(e.time);
                if (t < START_HR || t > END_HR) return null;
                const top = ((t - START_HR) / HOURS) * 100;
                const tone = TONE[e.tone] || TONE.indigo;
                return (
                  <motion.div key={j}
                    initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
                    transition={{ delay: 0.1 + dayIdx*0.04 + j*0.03 }}
                    onClick={() => onPick({ y:d.date.getFullYear(), m:d.date.getMonth(), d:d.date.getDate(), dow:dayIdx, events:[e, ...d.events.filter(x => x !== e)] })}
                    className="week-event"
                    style={{
                      position:'absolute', top:`${top}%`, left:4, right:4,
                      background: tone.bg, color: tone.color,
                      border:`1px solid ${tone.border}`, borderLeft:`3px solid ${tone.solid}`,
                      borderRadius:8, padding:'5px 7px', fontSize:11.5, lineHeight:1.25,
                      cursor:'pointer', zIndex:3,
                      boxShadow:'var(--shadow-xs)',
                      backdropFilter:'blur(8px)',
                    }}>
                    <div style={{ fontFamily:'var(--mono)', fontSize:10.5, fontWeight:700, opacity:0.9 }}>{e.time}</div>
                    <div style={{ fontWeight:600, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.title}</div>
                  </motion.div>
                );
              })}
              {/* "Hozir" chizig'i — faqat bugungi ustunda */}
              {d.isToday && nowPct !== null && (
                <motion.div
                  initial={{ scaleX:0 }} animate={{ scaleX:1 }} transition={{ duration:0.5, delay:0.3 }}
                  style={{
                    position:'absolute', left:0, right:0, top:`${nowPct * 100}%`,
                    height:2, background:'var(--rose)', boxShadow:'0 0 10px var(--rose)',
                    zIndex:5, transformOrigin:'left',
                  }}>
                  <div style={{
                    position:'absolute', left:-6, top:-4, width:10, height:10,
                    borderRadius:'50%', background:'var(--rose)', boxShadow:'0 0 8px var(--rose)',
                  }}/>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* Admin uchun kun modali ichidagi teacher row */
function TeacherMiniRow({ t, onClick }) {
  const subs = t.submissions || { reviewed:0, pending:0 };
  const gs   = t.groupsStats || { total:0, partial:0, complete:0 };
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale:0.99 }}
      initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }}
      style={{
        display:'flex', alignItems:'center', gap:10,
        padding:'10px 12px', borderRadius:10,
        background:'var(--bg-subtle)', border:'1px solid var(--border)',
        textAlign:'left', cursor:'pointer', width:'100%',
      }}>
      <div style={{ position:'relative', flexShrink:0 }}>
        <Avatar name={t.name} hue={t.hue} size="sm"/>
        {t.presence === 'online' && (
          <span style={{
            position:'absolute', bottom:-1, right:-1, width:9, height:9, borderRadius:'50%',
            background:'#10b981', border:'2px solid var(--bg-subtle)',
          }}/>
        )}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.name}</div>
        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          {gs.total > 0 ? (
            <>
              <span><strong style={{ color:'var(--text-2)' }}>{gs.total}</strong> guruh</span>
              {gs.partial > 0
                ? <span style={{ color:'var(--amber)', fontWeight:600 }}>· {gs.partial} chala</span>
                : <span style={{ color:'var(--primary-l)', fontWeight:600 }}>· to'liq</span>}
            </>
          ) : <span>Guruh yo'q</span>}
        </div>
      </div>
      {subs.pending > 0 && (
        <span style={{
          background:'var(--amber-bg)', color:'var(--amber)',
          fontSize:11.5, fontWeight:700, padding:'4px 9px', borderRadius:7,
          flexShrink:0,
        }}>
          {subs.pending}
        </span>
      )}
      <Icon name="chevronRight" size={12} color="var(--text-3)" style={{ flexShrink:0 }}/>
    </motion.button>
  );
}

/* Admin uchun kun modali — per-teacher breakdown */
function AdminDayDetails({ events, teachers = [], onOpenTeacher }) {
  const s = dayStats(events);
  const teacherBreakdown = teacherDayBreakdown(events);
  const hasBreakdown = teacherBreakdown.length > 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Kun umumiy stat'i */}
      {s.assigned > 0 ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
          {[
            ['indigo', 'Berildi',     s.assigned],
            ['green',  'Tekshirildi', s.reviewed],
            ['amber',  'Qoldi',       s.remaining],
          ].map(([tone, label, n], i) => {
            const t = TONE[tone];
            return (
              <motion.div key={i}
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.05 }}
                style={{
                  padding:'9px 11px', borderRadius:10,
                  background: t.bg, border:`1px solid ${t.border}`,
                }}>
                <div style={{ fontSize:10, color:t.color, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
                <div style={{ fontFamily:'var(--display)', fontSize:20, fontWeight:700, color:t.color, marginTop:2 }}>{n}</div>
              </motion.div>
            );
          })}
        </div>
      ) : (s.reviewed + s.submitted) > 0 ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:9 }}>
          {[['green', 'Tekshirildi', s.reviewed], ['amber', 'Kutilmoqda', s.submitted]].map(([tone, label, n], i) => {
            const t = TONE[tone];
            return (
              <motion.div key={i}
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.05 }}
                style={{ padding:'10px 12px', borderRadius:10, background: t.bg, border:`1px solid ${t.border}` }}>
                <div style={{ fontSize:10.5, color:t.color, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
                <div style={{ fontFamily:'var(--display)', fontSize:22, fontWeight:700, color:t.color, marginTop:3 }}>{n}</div>
              </motion.div>
            );
          })}
        </div>
      ) : null}

      {/* Per-teacher breakdown — har teacher uchun "reviewed/assigned" */}
      {hasBreakdown && (
        <div>
          <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>
            O'qituvchilar bo'yicha
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {teacherBreakdown.map(td => {
              const tone = td.remaining > 0 ? 'amber' : 'green';
              const t = TONE[tone];
              const ratio = td.assigned > 0 ? Math.round((td.reviewed / td.assigned) * 100) : 0;
              return (
                <motion.button key={td.teacherId}
                  onClick={() => onOpenTeacher?.(td.teacherId)}
                  whileTap={{ scale:0.99 }}
                  initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }}
                  style={{
                    display:'flex', alignItems:'center', gap:11,
                    padding:'10px 12px', borderRadius:10,
                    background:'var(--bg-subtle)',
                    border:'1px solid var(--border)',
                    borderLeft: `3px solid ${t.solid}`,
                    textAlign:'left', cursor:'pointer', width:'100%',
                  }}>
                  <Avatar name={td.teacherName} hue={td.hue} size="sm"/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{
                      fontSize:13, fontWeight:600, color:'var(--text)',
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                    }}>{td.teacherName}</div>
                    <div style={{
                      fontSize:11, color:'var(--text-3)', marginTop:2,
                      display:'flex', alignItems:'center', gap:5, flexWrap:'wrap',
                    }}>
                      <span><strong style={{ color:'var(--text-2)' }}>{td.reviewed}</strong>/{td.assigned} tekshirildi</span>
                      {td.remaining > 0 && (
                        <span style={{ color:t.color, fontWeight:600 }}>· {td.remaining} qoldi</span>
                      )}
                    </div>
                  </div>
                  <div style={{
                    minWidth:46, textAlign:'right', flexShrink:0,
                    fontFamily:'var(--display)', fontSize:16, fontWeight:700, color:t.color,
                    fontVariantNumeric:'tabular-nums',
                  }}>
                    {ratio}%
                  </div>
                  <Icon name="chevronRight" size={12} color="var(--text-3)" style={{ flexShrink:0 }}/>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {!hasBreakdown && s.reviewed === 0 && s.submitted === 0 && (
        <div style={{ padding:'20px 0', textAlign:'center', color:'var(--text-3)' }}>
          <div style={{ fontSize:30, marginBottom:6 }}>📭</div>
          <div style={{ fontSize:13 }}>Ma'lumot yo'q</div>
        </div>
      )}
    </div>
  );
}

/* Teacher uchun kun modali */
function TeacherDayDetails({ events }) {
  if (!events?.length) return null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
      {events.map((e, i) => {
        const tone = TONE[e.tone] || TONE.indigo;
        return (
          <motion.div key={i}
            initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.04 }}
            style={{
              display:'flex', alignItems:'flex-start', gap:12,
              padding:'12px 13px', borderRadius:10,
              background: tone.bg,
              border:`1px solid ${tone.border}`,
            }}>
            <div style={{
              fontFamily:'var(--mono)', fontSize:12.5, fontWeight:700,
              color: tone.color,
              flexShrink:0, minWidth:46, paddingTop:1,
            }}>{e.time}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13.5, fontWeight:600, marginBottom:3, color:'var(--text)' }}>{e.title}</div>
              {e.subtitle && (
                <div style={{ fontSize:11.5, color:'var(--text-2)' }}>{e.subtitle}</div>
              )}
              <div style={{ fontSize:10.5, color:tone.color, opacity:0.85, marginTop:4, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:700 }}>
                Dars
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
