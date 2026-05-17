import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Icon } from './ui.jsx';
import { sfx } from '../hooks/useSound.js';
import { haptic } from '../hooks/useTelegram.js';

/**
 * iPhone-uslubidagi swipe-to-delete:
 *  - O'ngdan chapga sudraganda orqasida qizil "O'chirish" maydoni ochiladi
 *  - Past threshold (-70) — qaytadi (snap back)
 *  - O'rta threshold (-100..-180) — yarim ochiq, "O'chirish" tugmasi turadi
 *  - Far threshold (-180+) — to'g'ridan-to'g'ri o'chiriladi
 *
 * Props:
 *  - children: row content
 *  - onDelete: () => Promise|void  (tasdiqlash kerak emas — swipe o'zi tasdiq)
 *  - label?: 'O'chirish' (default)
 *  - disabled?: boolean
 */
export default function SwipeToDelete({ children, onDelete, label = "O'chirish", disabled = false }) {
  const x = useMotionValue(0);
  const [deleting, setDeleting] = useState(false);
  const containerRef = useRef(null);

  // Qizil fon opacity'si: -30 dan boshlanib -90 da to'liq
  const bgOpacity = useTransform(x, [0, -30, -90], [0, 0.7, 1]);
  // Trash ikoni o'lchami: chuqurroqqa sudralsa kattaroq
  const iconScale = useTransform(x, [-30, -90, -180], [0.7, 1, 1.25]);

  const SNAP_OPEN_AT      = -70;  // bu yerga yetsa "yarim ochiq" holatga snap
  const SNAP_OPEN_OFFSET  = -96;  // yarim ochiq holatdagi position
  const DELETE_THRESHOLD  = -180; // shu yerdan keyin avto-o'chirish

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    haptic.success();
    sfx.success();
    const width = containerRef.current?.offsetWidth || 600;
    await animate(x, -width, { duration: 0.25, ease:'easeIn' });
    try { await onDelete?.(); } catch { /* hech bo'lmaganda UI'ni qaytaramiz */ animate(x, 0, { type:'spring' }); setDeleting(false); }
  };

  const handleDragEnd = (_, info) => {
    if (disabled) return;
    const offset = info.offset.x;
    if (offset < DELETE_THRESHOLD || info.velocity.x < -800) {
      remove();
    } else if (offset < SNAP_OPEN_AT) {
      animate(x, SNAP_OPEN_OFFSET, { type:'spring', stiffness:400, damping:32 });
    } else {
      animate(x, 0, { type:'spring', stiffness:400, damping:32 });
    }
  };

  const handleDeleteTap = (e) => {
    e.stopPropagation();
    if (!disabled) remove();
  };

  return (
    <div ref={containerRef}
      style={{ position:'relative', borderRadius:'var(--r-lg)', overflow:'hidden', touchAction:'pan-y' }}>
      {/* Orqa qizil fon + delete tugma */}
      <motion.div
        style={{
          position:'absolute', inset:0,
          display:'flex', alignItems:'center', justifyContent:'flex-end',
          background: 'linear-gradient(90deg, rgba(244,63,94,0) 30%, var(--rose) 70%)',
          opacity: bgOpacity,
          color:'#fff', pointerEvents:'none',
          paddingRight: 22, gap: 8,
        }}>
        <motion.span style={{ scale: iconScale, display:'inline-flex' }}>
          <Icon name="trash" size={20}/>
        </motion.span>
        <span style={{ fontSize:13, fontWeight:700, letterSpacing:'-0.01em' }}>{label}</span>
      </motion.div>

      {/* Tap target — yarim ochiq holatda ko'rinadi */}
      <button
        onClick={handleDeleteTap}
        aria-label={label}
        style={{
          position:'absolute', right:0, top:0, bottom:0, width:96,
          background:'transparent', border:'none', cursor:'pointer',
          zIndex: 1, pointerEvents: deleting ? 'none' : 'auto',
        }}/>

      {/* Sudraladigan asosiy kontent */}
      <motion.div
        drag={disabled ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: -260, right: 0 }}
        dragElastic={{ left: 0.18, right: 0 }}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{
          x,
          position:'relative',
          zIndex: 2,
          background:'var(--bg-card)',
          cursor: disabled ? 'default' : 'grab',
        }}
        whileTap={{ cursor: disabled ? 'default' : 'grabbing' }}
      >
        {children}
      </motion.div>
    </div>
  );
}
