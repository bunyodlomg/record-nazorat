/**
 * CS2-style UI sound effects (synthesized via Web Audio API).
 * Birinchi user gesture'dan keyin AudioContext ishga tushadi (browser policy).
 *
 * Real CS2 sample fayllari ishlatilmoqchi bo'lsa:
 *   client/public/sounds/ui_hover.mp3 va ui_click.mp3 ga qo'y,
 *   so'ng quyidagi `synth` chaqirig'larini `playFile(...)` ga almashtir.
 */

let ctx = null;
let muted = (typeof localStorage !== 'undefined' && localStorage.getItem('ep_muted') === '1');
const SAMPLES = { hover: null, click: null };

const getCtx = () => {
  if (typeof window === 'undefined') return null;
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

/* ── Synthesizers ─────────────────────────────────────────────── */
function synthHover() {
  const ac = getCtx(); if (!ac) return;
  const t  = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();

  osc.type = 'square';
  osc.frequency.setValueAtTime(2400, t);
  osc.frequency.exponentialRampToValueAtTime(1600, t + 0.04);

  filter.type = 'highpass';
  filter.frequency.value = 800;

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

  osc.connect(filter).connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.06);
}

function synthClick() {
  const ac = getCtx(); if (!ac) return;
  const t  = ac.currentTime;

  // Tonal "thunk"
  const osc = ac.createOscillator();
  const oGain = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(900, t);
  osc.frequency.exponentialRampToValueAtTime(380, t + 0.08);
  oGain.gain.setValueAtTime(0.0001, t);
  oGain.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
  oGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(oGain).connect(ac.destination);
  osc.start(t); osc.stop(t + 0.13);

  // Noise burst (snap)
  const buf = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i/data.length);
  const src = ac.createBufferSource();
  const nGain = ac.createGain();
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 1500;
  src.buffer = buf;
  nGain.gain.setValueAtTime(0.10, t);
  nGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(hp).connect(nGain).connect(ac.destination);
  src.start(t); src.stop(t + 0.05);
}

/* Pop — modal/dropdown ochilganda (yumshoq sof tovush) */
function synthPop() {
  const ac = getCtx(); if (!ac) return;
  const t  = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(720, t + 0.08);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.10, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  osc.connect(gain).connect(ac.destination);
  osc.start(t); osc.stop(t + 0.15);
}

/* Success — vazifa belgilanganda (ikki nota arpeggio) */
function synthSuccess() {
  const ac = getCtx(); if (!ac) return;
  const t = ac.currentTime;
  const notes = [660, 880]; // E5, A5
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t + i*0.06);
    gain.gain.setValueAtTime(0.0001, t + i*0.06);
    gain.gain.exponentialRampToValueAtTime(0.12, t + i*0.06 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i*0.06 + 0.18);
    osc.connect(gain).connect(ac.destination);
    osc.start(t + i*0.06); osc.stop(t + i*0.06 + 0.2);
  });
}

/* Notify — bildirishnoma kelganda (ikki tonik "bell") */
function synthNotify() {
  const ac = getCtx(); if (!ac) return;
  const t = ac.currentTime;
  const notes = [988, 1318]; // B5, E6
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t + i*0.08);
    gain.gain.setValueAtTime(0.0001, t + i*0.08);
    gain.gain.exponentialRampToValueAtTime(0.08, t + i*0.08 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i*0.08 + 0.35);
    osc.connect(gain).connect(ac.destination);
    osc.start(t + i*0.08); osc.stop(t + i*0.08 + 0.4);
  });
}

/* Toggle — segment/tab almashganda (qisqa "tip") */
function synthToggle() {
  const ac = getCtx(); if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.06, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  osc.connect(gain).connect(ac.destination);
  osc.start(t); osc.stop(t + 0.07);
}

/* Error — xatolik / bekor qilish (pastga tushuvchi) */
function synthError() {
  const ac = getCtx(); if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(280, t);
  osc.frequency.exponentialRampToValueAtTime(150, t + 0.16);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.10, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(gain).connect(ac.destination);
  osc.start(t); osc.stop(t + 0.22);
}

/* ── Optional file-based playback ──────────────────────────────── */
async function loadSample(name, url) {
  const ac = getCtx(); if (!ac) return;
  const res = await fetch(url);
  if (!res.ok) return;
  const buf = await ac.decodeAudioData(await res.arrayBuffer());
  SAMPLES[name] = buf;
}

function playSample(name, volume = 0.6) {
  const ac = getCtx(); if (!ac || !SAMPLES[name]) return false;
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.buffer = SAMPLES[name];
  src.connect(gain).connect(ac.destination);
  src.start();
  return true;
}

// Try to load real CS2-style samples if user dropped them into public/sounds/
if (typeof window !== 'undefined') {
  loadSample('hover', '/sounds/ui_hover.mp3').catch(() => {});
  loadSample('click', '/sounds/ui_click.mp3').catch(() => {});
}

/* ── Public API ────────────────────────────────────────────────── */
export const sfx = {
  hover:   () => { if (muted) return; if (!playSample('hover', 0.5)) synthHover(); },
  click:   () => { if (muted) return; if (!playSample('click', 0.7)) synthClick(); },
  pop:     () => { if (muted) return; synthPop(); },
  success: () => { if (muted) return; synthSuccess(); },
  notify:  () => { if (muted) return; synthNotify(); },
  toggle:  () => { if (muted) return; synthToggle(); },
  error:   () => { if (muted) return; synthError(); },
  setMuted: v => {
    muted = !!v;
    try { localStorage.setItem('ep_muted', muted ? '1' : '0'); } catch {}
  },
  isMuted:  () => muted,
};
