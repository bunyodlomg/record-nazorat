import { motion } from 'framer-motion';

const skeletonAnim = {
  animate: { opacity: [0.45, 0.95, 0.45] },
  transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
};

function SkLine({ w = '100%', h = 12, mb = 10, br = 6 }) {
  return (
    <motion.div {...skeletonAnim}
      style={{ width:w, height:h, background:'var(--bg-subtle)', borderRadius:br, marginBottom:mb }}/>
  );
}

function SkBlock({ h, w = '100%', mb = 12, br = 14 }) {
  return (
    <motion.div {...skeletonAnim}
      style={{ width:w, height:h, background:'var(--bg-subtle)', borderRadius:br, marginBottom:mb }}/>
  );
}

export default function LoadingScreen({ label = 'Record Nazorat yuklanmoqda...' }) {
  return (
    <>
      <div className="app-bg"/>
      <div style={{
        position:'fixed', inset:0, display:'flex', flexDirection:'column',
        padding:'18px 16px', overflow:'hidden',
      }}>
        {/* Header skeleton */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          height:58, marginBottom:18,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <motion.div {...skeletonAnim}
              style={{ width:36, height:36, borderRadius:10, background:'var(--bg-subtle)' }}/>
            <div>
              <SkLine w={90} h={11} mb={6}/>
              <SkLine w={60} h={9}  mb={0}/>
            </div>
          </div>
          <motion.div {...skeletonAnim}
            style={{ width:36, height:36, borderRadius:'50%', background:'var(--bg-subtle)' }}/>
        </div>

        {/* Top stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
          <SkBlock h={86}/>
          <SkBlock h={86}/>
        </div>

        {/* Wide card */}
        <SkBlock h={150} mb={14}/>

        {/* List rows */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            display:'flex', gap:12, alignItems:'center',
            padding:'12px 14px', marginBottom:8,
            background:'var(--bg-subtle)', borderRadius:14,
          }}>
            <motion.div {...skeletonAnim}
              style={{ width:36, height:36, borderRadius:'50%', background:'var(--bg-hover)', flexShrink:0 }}/>
            <div style={{ flex:1 }}>
              <SkLine w="55%" h={11} mb={6}/>
              <SkLine w="35%" h={9}  mb={0}/>
            </div>
            <motion.div {...skeletonAnim}
              style={{ width:48, height:22, borderRadius:8, background:'var(--bg-hover)' }}/>
          </div>
        ))}

        {/* Bottom centered spinner + label */}
        <div style={{
          marginTop:'auto', display:'flex', alignItems:'center', justifyContent:'center',
          gap:10, padding:'18px 0 8px', color:'var(--text-3)',
        }}>
          <motion.div
            style={{
              width:18, height:18, borderRadius:'50%',
              border:'2px solid var(--border-md)', borderTopColor:'var(--primary)',
            }}
            animate={{ rotate:360 }}
            transition={{ duration:0.8, repeat:Infinity, ease:'linear' }}/>
          <span style={{ fontSize:13, fontWeight:500, letterSpacing:0.2 }}>{label}</span>
        </div>
      </div>
    </>
  );
}
