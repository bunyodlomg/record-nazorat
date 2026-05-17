import { useEffect, useRef, useState, useMemo, forwardRef, Children, isValidElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Avatar } from './ui.jsx';
import { sfx } from '../hooks/useSound.js';

export function Modal({ open, onClose, title, subtitle, children, width = 480, footer }) {
  useEffect(() => {
    if (!open) return;
    sfx.pop();
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
          transition={{ duration:0.18 }}
          onClick={onClose}
          style={{
            position:'fixed', inset:0, zIndex:200,
            background:'rgba(2,8,10,0.65)',
            backdropFilter:'blur(6px)',
            display:'grid', placeItems:'center', padding:20,
          }}
        >
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ opacity:0, y:24, scale:0.96 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:14, scale:0.97 }}
            transition={{ duration:0.24, ease:[0.22,1,0.36,1] }}
            style={{
              width:'100%', maxWidth:width,
              background:'var(--bg-2)',
              border:'1px solid var(--border-md)',
              borderRadius:'var(--r-xl)',
              boxShadow:'var(--shadow-2xl), 0 0 0 1px rgba(45,212,191,0.04)',
              overflow:'hidden', display:'flex', flexDirection:'column',
              maxHeight:'92vh',
              position:'relative',
            }}
          >
            <div style={{
              position:'absolute', top:0, left:0, right:0, height:120,
              background:'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(45,212,191,0.08), transparent 70%)',
              pointerEvents:'none',
            }}/>
            <div style={{
              display:'flex', alignItems:'flex-start', gap:12,
              padding:'20px 24px 16px',
              borderBottom:'1px solid var(--border)',
              position:'relative',
            }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'var(--display)', fontSize:18, fontWeight:700, letterSpacing:'-0.02em' }}>{title}</div>
                {subtitle && <div style={{ fontSize:12.5, color:'var(--text-2)', marginTop:4 }}>{subtitle}</div>}
              </div>
              <button onClick={onClose}
                style={{
                  background:'var(--bg-subtle)', border:'1px solid var(--border)',
                  borderRadius:'50%', width:32, height:32,
                  display:'grid', placeItems:'center', color:'var(--text-2)',
                  transition:'all 160ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.color='var(--text)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='var(--bg-subtle)'; e.currentTarget.style.color='var(--text-2)'; }}>
                <Icon name="close" size={14}/>
              </button>
            </div>

            <div style={{ padding:'20px 24px', overflowY:'auto', flex:1, position:'relative' }}>{children}</div>

            {footer && (
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8,
                padding:'14px 24px', borderTop:'1px solid var(--border)',
                background:'var(--bg-subtle)' }}>
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, children, hint, error }) {
  return (
    <label style={{ display:'block', marginBottom:14 }}>
      <div style={{ fontSize:11.5, fontWeight:600, color:'var(--text-2)', marginBottom:6,
        textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      {children}
      {hint  && !error && <div style={{ fontSize:11.5, color:'var(--text-3)', marginTop:5 }}>{hint}</div>}
      {error && <div style={{ fontSize:11.5, color:'var(--rose)', marginTop:5 }}>{error}</div>}
    </label>
  );
}

const inputStyle = {
  width:'100%', padding:'11px 14px',
  background:'var(--bg-subtle)',
  border:'1px solid var(--border)',
  borderRadius:'var(--r)',
  color:'var(--text)', fontSize:13.5,
  transition:'border-color 160ms, background 160ms, box-shadow 160ms',
};

const focusOn  = e => {
  e.target.style.borderColor = 'var(--primary)';
  e.target.style.background  = 'var(--bg-card-s)';
  e.target.style.boxShadow   = '0 0 0 3px var(--primary-bg2)';
};
const focusOff = e => {
  e.target.style.borderColor = 'var(--border)';
  e.target.style.background  = 'var(--bg-subtle)';
  e.target.style.boxShadow   = 'none';
};

export const Input = forwardRef(function Input({ style, onFocus, onBlur, ...props }, ref) {
  return <input
    ref={ref}
    style={{ ...inputStyle, ...style }}
    onFocus={e => { focusOn(e);  onFocus?.(e); }}
    onBlur ={e => { focusOff(e); onBlur?.(e);  }}
    {...props}/>;
});

/**
 * Select — custom animatsiyali dropdown (browser-default <select> emas).
 * API native bilan mos: `<Select value onChange><option value=...>...</option></Select>`.
 * `onChange` ga `{ target: { value } }` ko'rinishidagi event yuboriladi (native bilan bir xil).
 */
export function Select({ children, value, onChange, style, disabled, placeholder, autoFocus: _af, onFocus: _fOn, onBlur: _fOff, ...rest }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  const allOptions = useMemo(() => {
    const out = [];
    Children.forEach(children, c => {
      if (!isValidElement(c) || c.type !== 'option') return;
      const v = c.props.value ?? '';
      out.push({ value: String(v), label: c.props.children, disabled: c.props.disabled });
    });
    return out;
  }, [children]);

  const placeholderOpt = allOptions.find(o => o.value === '');
  const items = allOptions.filter(o => o.value !== '');
  const ph = placeholder ?? (placeholderOpt?.label) ?? '— Tanlang —';

  const selected = allOptions.find(o => o.value === String(value ?? ''));
  const showSearch = items.length > 6;

  const filtered = !query.trim()
    ? items
    : items.filter(o => String(o.label ?? '').toLowerCase().includes(query.toLowerCase()));

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

  const pick = (val) => {
    onChange?.({ target: { value: val } });
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={wrapRef} style={{ position:'relative' }} {...rest}>
      <button type="button" disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          ...inputStyle,
          display:'flex', alignItems:'center', gap:8,
          textAlign:'left', cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          padding:'10px 14px',
          ...style,
        }}>
        <span style={{
          flex:1, minWidth:0,
          color: selected && selected.value !== '' ? 'var(--text)' : 'var(--text-3)',
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          fontSize:13.5,
        }}>
          {selected && selected.value !== '' ? selected.label : ph}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration:0.18 }}
          style={{ display:'flex', color:'var(--text-3)' }}>
          <Icon name="chevronDown" size={14}/>
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity:0, y:-6, scale:0.98 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:-4, scale:0.98 }}
            transition={{ duration:0.16, ease:[0.22,1,0.36,1] }}
            style={{
              position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
              background:'var(--bg-2)', border:'1px solid var(--border-md)',
              borderRadius:'var(--r)', boxShadow:'var(--shadow-lg)',
              zIndex:300, overflow:'hidden',
            }}>
            {showSearch && (
              <div style={{ padding:8, borderBottom:'1px solid var(--border)' }}>
                <div style={{
                  display:'flex', alignItems:'center', gap:8,
                  background:'var(--bg-subtle)', border:'1px solid var(--border)',
                  borderRadius:'var(--r-xs)', padding:'7px 10px',
                }}>
                  <Icon name="search" size={13} color="var(--text-3)"/>
                  <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Qidirish..."
                    style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:13 }}/>
                </div>
              </div>
            )}
            <div style={{ maxHeight:260, overflowY:'auto', padding:6 }}>
              {filtered.length === 0 && (
                <div style={{ padding:'18px 12px', textAlign:'center', color:'var(--text-3)', fontSize:12.5 }}>
                  Topilmadi
                </div>
              )}
              {filtered.map((o) => {
                const isActive = o.value === String(value ?? '');
                return (
                  <button key={o.value} type="button" disabled={o.disabled}
                    onClick={() => !o.disabled && pick(o.value)}
                    style={{
                      width:'100%', display:'flex', alignItems:'center', gap:8,
                      padding:'9px 11px', borderRadius:8,
                      background: isActive ? 'var(--primary-bg)' : 'transparent',
                      color: o.disabled ? 'var(--text-3)' : (isActive ? 'var(--primary-l)' : 'var(--text)'),
                      fontWeight: isActive ? 600 : 500,
                      textAlign:'left', fontSize:13.5,
                      cursor: o.disabled ? 'not-allowed' : 'pointer',
                      transition:'background 120ms, color 120ms',
                    }}
                    onMouseEnter={e => { if (!isActive && !o.disabled) e.currentTarget.style.background='var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background='transparent'; }}>
                    <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{o.label}</span>
                    {isActive && <Icon name="check" size={14}/>}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * TimePicker — HH:MM dropdown (custom).
 * `value`: "HH:MM" string. `onChange({ target: { value } })`.
 */
const HH = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MM = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export function TimePicker({ value = '', onChange, disabled, placeholder = "Vaqtni tanlang", style }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const hRef = useRef(null);
  const mRef = useRef(null);

  const [h = '', m = ''] = (value || '').split(':');

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

  // active item ko'rinishida bo'lsin — ochilganda scrollIntoView
  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      hRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block:'center' });
      mRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block:'center' });
    }, 30);
  }, [open]);

  const setH = (newH) => onChange?.({ target: { value: `${newH}:${m || '00'}` } });
  const setM = (newM) => onChange?.({ target: { value: `${h || '09'}:${newM}` } });

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <button type="button" disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          ...inputStyle,
          display:'flex', alignItems:'center', gap:10,
          textAlign:'left', cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          padding:'10px 14px',
          ...style,
        }}>
        <Icon name="clock" size={14} color="var(--text-3)"/>
        <span style={{ flex:1, color: value ? 'var(--text)' : 'var(--text-3)', fontSize:13.5, fontVariantNumeric:'tabular-nums' }}>
          {value || placeholder}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration:0.18 }}
          style={{ display:'flex', color:'var(--text-3)' }}>
          <Icon name="chevronDown" size={14}/>
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity:0, y:-6, scale:0.98 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:-4, scale:0.98 }}
            transition={{ duration:0.16, ease:[0.22,1,0.36,1] }}
            style={{
              position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
              background:'var(--bg-2)', border:'1px solid var(--border-md)',
              borderRadius:'var(--r)', boxShadow:'var(--shadow-lg)',
              zIndex:300, padding:10,
              display:'grid', gridTemplateColumns:'1fr 1px 1fr', gap:8,
            }}>
            <div>
              <div style={{ fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)', marginBottom:6, padding:'0 6px' }}>Soat</div>
              <div ref={hRef} style={{ maxHeight:200, overflowY:'auto', paddingRight:4 }}>
                {HH.map(hr => {
                  const active = hr === h;
                  return (
                    <button key={hr} type="button" data-active={active}
                      onClick={() => setH(hr)}
                      style={{
                        width:'100%', padding:'7px 10px', borderRadius:6,
                        background: active ? 'var(--primary-bg)' : 'transparent',
                        color: active ? 'var(--primary-l)' : 'var(--text)',
                        fontWeight: active ? 600 : 500, fontSize:13,
                        fontVariantNumeric:'tabular-nums',
                        textAlign:'center', transition:'background 120ms, color 120ms',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background='var(--bg-hover)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background='transparent'; }}>
                      {hr}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ background:'var(--border)' }}/>
            <div>
              <div style={{ fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)', marginBottom:6, padding:'0 6px' }}>Daqiqa</div>
              <div ref={mRef} style={{ maxHeight:200, overflowY:'auto', paddingRight:4 }}>
                {MM.map(mn => {
                  const active = mn === m;
                  return (
                    <button key={mn} type="button" data-active={active}
                      onClick={() => setM(mn)}
                      style={{
                        width:'100%', padding:'7px 10px', borderRadius:6,
                        background: active ? 'var(--primary-bg)' : 'transparent',
                        color: active ? 'var(--primary-l)' : 'var(--text)',
                        fontWeight: active ? 600 : 500, fontSize:13,
                        fontVariantNumeric:'tabular-nums',
                        textAlign:'center', transition:'background 120ms, color 120ms',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background='var(--bg-hover)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background='transparent'; }}>
                      {mn}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * DateTimePicker — sana + vaqt (yengilroq variant: native date input + TimePicker).
 * `value`: "YYYY-MM-DDTHH:MM" yoki bo'sh. `onChange({ target: { value } })`.
 */
export function DateTimePicker({ value = '', onChange, disabled, style }) {
  const [datePart = '', timePart = ''] = (value || '').split('T');

  const setDate = (d) => {
    const t = timePart || '09:00';
    onChange?.({ target: { value: d ? `${d}T${t}` : '' } });
  };
  const setTime = (e) => {
    const t = e?.target?.value || '';
    if (!datePart && t) {
      const today = new Date().toISOString().slice(0,10);
      onChange?.({ target: { value: `${today}T${t}` } });
    } else {
      onChange?.({ target: { value: datePart ? `${datePart}T${t}` : '' } });
    }
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:8, ...style }}>
      <div style={{ position:'relative' }}>
        <input type="date" value={datePart} disabled={disabled}
          onChange={e => setDate(e.target.value)}
          style={{
            ...inputStyle,
            paddingLeft:38, padding:'10px 12px 10px 38px',
            colorScheme:'dark',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
          }}
          onFocus={focusOn} onBlur={focusOff}/>
        <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)', display:'flex', pointerEvents:'none' }}>
          <Icon name="calendar" size={14}/>
        </span>
      </div>
      <TimePicker value={timePart} onChange={setTime} disabled={disabled}/>
    </div>
  );
}

export function Textarea({ style, onFocus, onBlur, ...props }) {
  return <textarea
    style={{ ...inputStyle, minHeight:96, resize:'vertical', lineHeight:1.5, ...style }}
    onFocus={e => { focusOn(e);  onFocus?.(e); }}
    onBlur ={e => { focusOff(e); onBlur?.(e);  }}
    {...props}/>;
}

/**
 * UserPicker — avatar + qidirish bilan dropdown.
 * options: [{ value, name, hue, subtitle, photoUrl }]
 */
export function UserPicker({ value, options = [], placeholder = 'Tanlang...', onChange, disabled }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

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

  const selected = useMemo(
    () => options.find(o => o.value === value) || null,
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o =>
      o.name?.toLowerCase().includes(q) ||
      o.subtitle?.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <button type="button" onClick={() => !disabled && setOpen(o => !o)} disabled={disabled}
        style={{
          ...inputStyle,
          display:'flex', alignItems:'center', gap:10,
          textAlign:'left', cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          padding:'9px 14px',
        }}>
        {selected ? (
          <>
            {selected.photoUrl
              ? <img src={selected.photoUrl} alt="" style={{ width:24, height:24, borderRadius:'50%', objectFit:'cover' }}/>
              : <Avatar name={selected.name} hue={selected.hue ?? 200} size="xs"/>}
            <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
              <div style={{ fontSize:13.5, color:'var(--text)', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{selected.name}</div>
              {selected.subtitle && (
                <div style={{ fontSize:11, color:'var(--text-3)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{selected.subtitle}</div>
              )}
            </div>
          </>
        ) : (
          <span style={{ flex:1, color:'var(--text-3)', fontSize:13.5 }}>{placeholder}</span>
        )}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} color="var(--text-3)"/>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity:0, y:-6, scale:0.98 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:-4, scale:0.98 }}
            transition={{ duration:0.16 }}
            style={{
              position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
              background:'var(--bg-2)', border:'1px solid var(--border-md)',
              borderRadius:'var(--r)', boxShadow:'var(--shadow-lg)',
              zIndex:300, overflow:'hidden',
            }}>
            <div style={{ padding:8, borderBottom:'1px solid var(--border)' }}>
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                background:'var(--bg-subtle)', border:'1px solid var(--border)',
                borderRadius:'var(--r-xs)', padding:'7px 10px',
              }}>
                <Icon name="search" size={13} color="var(--text-3)"/>
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Qidirish..."
                  style={{
                    flex:1, background:'transparent', border:'none', outline:'none',
                    color:'var(--text)', fontSize:13,
                  }}/>
              </div>
            </div>
            <div style={{ maxHeight:240, overflowY:'auto', padding:5 }}>
              {filtered.length === 0 && (
                <div style={{ padding:'18px 12px', textAlign:'center', color:'var(--text-3)', fontSize:12.5 }}>
                  Topilmadi
                </div>
              )}
              {filtered.map(o => {
                const isActive = o.value === value;
                return (
                  <button key={o.value} type="button"
                    onClick={() => { onChange?.(o.value); setOpen(false); setQuery(''); }}
                    style={{
                      width:'100%', display:'flex', alignItems:'center', gap:10,
                      padding:'8px 10px', borderRadius:8,
                      background: isActive ? 'var(--primary-bg)' : 'transparent',
                      color:'var(--text)', textAlign:'left',
                      transition:'background 120ms',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background='var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background='transparent'; }}>
                    {o.photoUrl
                      ? <img src={o.photoUrl} alt="" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover' }}/>
                      : <Avatar name={o.name} hue={o.hue ?? 200} size="sm"/>}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{o.name}</div>
                      {o.subtitle && <div style={{ fontSize:11, color:'var(--text-3)' }}>{o.subtitle}</div>}
                    </div>
                    {isActive && <Icon name="check" size={14} color="var(--primary-l)"/>}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, danger, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={420}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{cancelText}</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmText}</button>
      </>}>
      <div style={{ fontSize:13.5, color:'var(--text-2)', lineHeight:1.6 }}>{message}</div>
    </Modal>
  );
}
