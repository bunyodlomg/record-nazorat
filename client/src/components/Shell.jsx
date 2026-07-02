import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Avatar } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { sfx } from '../hooks/useSound.js';
import { haptic, isTelegram } from '../hooks/useTelegram.js';
import api from '../services/api.js';

/* ── NOTIFICATIONS PANEL ── */
const TONE_COLOR = {
  success: 'var(--primary-l)',
  info:    'var(--accent-l)',
  warning: 'var(--amber)',
  accent:  'var(--violet-l)',
  neutral: 'var(--text-2)',
};

function NotificationsButton() {
  const [open, setOpen]   = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 720);
  const [topOffset, setTopOffset] = useState(72); // mobile uchun header bottom + gap
  const wrapRef = useRef(null);
  const prevUnreadRef = useRef(0);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 720);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Mobile'da panel ochilganda header'ning haqiqiy bottom'idan keyin joylash
  useEffect(() => {
    if (!open || !isMobile) return;
    const header = document.querySelector('.header');
    if (header) {
      const bottom = header.getBoundingClientRect().bottom;
      setTopOffset(bottom + 8);
    }
  }, [open, isMobile]);

  const lastReadTs = Number(localStorage.getItem('ep_notif_lastRead')) || 0;
  const unread = useMemo(
    () => items.filter(i => new Date(i.ts).getTime() > lastReadTs).length,
    [items, lastReadTs],
  );

  // Yangi bildirishnoma kelganda — soft "bell"
  useEffect(() => {
    if (unread > prevUnreadRef.current && prevUnreadRef.current !== 0) {
      sfx.notify();
    }
    prevUnreadRef.current = unread;
  }, [unread]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.notifications.list({ limit: 20 });
      setItems(res?.data || res || []);
    } catch { /* sukut — kichik UI element */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchItems();
    const t = setInterval(fetchItems, 12_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey   = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    sfx.pop();
    if (next) {
      // Ochilganda hammasini "o'qildi" deb belgilash
      const newest = items[0]?.ts ? new Date(items[0].ts).getTime() : Date.now();
      localStorage.setItem('ep_notif_lastRead', String(newest));
      fetchItems();
    }
  };

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <button className="h-action" onClick={toggle} title="Bildirishnomalar">
        <Icon name="bell" size={16}/>
        {unread > 0 && (
          <span className="h-notif-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {isMobile && (
              <motion.div
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                transition={{ duration:0.15 }}
                onClick={() => setOpen(false)}
                style={{
                  position:'fixed', inset:0,
                  background:'rgba(0,0,0,0.45)', backdropFilter:'blur(2px)',
                  zIndex:55,
                }}
              />
            )}
            <motion.div
              initial={{ opacity:0, y:isMobile ? 12 : -8, scale:isMobile ? 1 : 0.97 }}
              animate={{ opacity:1, y:0, scale:1 }}
              exit={{ opacity:0, y:isMobile ? 12 : -6, scale:isMobile ? 1 : 0.97 }}
              transition={{ duration:0.22, ease:[0.22,1,0.36,1] }}
              style={
                isMobile
                  ? {
                      position:'fixed',
                      top: topOffset,
                      left:12, right:12,
                      maxHeight:`calc(100vh - ${topOffset}px - 90px)`,
                      background:'var(--bg-2)',
                      border:'1px solid var(--border-md)',
                      borderRadius:'var(--r-lg)',
                      boxShadow:'var(--shadow-2xl)',
                      zIndex:60,
                      overflow:'hidden', display:'flex', flexDirection:'column',
                    }
                  : {
                      position:'absolute', top:'calc(100% + 10px)', right:0,
                      width:380, maxHeight:'min(560px, 78vh)',
                      background:'var(--bg-2)',
                      border:'1px solid var(--border-md)',
                      borderRadius:'var(--r-lg)',
                      boxShadow:'var(--shadow-2xl)',
                      zIndex:60,
                      overflow:'hidden', display:'flex', flexDirection:'column',
                    }
              }>
            <div style={{
              padding:'14px 16px 12px', borderBottom:'1px solid var(--border)',
              display:'flex', alignItems:'baseline', justifyContent:'space-between',
              background:'var(--bg-card-s)',
            }}>
              <div>
                <div style={{ fontFamily:'var(--display)', fontSize:14.5, fontWeight:700, letterSpacing:'-0.02em' }}>Bildirishnomalar</div>
                <div style={{ fontSize:11.5, color:'var(--text-3)', marginTop:2 }}>
                  {loading ? 'Yangilanmoqda...' : items.length === 0 ? "Bo'sh" : `${items.length} ta hodisa`}
                </div>
              </div>
              {unread > 0 && (
                <span className="chip chip-danger" style={{ fontSize:10.5 }}>{unread} yangi</span>
              )}
            </div>

            <div style={{ overflowY:'auto', flex:1, padding:'4px 6px' }}>
              {!loading && items.length === 0 && (
                <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--text-3)' }}>
                  <div style={{ fontSize:30, marginBottom:6, opacity:0.6 }}>🔔</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-2)' }}>Hozircha hodisa yo'q</div>
                  <div style={{ fontSize:11.5, marginTop:4 }}>Yangi vazifalar va o'zgarishlar shu yerda paydo bo'ladi</div>
                </div>
              )}
              {items.map((it, idx) => {
                const isUnread = new Date(it.ts).getTime() > lastReadTs;
                const color = TONE_COLOR[it.tone] || TONE_COLOR.neutral;
                return (
                  <motion.div key={it.id}
                    initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} transition={{ delay: idx*0.02 }}
                    style={{
                      display:'flex', alignItems:'flex-start', gap:11,
                      padding:'11px 12px', borderRadius:9, margin:'2px 0',
                      background: isUnread ? 'rgba(99,102,241,0.07)' : 'transparent',
                      borderLeft: isUnread ? `2px solid ${color}` : '2px solid transparent',
                      transition:'background 140ms',
                    }}>
                    <div style={{
                      width:30, height:30, borderRadius:9,
                      background: 'var(--bg-subtle)',
                      color, border:`1px solid ${color}33`,
                      display:'grid', placeItems:'center', flexShrink:0,
                    }}>
                      <Icon name={it.icon} size={13}/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, marginBottom:2, color:'var(--text)' }}>{it.title}</div>
                      <div style={{ fontSize:11.5, color:'var(--text-2)', lineHeight:1.45,
                        display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                        {it.subtitle}
                      </div>
                      <div style={{ fontSize:10.5, color:'var(--text-3)', marginTop:3 }}>{it.time}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Mute / unmute tugmasi */
function MuteButton() {
  const [muted, setMuted] = useState(() => sfx.isMuted());
  const toggle = () => {
    const next = !muted;
    sfx.setMuted(next);
    setMuted(next);
    if (!next) sfx.pop(); // unmute qilganda eshittirish
  };
  return (
    <button className="h-action" onClick={toggle} title={muted ? "Tovushni yoqish" : "Tovushni o'chirish"}>
      <Icon name={muted ? 'volumeOff' : 'volume'} size={16}/>
    </button>
  );
}

/* ── HEADER ── */
export function Header({ theme, onToggleTheme, page }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = e => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const titles = {
    dashboard:'Bosh sahifa', teachers:"O'qituvchilar", groups:'Guruhlar',
    leaderboard:'Reyting', homework:'Vazifalar', calendar:'Kalendar',
    'my-classes':'Mening guruhlarim', 'my-homework':'Vazifalarim', 'my-students':"O'quvchilarim",
    activity:'Faollik jadvali',
    profile:'Profil',
  };

  return (
    <header className="header">
      <div className="h-brand">
        <motion.div
          className="h-logo"
          whileHover={{ rotate: [0, -8, 8, -4, 0], transition: { duration: 0.5 } }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
        </motion.div>
        <div>
          <div className="h-brand-name">Record Nazorat</div>
          <div className="h-brand-sub">{titles[page] || 'Bosh sahifa'}</div>
        </div>
      </div>

      <div className="h-spacer"/>

      <button className="h-action" onClick={() => { sfx.toggle(); onToggleTheme(); }} title="Toggle theme">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={theme}
            initial={{ opacity:0, rotate:-90, scale:0.6 }}
            animate={{ opacity:1, rotate:0, scale:1 }}
            exit={{ opacity:0, rotate:90, scale:0.6 }}
            transition={{ duration:0.25 }}
            style={{ display:'flex' }}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16}/>
          </motion.span>
        </AnimatePresence>
      </button>

      <MuteButton/>
      <NotificationsButton/>

      {/* User chip — Telegram'da menyu kerak emas, browser'da faqat 'Chiqish' */}
      <div ref={menuRef} style={{ position:'relative' }}>
        <button className="h-user" onClick={() => !isTelegram && setMenuOpen(o => !o)}
          style={{ cursor: isTelegram ? 'default' : 'pointer' }}>
          <Avatar name={user?.name || '?'} hue={user?.role === 'admin' ? 270 : 165} size="sm" photoUrl={user?.photoUrl}/>
          <div className="h-user-meta">
            <div className="h-user-name">{user?.name?.split(' ')[0]}</div>
            <div className="h-user-role">
              {user?.role === 'admin' ? 'Admin' : user?.role === 'teacher' ? "O'qituvchi" : user?.role}
            </div>
          </div>
        </button>

        {!isTelegram && (
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className="user-menu"
                initial={{ opacity:0, y:-8, scale:0.95 }}
                animate={{ opacity:1, y:0, scale:1 }}
                exit={{ opacity:0, y:-8, scale:0.95 }}
                transition={{ duration:0.18 }}
                style={{ top:'calc(100% + 8px)', bottom:'auto' }}
              >
                <div className="um-head">
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <Avatar name={user?.name || '?'} hue={user?.role === 'admin' ? 270 : 165} size="md" photoUrl={user?.photoUrl}/>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.name}</div>
                      <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>
                        {user?.telegramUsername
                          ? `@${user.telegramUsername}`
                          : (user?.email && !/^tg-[\w-]+@local$/i.test(user.email) ? user.email : '')}
                      </div>
                    </div>
                  </div>
                </div>
                <button className="um-item danger" onClick={logout}>
                  <Icon name="logOut" size={14}/> Chiqish
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </header>
  );
}

/* ── DOCK NAVIGATION ── */
export function Dock({ items, active, onChange }) {
  return (
    <div className="dock-wrap">
      <motion.div
        className="dock"
        initial={{ y:80, opacity:0 }}
        animate={{ y:0, opacity:1 }}
        transition={{ duration:0.5, ease:[0.22,1,0.36,1], delay:0.1 }}
      >
        {items.map((item, i) => {
          if (item.divider) return <div key={`d-${i}`} className="dock-divider"/>;
          const isActive = active === item.id;
          return (
            <motion.button
              key={item.id}
              className={`dock-btn ${isActive ? 'active' : ''}`}
              onMouseEnter={() => !isActive && (sfx.hover(), haptic.selection())}
              onClick={() => { sfx.click(); haptic.impact('medium'); onChange(item.id); }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type:'spring', stiffness:400, damping:20 }}
            >
              <Icon name={item.icon} size={20}/>
              {item.badge && <span className="dock-badge">{item.badge}</span>}
              <span className="dock-btn-tooltip">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="dock-indicator"
                  style={{
                    position:'absolute', bottom:-9, left:'50%',
                    width:4, height:4, borderRadius:'50%',
                    background:'var(--primary-l)',
                    boxShadow:'0 0 8px var(--primary-l)',
                    x:'-50%',
                  }}
                  transition={{ type:'spring', stiffness:500, damping:30 }}
                />
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
