import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from '../components/ui.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const submit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try { await login(email, password); }
    catch (err) { setError(err.message || 'Login xatolik'); }
    finally { setLoading(false); }
  };

  const fill = (e, p) => { setEmail(e); setPassword(p); };

  return (
    <div className="login-bg">
      {/* Animated teal orb */}
      <motion.div style={{
        position:'absolute', width:700, height:700, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(13,148,136,0.22) 0%, transparent 65%)',
        top:'-25%', left:'50%', marginLeft:-350, pointerEvents:'none',
      }}
        animate={{ scale:[1,1.1,1], y:[0,20,0] }}
        transition={{ duration:10, repeat:Infinity, ease:'easeInOut' }}
      />
      <motion.div style={{
        position:'absolute', width:400, height:400, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 65%)',
        bottom:'-10%', right:'10%', pointerEvents:'none',
      }}
        animate={{ scale:[1,1.15,1] }}
        transition={{ duration:13, repeat:Infinity, ease:'easeInOut', delay:3 }}
      />

      {/* Floating grid dots */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.06, pointerEvents:'none' }}>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="var(--teal-ll)"/>
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)"/>
      </svg>

      <motion.div className="login-card"
        initial={{ opacity:0, y:32, scale:0.96 }}
        animate={{ opacity:1, y:0, scale:1 }}
        transition={{ duration:0.5, ease:[0.22,1,0.36,1] }}
      >
        {/* Logo */}
        <motion.div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}
          initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.1 }}>
          <div style={{
            width:40, height:40, borderRadius:12,
            background:'linear-gradient(135deg,var(--teal-l),var(--teal-d))',
            display:'grid', placeItems:'center', color:'#fff',
            boxShadow:'var(--teal-glow)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, letterSpacing:'-0.04em' }}>Record Nazorat</div>
            <div style={{ fontSize:10, color:'var(--text-3)', letterSpacing:'0.06em', textTransform:'uppercase', marginTop:1 }}>Boshqaruv paneli</div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.15 }}>
          <h2 style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.04em', marginBottom:5 }}>Xush kelibsiz</h2>
          <p style={{ fontSize:13.5, color:'var(--text-2)', marginBottom:24 }}>Davom etish uchun tizimga kiring</p>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div className="login-error" style={{ marginBottom:14 }}
              initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
              exit={{ opacity:0, height:0 }} transition={{ duration:0.22 }}>
              <Icon name="alert" size={14}/>{error}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={submit}>
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}>
            <div className="login-input-wrap">
              <span className="login-input-ico"><Icon name="mail" size={15}/></span>
              <input type="email" placeholder="Email manzil" autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)} required/>
            </div>
          </motion.div>

          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 }}>
            <div className="login-input-wrap" style={{ marginBottom:20 }}>
              <span className="login-input-ico"><Icon name="key" size={15}/></span>
              <input type={showPwd ? 'text' : 'password'} placeholder="Parol"
                value={password} onChange={e => setPassword(e.target.value)} required
                style={{ paddingRight:42 }}/>
              <button type="button" onClick={() => setShowPwd(p => !p)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)', cursor:'pointer' }}>
                <Icon name={showPwd ? 'eyeOff' : 'eye'} size={15}/>
              </button>
            </div>
          </motion.div>

          <motion.button type="submit" className="btn btn-primary btn-lg"
            style={{ width:'100%', justifyContent:'center' }}
            disabled={loading}
            initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.97 }}
          >
            {loading
              ? <motion.div style={{ width:18, height:18, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff' }}
                  animate={{ rotate:360 }} transition={{ duration:0.7, repeat:Infinity, ease:'linear' }}/>
              : <><Icon name="arrowRight" size={15}/> Kirish</>}
          </motion.button>
        </form>

        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.42 }}
          style={{ marginTop:24, padding:'14px 16px', background:'var(--glass-2)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', textAlign:'center' }}>
          <div style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.6 }}>
            Tizimga kirish uchun siz administrator tomonidan taklif qilingan
            <br/>Telegram bot orqali yoki email/parol bilan kirishingiz mumkin.
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
