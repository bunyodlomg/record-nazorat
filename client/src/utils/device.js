// Hover FAQAT desktopda ishlaydi (CSS effekt, framer animatsiya, ovoz).
//
// Mobil (touch) qurilmada hover:
//  - CSS `:hover` 1-tapni "yutib" click'ni 2-tapga suradi (iOS),
//  - framer `whileHover` elementni ko'taradi → tap o'tkazib yuboradi,
//  - tap `mouseenter` ni tetiklab hover ovozi ortiqcha chalinadi.
// Shuning uchun touch qurilmada hover butunlay o'chiriladi.
//
// matchMedia('(hover: hover)') Telegram webview'da ishonchsiz (noto'g'ri true
// qaytaradi), shuning uchun TOUCH borligiga tayanamiz.
export const IS_TOUCH =
  typeof window !== 'undefined' &&
  (('ontouchstart' in window) || ((navigator.maxTouchPoints || 0) > 0));

export const CAN_HOVER = !IS_TOUCH;

// iOS (iPhone/iPad + iPadOS'ning "MacIntel" niqobi + Telegram platform belgisi).
// iOS WebKit'ning click-sintez heuristikalari uchun alohida yo'l kerak (fastTap).
export const IS_IOS =
  typeof window !== 'undefined' && (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) ||
    window.Telegram?.WebApp?.platform === 'ios'
  );

// CSS hover qoidalari `:where(html.can-hover) ...:hover` bilan yozilgan — faqat shu
// klass bo'lganda (desktop) hover ishlaydi.
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('can-hover', CAN_HOVER);
  document.documentElement.classList.toggle('is-ios', IS_IOS);
}
