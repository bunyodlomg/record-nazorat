// iOS (iPhone/iPad) qurilmasini aniqlash.
//
// iOS Safari/webview'da hover effekti bo'lgan elementda 1-tap "hover"ni tetiklaydi,
// click esa 2-tapga qoladi (Android va desktop'da bu muammo yo'q). Shuning uchun
// FAQAT iOS'da framer `whileHover` (element ko'tarilishi) o'chiriladi.
export const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1));

if (typeof document !== 'undefined' && IS_IOS) {
  document.documentElement.classList.add('is-ios');
}

// Touch qurilma (mobil). Bunda tap `mouseenter` ni ham tetiklaydi — hover ovozi
// ortiqcha (click bilan 2 marta chalinadi), shuning uchun touch'da hover ovozi o'chiriladi.
export const IS_TOUCH =
  typeof window !== 'undefined' &&
  (('ontouchstart' in window) || ((navigator.maxTouchPoints || 0) > 0));
