import { motion } from 'framer-motion';
import { Icon } from './ui.jsx';

function CenterCard({ icon, title, message, accent = 'var(--primary)', accentBg = 'var(--primary-bg)', children }) {
  return (
    <>
      <div className="app-bg"/>
      <div style={{
        position:'fixed', inset:0, display:'grid', placeItems:'center', padding:'24px',
      }}>
        <motion.div
          initial={{ opacity:0, y:18, scale:0.96 }}
          animate={{ opacity:1, y:0, scale:1 }}
          transition={{ duration:0.5, ease:[0.22,1,0.36,1] }}
          className="card"
          style={{
            maxWidth:380, width:'100%', padding:'32px 26px',
            display:'flex', flexDirection:'column', alignItems:'center',
            textAlign:'center', gap:16,
          }}>
          <motion.div
            animate={{ scale:[1, 1.06, 1] }}
            transition={{ duration:2.4, repeat:Infinity, ease:'easeInOut' }}
            style={{
              width:72, height:72, borderRadius:22,
              background:accentBg, color:accent,
              display:'grid', placeItems:'center',
              boxShadow:`0 0 32px ${accentBg}`,
            }}>
            <Icon name={icon} size={32}/>
          </motion.div>
          <h2 style={{ fontSize:20, fontWeight:700, margin:0, color:'var(--text)' }}>{title}</h2>
          <p style={{ fontSize:14, color:'var(--text-2)', margin:0, lineHeight:1.6, maxWidth:300 }}>
            {message}
          </p>
          {children}
        </motion.div>
      </div>
    </>
  );
}

export function PendingScreen({ onRefresh, onLogout }) {
  return (
    <CenterCard
      icon="clock"
      title="So'rov yuborildi"
      message="Hisobingiz administrator tomonidan tasdiqlanishi kutilmoqda. Tasdiqlangandan so'ng bu yerga qaytib kirishingiz mumkin."
      accent="var(--amber)"
      accentBg="var(--amber-bg)">
      <div style={{ display:'flex', gap:8, marginTop:8, width:'100%' }}>
        {onRefresh && (
          <button className="btn btn-primary" style={{ flex:1 }} onClick={onRefresh}>
            Yangilash
          </button>
        )}
        {onLogout && (
          <button className="btn btn-secondary" style={{ flex:1 }} onClick={onLogout}>
            Chiqish
          </button>
        )}
      </div>
    </CenterCard>
  );
}

export function RejectedScreen({ onLogout }) {
  return (
    <CenterCard
      icon="alert"
      title="Ruxsat berilmagan"
      message="Sizning so'rovingiz administrator tomonidan rad etildi yoki sizga kirish huquqi berilmagan. Iltimos, administrator bilan bog'laning."
      accent="var(--rose)"
      accentBg="var(--rose-bg)">
      {onLogout && (
        <button className="btn btn-secondary" style={{ marginTop:8, width:'100%' }} onClick={onLogout}>
          Chiqish
        </button>
      )}
    </CenterCard>
  );
}

export function NoInviteScreen({ onLogout, error }) {
  const isInvalidLink = error && /yaroqsiz|muddati|topilmadi/i.test(error);
  return (
    <CenterCard
      icon="alert"
      title={isInvalidLink ? 'Taklif link yaroqsiz' : 'Taklif link kerak'}
      message={
        isInvalidLink
          ? "Sizning taklif linkingiz eskirgan, ishlatilgan yoki bekor qilingan. Iltimos, administrator yoki o'qituvchidan yangi link so'rang."
          : "Bu tizimga kirish uchun administrator yoki o'qituvchidan taklif link olishingiz kerak."
      }
      accent="var(--amber)"
      accentBg="var(--amber-bg)">
      {error && (
        <div style={{
          padding:'8px 12px', background:'var(--bg-subtle)', borderRadius:8,
          fontSize:11, color:'var(--text-3)', fontFamily:'var(--mono)',
          width:'100%', textAlign:'center', wordBreak:'break-word',
        }}>
          {error}
        </div>
      )}
      {onLogout && (
        <button className="btn btn-secondary" style={{ marginTop:8, width:'100%' }} onClick={onLogout}>
          Yopish
        </button>
      )}
    </CenterCard>
  );
}
