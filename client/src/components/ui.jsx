import { useState, useEffect } from 'react';
import { tg } from '../hooks/useTelegram.js';
import { CAN_HOVER } from '../utils/device.js';

/* ── Animate UI ikonkalari (animate-ui.com/docs/icons) ──
   Lucide + Motion. Mavjud bo'lganlari shu yerdan ishlatiladi; qolganlari
   pastdagi statik SVG (ICONS) bilan ko'rsatiladi. */
import { LayoutDashboard } from '@/components/animate-ui/icons/layout-dashboard';
import { Users }          from '@/components/animate-ui/icons/users';
import { UsersRound }     from '@/components/animate-ui/icons/users-round';
import { User }           from '@/components/animate-ui/icons/user';
import { ClipboardList }  from '@/components/animate-ui/icons/clipboard-list';
import { Settings }       from '@/components/animate-ui/icons/settings';
import { Search }         from '@/components/animate-ui/icons/search';
import { Bell }           from '@/components/animate-ui/icons/bell';
import { Plus }           from '@/components/animate-ui/icons/plus';
import { ChevronLeft }    from '@/components/animate-ui/icons/chevron-left';
import { ChevronRight }   from '@/components/animate-ui/icons/chevron-right';
import { ChevronDown }    from '@/components/animate-ui/icons/chevron-down';
import { ChevronUp }      from '@/components/animate-ui/icons/chevron-up';
import { ArrowUp }        from '@/components/animate-ui/icons/arrow-up';
import { ArrowDown }      from '@/components/animate-ui/icons/arrow-down';
import { ArrowRight }     from '@/components/animate-ui/icons/arrow-right';
import { X as XIcon }     from '@/components/animate-ui/icons/x';
import { Check }          from '@/components/animate-ui/icons/check';
import { CircleCheck }    from '@/components/animate-ui/icons/circle-check';
import { Sun }            from '@/components/animate-ui/icons/sun';
import { Moon }           from '@/components/animate-ui/icons/moon';
import { Activity }       from '@/components/animate-ui/icons/activity';
import { Clock }          from '@/components/animate-ui/icons/clock';
import { Sparkles }       from '@/components/animate-ui/icons/sparkles';
import { Ellipsis }       from '@/components/animate-ui/icons/ellipsis';
import { List }           from '@/components/animate-ui/icons/list';
import { Star }           from '@/components/animate-ui/icons/star';
import { Key }            from '@/components/animate-ui/icons/key';
import { LogOut }         from '@/components/animate-ui/icons/log-out';
import { PanelLeft }      from '@/components/animate-ui/icons/panel-left';
import { Download }       from '@/components/animate-ui/icons/download';
import { Copy }           from '@/components/animate-ui/icons/copy';
import { Link as LinkIcon } from '@/components/animate-ui/icons/link';
import { Send }           from '@/components/animate-ui/icons/send';
import { Volume2 }        from '@/components/animate-ui/icons/volume-2';
import { VolumeOff }      from '@/components/animate-ui/icons/volume-off';
import { Trash2 }         from '@/components/animate-ui/icons/trash-2';

// App ikonka nomi → animate-ui komponenti
const ANIM_ICONS = {
  dashboard: LayoutDashboard,
  teachers: Users,
  groups: UsersRound,
  users: Users,
  user: User,
  homework: ClipboardList,
  settings: Settings,
  search: Search,
  bell: Bell,
  plus: Plus,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  arrowRight: ArrowRight,
  close: XIcon,
  check: Check,
  checkCircle: CircleCheck,
  sun: Sun,
  moon: Moon,
  activity: Activity,
  clock: Clock,
  sparkles: Sparkles,
  moreH: Ellipsis,
  list: List,
  star: Star,
  key: Key,
  logOut: LogOut,
  panelLeft: PanelLeft,
  download: Download,
  copy: Copy,
  link: LinkIcon,
  send: Send,
  volume: Volume2,
  volumeOff: VolumeOff,
  trash: Trash2,
};

/**
 * Telegram chatni ochish — username bo'yicha (https://t.me/<username>).
 * Telegram mini-app ichida tg.openTelegramLink, aks holda yangi tab.
 */
