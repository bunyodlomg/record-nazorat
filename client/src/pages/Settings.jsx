import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '../components/ui.jsx';
import { Spinner, ErrorBox } from '../components/Feedback.jsx';
import PageHero from '../components/PageHero.jsx';
import { useFetch } from '../hooks/useFetch.js';
import api from '../services/api.js';
import { sfx } from '../hooks/useSound.js';

function GemInput({ label, hint, value, onChange, color }) {
  return (
    <div className="card" style={{ padding:'18px 16px', border:`1px solid var(--border)` }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
        <div style={{
          width:48, height:48, borderRadius:14,
          background: color || 'var(--primary-bg)',
          display:'grid', placeItems:'center',
          fontSize:24, flexShrink:0,
        }}>💎</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:3 }}>{label}</div>
          <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:12 }}>{hint}</div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={() => onChange(Math.max(0, value - 1))}
              className="btn btn-ghost btn-icon" style={{ width:36, height:36, fontSize:16, fontWeight:700 }}>−</button>
            <input
              type="number"
              value={value}
              onChange={e => onChange(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
              min={0} max={1000}
              style={{
                width:90, padding:'10px 12px', borderRadius:9,
                background:'var(--bg-subtle)', border:'1px solid var(--border)',
                fontFamily:'var(--display)', fontSize:18, fontWeight:700,
                color:'var(--primary-l)', textAlign:'center',
                MozAppearance:'textfield',
              }}/>
            <button onClick={() => onChange(Math.min(1000, value + 1))}
              className="btn btn-ghost btn-icon" style={{ width:36, height:36, fontSize:16, fontWeight:700 }}>+</button>
            <div style={{ fontSize:11.5, color:'var(--text-3)', marginLeft:'auto' }}>
              har vazifa uchun
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data, loading, error, refetch } = useFetch(() => api.settings.get());
  const initial = data?.data || data || {};

  const [lessonGem, setLessonGem] = useState(5);
  const [speakingGem, setSpeakingGem] = useState(10);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (initial.lessonGem != null) setLessonGem(initial.lessonGem);
    if (initial.speakingGem != null) setSpeakingGem(initial.speakingGem);
  }, [initial.lessonGem, initial.speakingGem]);

  const dirty = lessonGem !== (initial.lessonGem ?? 5) || speakingGem !== (initial.speakingGem ?? 10);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      await api.settings.update({ lessonGem, speakingGem });
      sfx.success();
      setSaved(true);
      refetch();
      setTimeout(() => setSaved(false), 2200);
    } catch (e) {
      alert(e.message || 'Xatolik');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="page"><Spinner/></div>;
  if (error)   return <div className="page"><ErrorBox message={error} onRetry={refetch}/></div>;

  return (
    <motion.div className="page"
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.32 }}>
      <PageHero
        title="Olmoslar"
        subtitle="Har vazifa uchun qancha olmos berilishini sozlang"
        emoji="💎"
        stats={[
          { value: lessonGem,   suffix:' 💎', label:'Kunlik vazifa',   icon:'check',    bg:'var(--primary-bg)', color:'var(--primary)' },
          { value: speakingGem, suffix:' 💎', label:'Speaking vazifa', icon:'activity', bg:'var(--amber-bg)',   color:'var(--amber)' },
        ]}
      />

      <div style={{ marginBottom:14, padding:'14px 16px', background:'var(--primary-bg)', borderRadius:12, border:'1px solid var(--border)' }}>
        <div style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.55 }}>
          O'quvchi har belgilangan vazifa uchun olmos oladi. Belgilanmagan yoki qaytarilgan vazifa uchun olmos berilmaydi.
          Reyting va Leaderboard olmos bo'yicha tartiblanadi.
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:18 }}>
        <GemInput
          label="Kunlik (dars) vazifa"
          hint="Har dars kuni avto-yaratilgan vazifa belgilanganda beriladi"
          value={lessonGem}
          onChange={setLessonGem}
          color="var(--primary-bg)"/>
        <GemInput
          label="Speaking vazifa"
          hint="Haftalik speaking kvota vazifasi belgilanganda beriladi"
          value={speakingGem}
          onChange={setSpeakingGem}
          color="var(--amber-bg)"/>
      </div>

      <div style={{
        position:'sticky', bottom:14, padding:'12px 14px',
        background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:12, display:'flex', alignItems:'center', gap:10,
        boxShadow:'0 4px 16px rgba(0,0,0,0.18)',
      }}>
        <div style={{ flex:1, fontSize:12, color:'var(--text-2)' }}>
          {saved
            ? <span style={{ color:'var(--primary-l)', fontWeight:600 }}>✓ Saqlandi</span>
            : dirty
            ? "O'zgarishlar bor — saqlashni unutmang"
            : "Hech qanday o'zgarish yo'q"}
        </div>
        <button className="btn btn-primary"
          onClick={save}
          disabled={!dirty || saving}>
          {saving ? 'Saqlanmoqda…' : 'Saqlash'}
        </button>
      </div>
    </motion.div>
  );
}
