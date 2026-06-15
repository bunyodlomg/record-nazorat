// Minimal clsx-like class name combiner (animate-ui icons expect a `cn` helper).
// Loyiha Tailwind ishlatmaydi, shu sabab tailwind-merge shart emas.
export function cn(...inputs) {
  const out = [];
  const walk = (v) => {
    if (!v) return;
    if (typeof v === 'string' || typeof v === 'number') { out.push(String(v)); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') {
      for (const k in v) if (v[k]) out.push(k);
    }
  };
  inputs.forEach(walk);
  return out.join(' ');
}

export default cn;