export function openTelegramChat(username) {
  if (!username) return;
  const handle = String(username).replace(/^@+/, '').trim();
  if (!handle) return;
  const url = `https://t.me/${handle}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank', 'noopener');
}

/**
 * Bosiladigan Telegram username — bosilganda chatga o'tadi.
 * Inline ishlatish uchun <span role="button"> (button ichiga ham qo'yiladi).
 * @param at — '@' prefiksini ko'rsatish (default true)
 */
export function TgUsername({ username, at = true, style, title = "Telegramda ochish" }) {
  if (!username) return null;
  const handle = String(username).replace(/^@+/, '').trim();
  if (!handle) return null;
  const open = (e) => { e.stopPropagation(); e.preventDefault(); openTelegramChat(handle); };
  return (
    <span role="button" tabIndex={0} title={title}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') open(e); }}
      style={{
        cursor:'pointer', color:'var(--accent-l, #38bdf8)',
        textDecorationLine:'underline', textDecorationStyle:'dotted',
        textUnderlineOffset:2, ...style,
      }}>
      {at ? '@' : ''}{handle}
    </span>
  );
}

export function useCountUp(target, duration = 1000) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return; }
    let raf;
    const start = performance.now();
    const tick = t => {
      const p = Math.min((t - start) / duration, 1);
      setV(Math.round(target * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

export function Avatar({ name = '?', hue = 180, size = 'md', photoUrl = null }) {
  const cls = { xs:'av-xs', sm:'av-sm', md:'av-md', lg:'av-lg', xl:'av-xl', '2xl':'av-2xl' }[size] || 'av-md';
  // Rasm yuklanmasa (null URL, 404 yoki Telegram URL eskirgan bo'lsa) — initiallarga qaytamiz
  const [failed, setFailed] = useState(false);
  // photoUrl o'zgarsa, xato holatini reset qilamiz
  useEffect(() => { setFailed(false); }, [photoUrl]);

  if (photoUrl && !failed) {
    return (
      <img src={photoUrl} alt={name}
        className={`avatar ${cls}`}
        onError={() => setFailed(true)}
        style={{ objectFit:'cover', background:'var(--bg-subtle)' }}/>
    );
  }
  const initials = (name || '?').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <div className={`avatar ${cls}`}
      style={{ background:`linear-gradient(145deg,oklch(0.68 0.18 ${hue}),oklch(0.44 0.22 ${hue + 20}))` }}>
      {initials}
    </div>
  );
}

export function StatusDot({ status }) {
  return <span className={`sdot ${status === 'active' ? 'sdot-green' : 'sdot-gray'}`} />;
}

const ICONS = {
  dashboard:   <><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10"/><path d="M9 21V12h6v9"/></>,
  teachers:    <><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><circle cx="17" cy="7" r="3"/><path d="M21 21v-1.5a3 3 0 00-2-2.83"/></>,
  groups:      <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
  users:       <><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
  trophy:      <><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 01-10 0V4zM17 4h3v3a3 3 0 01-3 3M7 4H4v3a3 3 0 003 3"/></>,
  homework:    <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 4v6M16 4v6"/></>,
  calendar:    <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></>,
  settings:    <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
  search:      <><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></>,
  bell:        <><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>,
  plus:        <><path d="M12 5v14M5 12h14"/></>,
  chevronLeft: <><path d="M15 18l-6-6 6-6"/></>,
  chevronRight:<><path d="M9 18l6-6-6-6"/></>,
  chevronDown: <><path d="M6 9l6 6 6-6"/></>,
  chevronUp:   <><path d="M18 15l-6-6-6 6"/></>,
  arrowUp:     <><path d="M12 19V5M5 12l7-7 7 7"/></>,
  arrowDown:   <><path d="M12 5v14M19 12l-7 7-7-7"/></>,
  arrowRight:  <><path d="M5 12h14M12 5l7 7-7 7"/></>,
  close:       <><path d="M18 6L6 18M6 6l12 12"/></>,
  check:       <><path d="M20 6L9 17l-5-5"/></>,
  checkCircle: <><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></>,
  alert:       <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  sun:         <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M5 5l1.5 1.5M17.5 17.5L19 19M2 12h2M20 12h2M5 19l1.5-1.5M17.5 6.5L19 5"/></>,
  moon:        <><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></>,
  activity:    <><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>,
  clock:       <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
  user:        <><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0114 0v1"/></>,
  mail:        <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7L12 13 2 7"/></>,
  phone:       <><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></>,
  sparkles:    <><path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/><path d="M5 3l.9 2.6L8.5 6.5l-2.6.9L5 10l-.9-2.6L1.5 6.5l2.6-.9z"/></>,
  moreH:       <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
  filter:      <><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3"/></>,
  grid:        <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  list:        <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></>,
  star:        <><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></>,
  shield:      <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  key:         <><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/></>,
  eye:         <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff:      <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>,
  logOut:      <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  book:        <><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></>,
  trending:    <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
  zap:         <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
  target:      <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
  panelLeft:   <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></>,
  download:    <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  copy:        <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>,
  link:        <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></>,
  send:        <><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></>,
  volume:      <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></>,
  volumeOff:   <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>,
  trash:       <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/></>,
  gem:         <><path d="M6 3h12l4 6-10 13L2 9l4-6z"/><path d="M11 3L8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></>,
};

export function Icon({ name, size = 18, color, style, animate = true }) {
  // Animate UI ikonkasi mavjud bo'lsa — hover'da animatsiyalanadi
  const Anim = ANIM_ICONS[name];
  if (Anim) {
    return (
      <span className="ic-wrap" style={style}>
        <Anim
          size={size}
          strokeWidth={1.75}
          animateOnHover={CAN_HOVER ? animate : false}
          style={color ? { color } : undefined}
        />
      </span>
    );
  }
  // Aks holda — statik SVG (animate-ui'da bu ikonka yo'q)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || 'currentColor'} strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" style={style}>
      {ICONS[name] || null}
    </svg>
  );
}

export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:'var(--bg-2)', border:'1px solid var(--border-md)',
      borderRadius:'var(--r)', padding:'10px 14px',
      boxShadow:'var(--sh-lg)', fontSize:12,
    }}>
      <div style={{ fontWeight:600, marginBottom:6, color:'var(--text-2)', fontSize:11 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
          <div style={{ width:7, height:7, borderRadius:2, background:p.color }}/>
          <span style={{ color:'var(--text-2)' }}>{p.name}:</span>
          <span style={{ fontWeight:700, fontFamily:'var(--mono)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}
