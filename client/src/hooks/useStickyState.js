import { useCallback, useRef, useState } from 'react';

/**
 * Sahifa unmount bo'lganda ham tanlangan UI holatini (tab, filter) eslab qoladi.
 * Loyihada router yo'q — detail sahifa ochilganda ro'yxat sahifasi butunlay
 * unmount bo'ladi, shuning uchun oddiy useState orqaga qaytishda default tabga
 * qaytib qolardi. Bu hook holatni modul darajasidagi store'da saqlaydi.
 */
const store = new Map();

export function useStickyState(key, initial) {
  const read = () => (store.has(key) ? store.get(key) : initial);

  const [value, setValue] = useState(read);
  const keyRef = useRef(key);

  // Key o'zgarsa (masalan boshqa guruh ochildi) — o'sha key'ning holatiga o'tamiz
  if (keyRef.current !== key) {
    keyRef.current = key;
    setValue(read());
  }

  const set = useCallback(next => {
    setValue(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      store.set(key, resolved);
      return resolved;
    });
  }, [key]);

  return [value, set];
}

export function clearStickyState() {
  store.clear();
}
