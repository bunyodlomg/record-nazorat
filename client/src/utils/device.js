// Qurilma sichqonchani (hover) qo'llab-quvvatlaydimi.
//
// DIQQAT: faqat `matchMedia('(hover: hover)')` ga tayanib bo'lmaydi — Telegram
// mobil webview (va ko'p Android WebView) buni noto'g'ri `true` qaytaradi.
// Shuning uchun avval TOUCH qurilma borligini aniqlaymiz: touch bo'lsa hover yo'q.
// Mobil'da hover yopishib qolib, tap 2-3 marta bosishni talab qilardi.
const hasTouch =
  typeof window !== 'undefined' &&
  (('ontouchstart' in window) || ((navigator.maxTouchPoints || 0) > 0));

const hoverMedia =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(hover: hover)').matches
    : true;

export const CAN_HOVER = hoverMedia && !hasTouch;

// CSS hover qoidalari `html.can-hover ...` bilan yozilgan — buggy webview media
// query'lariga tayanmasdan, faqat shu klass bo'lganda hover ishlaydi.
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('can-hover', CAN_HOVER);
}
