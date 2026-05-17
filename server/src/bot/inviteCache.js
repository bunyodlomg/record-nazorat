/**
 * Bot orqali kelgan /start invite_xxx tokenlarini vaqtinchalik saqlash.
 * Foydalanuvchi WebApp'ni ochganda start_param kelmasa (Telegram BotFather'da
 * Direct Link Mini App sozlanmagan), shu cache'dan tekshiramiz.
 *
 * TTL: 10 daqiqa (foydalanuvchi botni boshlash va WebApp ochish orasidagi vaqt).
 */

const cache = new Map(); // tgId -> { token, expiresAt }
const TTL_MS = 10 * 60 * 1000;

function set(tgId, token) {
  cache.set(String(tgId), { token, expiresAt: Date.now() + TTL_MS });
}

function get(tgId) {
  const entry = cache.get(String(tgId));
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(String(tgId));
    return null;
  }
  return entry.token;
}

function consume(tgId) {
  const token = get(tgId);
  if (token) cache.delete(String(tgId));
  return token;
}

// Vaqti-vaqti bilan tozalash
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (v.expiresAt < now) cache.delete(k);
  }
}, 5 * 60 * 1000).unref?.();

module.exports = { set, get, consume };
