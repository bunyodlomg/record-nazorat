import { useEffect, useState } from 'react';

/**
 * Telegram WebApp integratsiyasi.
 * SDK index.html da yuklanadi (window.Telegram.WebApp).
 * Browser'da ishga tushganda no-op (graceful fallback).
 */

export const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
export const isTelegram = !!tg && !!tg.initData;

if (typeof window !== 'undefined') {
  console.log('[Telegram WebApp]', {
    hasTg: !!tg,
    hasInitData: !!tg?.initData,
    initDataLen: tg?.initData?.length || 0,
    startParam: tg?.initDataUnsafe?.start_param || null,
    user: tg?.initDataUnsafe?.user || null,
    platform: tg?.platform,
    version: tg?.version,
    isTelegram,
  });
}

/* ── Bootstrap (main.jsx dan chaqiriladi) ──────────────────────────── */
export function initTelegram() {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    document.body.classList.add('tg-app');
    if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
    // Fullscreen faqat telefonda (android/ios). Desktop/web'da fullscreen kerak emas —
    // aks holda oyna keraksiz cho'zilib ketadi.
    const isMobile = ['android', 'ios'].includes(tg.platform);
    if (isMobile && typeof tg.requestFullscreen === 'function') tg.requestFullscreen?.();
    applyTheme();
    tg.onEvent('themeChanged', applyTheme);
    tg.onEvent('viewportChanged', applyViewportVar);
    tg.onEvent?.('safeAreaChanged',        applySafeArea);
    tg.onEvent?.('contentSafeAreaChanged', applySafeArea);
    tg.onEvent?.('fullscreenChanged',      applySafeArea);
    window.addEventListener('resize', applyViewportVar);
    applyViewportVar();
    applySafeArea();
  } catch (e) { console.warn('TG init:', e); }
}

function applyViewportVar() {
  if (!tg) return;
  const reported = tg.viewportStableHeight || tg.viewportHeight || 0;
  // Telegram ba'zan eskirgan (kattaroq) qiymat qaytaradi — bunda .shell ekrandan
  // uzunroq bo'lib, pastki kontent ko'rinmay qoladi. Haqiqiy oynadan katta
  // bo'lmasligini kafolatlaymiz.
  const h = reported ? Math.min(reported, window.innerHeight || reported) : window.innerHeight;
  document.documentElement.style.setProperty('--tg-viewport', `${h}px`);
}

function applySafeArea() {
  if (!tg) return;
  const sa = tg.safeAreaInset        || {};
  const cs = tg.contentSafeAreaInset || {};
  // Bot API 7.10+ — sa/cs aniq qiymatlar beradi.
  // Eski versiyalarda fullscreen rejimda Telegram tugmalari taxminan 80px joy oladi.
  const fromApi = (sa.top || 0) + (cs.top || 0);
  const top = fromApi || (tg.isFullscreen ? 88 : 0);
  // iOS fullscreen'da API bottom 0 qaytarsa ham home-indicator (~34px) zonasi bor —
  // dock shu zonada qolsa 1-tap system gesture himoyasiga yutiladi.
  const rawBottom = (sa.bottom || 0) + (cs.bottom || 0);
  const bottom = rawBottom || (tg.isFullscreen && tg.platform === 'ios' ? 34 : 0);
  document.documentElement.style.setProperty('--tg-safe-top',    `${top}px`);
  document.documentElement.style.setProperty('--tg-safe-bottom', `${bottom}px`);
}

function applyTheme() {
  if (!tg) return;
  const p = tg.themeParams || {};
  const root = document.documentElement;
  const colorScheme = tg.colorScheme || 'dark';
  root.setAttribute('data-theme', colorScheme);
  if (p.bg_color)            root.style.setProperty('--tg-bg', p.bg_color);
  if (p.secondary_bg_color)  root.style.setProperty('--tg-bg-2', p.secondary_bg_color);
  if (p.text_color)          root.style.setProperty('--tg-text', p.text_color);
  if (p.hint_color)          root.style.setProperty('--tg-hint', p.hint_color);
  if (p.button_color)        root.style.setProperty('--tg-btn', p.button_color);
  if (p.header_bg_color)     tg.setHeaderColor?.(p.header_bg_color);
  else                       tg.setHeaderColor?.(colorScheme === 'dark' ? '#050a0c' : '#f4f7f6');
  if (p.bg_color)            tg.setBackgroundColor?.(p.bg_color);
  else                       tg.setBackgroundColor?.(colorScheme === 'dark' ? '#050a0c' : '#f4f7f6');
}

/* ── Haptic feedback ───────────────────────────────────────────────── */
export const haptic = {
  impact:    (style = 'light') => tg?.HapticFeedback?.impactOccurred?.(style),
  selection: ()                 => tg?.HapticFeedback?.selectionChanged?.(),
  success:   ()                 => tg?.HapticFeedback?.notificationOccurred?.('success'),
  error:     ()                 => tg?.HapticFeedback?.notificationOccurred?.('error'),
  warning:   ()                 => tg?.HapticFeedback?.notificationOccurred?.('warning'),
};

/* ── BackButton control ─────────────────────────────────────────────── */
export function useBackButton(handler) {
  useEffect(() => {
    if (!tg?.BackButton) return;
    if (handler) {
      tg.BackButton.show();
      tg.BackButton.onClick(handler);
      return () => {
        tg.BackButton.offClick(handler);
        tg.BackButton.hide();
      };
    } else {
      tg.BackButton.hide();
    }
  }, [handler]);
}

/* ── MainButton control ─────────────────────────────────────────────── */
export function useMainButton({ text, visible = true, onClick, disabled = false, color, textColor }) {
  useEffect(() => {
    if (!tg?.MainButton || !visible) { tg?.MainButton?.hide(); return; }
    tg.MainButton.setText(text);
    if (color)     tg.MainButton.color = color;
    if (textColor) tg.MainButton.textColor = textColor;
    disabled ? tg.MainButton.disable() : tg.MainButton.enable();
    tg.MainButton.show();
    if (onClick) {
      tg.MainButton.onClick(onClick);
      return () => { tg.MainButton.offClick(onClick); tg.MainButton.hide(); };
    }
    return () => tg.MainButton.hide();
  }, [text, visible, onClick, disabled, color, textColor]);
}

/* ── Hook: live state ───────────────────────────────────────────────── */
export function useTelegram() {
  const [state, setState] = useState(() => ({
    isTelegram, user: tg?.initDataUnsafe?.user, scheme: tg?.colorScheme,
    platform: tg?.platform, viewportHeight: tg?.viewportHeight,
  }));

  useEffect(() => {
    if (!tg) return;
    const upd = () => setState(s => ({ ...s,
      scheme: tg.colorScheme,
      viewportHeight: tg.viewportStableHeight || tg.viewportHeight,
    }));
    tg.onEvent('themeChanged', upd);
    tg.onEvent('viewportChanged', upd);
    return () => {
      tg.offEvent('themeChanged', upd);
      tg.offEvent('viewportChanged', upd);
    };
  }, []);

  return state;
}
