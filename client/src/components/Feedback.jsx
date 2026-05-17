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
