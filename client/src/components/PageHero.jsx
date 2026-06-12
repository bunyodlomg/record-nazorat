import { motion } from 'framer-motion';
import { Icon, useCountUp } from './ui.jsx';

/* Abstrakt dekorativ grafik — gradient orblar, halqa va nuqtalar */
export function HeroArt({ className = 'phero-art' }) {
  return (
    <svg className={className} width="180" height="132" viewBox="0 0 180 132" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="ha-orb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#a78bfa"/>
          <stop offset="100%" stopColor="#4f46e5"/>
        </linearGradient>
        <linearGradient id="ha-ring" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%"  stopColor="#818cf8"/>
          <stop offset="100%" stopColor="#c4b5fd"/>
        </linearGradient>
      </defs>
      {/* katta orb */}
      <circle cx="120" cy="66" r="48" fill="url(#ha-orb)" opacity="0.94"/>
      {/* yaltiroq highlight */}
      <ellipse cx="104" cy="48" rx="19" ry="12" fill="#fff" opacity="0.22"/>
      {/* halqa */}
      <circle cx="52" cy="46" r="27" stroke="url(#ha-ring)" strokeWidth="7" opacity="0.72"/>
      {/* kichik orb */}
      <circle cx="60" cy="100" r="15" fill="url(#ha-ring)" opacity="0.88"/>
      {/* nuqtalar */}
      <circle cx="160" cy="22" r="5"   fill="#c4b5fd" opacity="0.85"/>
      <circle cx="22"  cy="90" r="3.5" fill="#818cf8" opacity="0.7"/>
    </svg>
  );
}

/* Hero ichidagi mini-statistika kartasi (count-up animatsiya bilan) */
function HeroStat({ stat, idx }) {
  const numeric = typeof stat.value === 'number';
  const v = useCountUp(numeric ? stat.value : 0);
  const display = numeric ? `${v.toLocaleString()}${stat.suffix || ''}` : stat.value;
  return (
    <motion.div className="phero-stat"
      initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      transition={{ delay:0.12 + idx * 0.06, duration:0.4, ease:[0.22,1,0.36,1] }}>
      <div className="phero-stat-ico" style={{ background:stat.bg, color:stat.color }}>
        <Icon name={stat.icon} size={17}/>
      </div>
      <div className="phero-stat-num">{display}</div>
      <div className="phero-stat-lbl">{stat.label}</div>
      <div className="phero-stat-bar"><span style={{ background:stat.color }}/></div>
    </motion.div>
  );
}

/**
 * PageHero — sahifa boshidagi gradient banner.
 * @param {string} title    katta sarlavha
 * @param {string} subtitle sarlavha ostidagi matn
 * @param {string} emoji    o'ng tomondagi dekorativ emoji (default 🎒)
 * @param {Array}  stats    [{ value, suffix?, label, icon, bg, color }]
 */
export default function PageHero({ title, subtitle, emoji = '🎒', stats = [] }) {
  return (
    <motion.div className="phero"
      initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
      <div className="phero-blob"/>
      <div className="phero-blob phero-blob-2"/>
      <div className="phero-head">
        <div className="phero-head-txt">
          <h1 className="phero-title">{title}</h1>
          {subtitle && <div className="phero-sub">{subtitle}</div>}
        </div>
        <HeroArt/>
      </div>
      {stats.length > 0 && (
        <div className="phero-stats">
          {stats.map((s, i) => <HeroStat key={s.label} stat={s} idx={i}/>)}
        </div>
      )}
    </motion.div>
  );
}
