import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Icon } from './ui.jsx';

export function Spinner({ size = 36 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'60px 0' }}>
      <motion.div
        style={{
          width:size, height:size, borderRadius:'50%',
          border:'2.5px solid var(--border-md)',
          borderTopColor:'var(--primary)',
        }}
        animate={{ rotate:360 }}
        transition={{ duration:0.7, repeat:Infinity, ease:'linear' }}
      />
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <motion.div
      initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'56px 0', gap:12, color:'var(--text-2)' }}>
      <div style={{ width:48, height:48, borderRadius:14, background:'var(--rose-bg)', color:'var(--rose)', display:'grid', placeItems:'center' }}>
        <Icon name="alert" size={22}/>
      </div>
      <div style={{ fontSize:14, fontWeight:600 }}>Xatolik yuz berdi</div>
      <div style={{ fontSize:13, color:'var(--text-3)', maxWidth:300, textAlign:'center' }}>{message}</div>
      {onRetry && <button className="btn btn-secondary" onClick={onRetry} style={{ marginTop:4 }}>Qayta urinish</button>}
    </motion.div>
  );
}

const skeletonAnim = {
  animate: { opacity: [0.5, 1, 0.5] },
  transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
};

export function SkeletonLine({ w = '100%', h = 14, mb = 10 }) {
  return (
    <motion.div {...skeletonAnim}
      style={{ width:w, height:h, background:'var(--bg-subtle)', borderRadius:6, marginBottom:mb }}/>
  );
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ padding:18 }}>
      <div style={{ display:'flex', gap:12, marginBottom:14 }}>
        <motion.div {...skeletonAnim} style={{ width:40, height:40, borderRadius:'50%', background:'var(--bg-subtle)', flexShrink:0 }}/>
        <div style={{ flex:1 }}>
          <SkeletonLine w="60%" h={13} mb={6}/>
          <SkeletonLine w="40%" h={11} mb={0}/>
        </div>
      </div>
      <SkeletonLine w="100%" h={10} mb={8}/>
      <SkeletonLine w="80%" h={10} mb={0}/>
    </div>
  );
}

// Stagger container for list animations
export const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
export const listItem = {
  hidden: { opacity:0, y:14 },
  show:   { opacity:1, y:0, transition: { duration:0.4, ease:[0.22,1,0.36,1] } },
};

/* ──────────────────────────────────────────────
   Client-side pagination
   ────────────────────────────────────────────── */

/**
 * usePaged — ro'yxatni sahifalarga bo'ladi.
 * @param {Array}  items     to'liq ro'yxat
 * @param {number} pageSize  bir sahifadagi elementlar soni
 * @param {Array}  deps      o'zgarganda 1-sahifaga qaytadigan qaramliklar (filter, search...)
 */
export function usePaged(items, pageSize = 10, deps = []) {
  const list = Array.isArray(items) ? items : [];
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));

  // Filter/qidiruv o'zgarsa — 1-sahifaga qaytamiz
  useEffect(() => { setPage(1); }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  // Ro'yxat qisqarsa va joriy sahifa tashqarida qolsa — tuzatamiz
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => list.slice((page - 1) * pageSize, page * pageSize),
    [list, page, pageSize],
  );

  return {
    page, setPage, totalPages,
    pageItems,
    total: list.length,
    pageSize,
  };
}

/** Sahifa raqamlarini ellipsis bilan hosil qiladi: [1, '…', 4,5,6, '…', 12] */
function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...set].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

/**
 * Pagination — qayta ishlatiladigan sahifalash boshqaruvi.
 * 1 sahifadan kam bo'lsa hech narsa ko'rsatmaydi.
 */
export function Pagination({ page, totalPages, total, pageSize, onPage, label = 'ta' }) {
  if (totalPages <= 1) return null;
  const nums = pageNumbers(page, totalPages);
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <span className="pg-info">
        {from}–{to} <span className="pg-info-dim">/ {total} {label}</span>
      </span>
      <div className="pg-controls">
        <button className="pg-btn" disabled={page <= 1}
          onClick={() => onPage(page - 1)} aria-label="Oldingi">
          <Icon name="chevronLeft" size={14}/>
        </button>
        {nums.map((n, i) =>
          n === '…' ? (
            <span key={`e${i}`} className="pg-ellipsis">…</span>
          ) : (
            <button key={n}
              className={`pg-btn pg-num ${n === page ? 'active' : ''}`}
              onClick={() => onPage(n)}>
              {n}
            </button>
          )
        )}
        <button className="pg-btn" disabled={page >= totalPages}
          onClick={() => onPage(page + 1)} aria-label="Keyingi">
          <Icon name="chevronRight" size={14}/>
        </button>
      </div>
    </div>
  );
}
