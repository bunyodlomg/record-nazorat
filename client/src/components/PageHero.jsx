import { motion } from 'framer-motion';
import { Icon, useCountUp } from './ui.jsx';

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
        <div className="phero-emoji">{emoji}</div>
      </div>
      {stats.length > 0 && (
        <div className="phero-stats">
          {stats.map((s, i) => <HeroStat key={s.label} stat={s} idx={i}/>)}
        </div>
      )}
    </motion.div>
  );
}
