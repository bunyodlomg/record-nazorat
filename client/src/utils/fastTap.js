import { IS_IOS } from './device.js';

/**
 * FastTap — iOS WebKit'ning click-sintez heuristikalarini chetlab o'tish.
 *
 * Muammo: iOS Safari/WKWebView (Telegram webview ham) tap'dan click yasashda
 * bir nechta heuristika qo'llaydi — hover'ni "sinab ko'rish", double-tap-zoom
 * kutish, scroll'ni to'xtatuvchi tap'ni yutish, home-indicator zonasi himoyasi.
 * Natijada tugma/karta/tab 1-tapda ishlamay 2-3 tap talab qiladi.
 * Android/desktop'da bu heuristikalar yo'q.
 *
 * Yechim (FastClick uslubi): touchend'da harakatsiz qisqa tap aniqlansa,
 * sintetik click'ni KUTMASDAN o'zimiz mousedown→mouseup→click ketma-ketligini
 * dispatch qilamiz va preventDefault() bilan brauzerning kechikkan/yutilishi
 * mumkin bo'lgan click'ini bekor qilamiz. React root'da native click'ni
 * tinglagani uchun barcha mavjud onClick'lar o'zgarishsiz ishlayveradi.
 *
 * FAQAT iOS'da yoqiladi — Android/desktop'ga mutlaqo ta'sir qilmaydi.
 */

// Native xatti-harakati kerak elementlar — ularga aralashmaymiz
// (focus, klaviatura, matn tanlash, fayl tanlash...).
const NATIVE_SELECTOR =
  'input, textarea, select, label, [contenteditable], [contenteditable="true"], audio, video';

// Aniq bosiladigan elementlar. Bundan tashqari cursor:pointer bo'lgan
// har qanday element ham bosiladigan hisoblanadi (loyihada clickable div'lar
// hammasi inline cursor:pointer bilan yozilgan).
const ACTION_SELECTOR =
  'button, a, [role="button"], [role="tab"], .dock-btn, .gcard, .card-hov, [data-tap]';

const MOVE_TOLERANCE_PX = 12;  // bundan ko'p siljisa — scroll/swipe, tap emas
const MAX_TAP_MS        = 700; // bundan uzun — long-press, tap emas

function findActionable(start) {
  let node = start;
  while (node && node !== document.body && node.nodeType === 1) {
    if (node.matches(NATIVE_SELECTOR)) return null;
    if (node.matches(ACTION_SELECTOR) || getComputedStyle(node).cursor === 'pointer') {
      return node.disabled || node.getAttribute?.('aria-disabled') === 'true' ? null : node;
    }
    node = node.parentElement;
  }
  return null;
}

export function initFastTap() {
  if (!IS_IOS || typeof document === 'undefined') return;

  let sx = 0, sy = 0, startedAt = 0;
  let moved = true; // default true — faqat to'g'ri boshlangan tap'da false bo'ladi

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { moved = true; return; }
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY;
    startedAt = Date.now();
    moved = false;
  }, { capture: true, passive: true });

  document.addEventListener('touchmove', (e) => {
    if (moved) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - sx) > MOVE_TOLERANCE_PX ||
        Math.abs(t.clientY - sy) > MOVE_TOLERANCE_PX) moved = true;
  }, { capture: true, passive: true });

  document.addEventListener('touchend', (e) => {
    if (moved || Date.now() - startedAt > MAX_TAP_MS) return;
    if (!e.cancelable) return; // scroll ichida — brauzerga qoldiramiz

    const t = e.changedTouches[0];
    // Barmoq ko'tarilgan nuqtadagi HAQIQIY element (overlay/modal'lar hisobga olinadi)
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (!el || !findActionable(el)) return;

    // Brauzerning o'z (kechikkan/yutilishi mumkin) click'ini o'chiramiz
    e.preventDefault();

    // Native click blur qilardi — klaviatura ochiq qolib ketmasin
    const ae = document.activeElement;
    if (ae && ae !== el && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && !el.contains(ae)) ae.blur();

    const opts = {
      bubbles: true, cancelable: true, view: window,
      clientX: t.clientX, clientY: t.clientY, detail: 1,
    };
    // To'liq mouse ketma-ketligi: document'dagi "outside click" (mousedown)
    // tinglovchilari ham xuddi native'dagidek ishlashi uchun.
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }, { capture: true, passive: false });
}
