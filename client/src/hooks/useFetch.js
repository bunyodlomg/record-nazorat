import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Universal fetch hook.
 *
 * useFetch(fn, deps)
 *   fn — async funksiya, Promise qaytaradi (api.* javobi shaklida)
 *   deps — fetch funksiyasini qayta yaratish dep'lari
 *
 * Qaytaradi: { data, loading, error, refetch }
 *
 * refetch(opts?) — qayta yuklash
 *   opts.silent === true bo'lsa loading state'ni o'zgartirmaydi (polling uchun).
 *   Birinchi yuklash doim "loud" — Spinner ko'rinadi.
 *   Keyingi silent refresh'da kontent eski ma'lumot bilan qoladi va flicker bo'lmaydi.
 */
export function useFetch(fn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const didInitial = useRef(false);

  const fetch = useCallback(async (opts = {}) => {
    const silent = !!opts.silent && didInitial.current;
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const res = await fn();
      setData(res?.data !== undefined ? res.data : res);
      if (silent) setError(null);
    } catch (err) {
      // silent rejimda eski xato bo'lsa ham yashirmaymiz, lekin yangi xatoni o'rnatmaymiz
      // (faqat birinchi yuklash xatosi UI da ko'rinadi)
      if (!silent) setError(err.message || 'Xatolik yuz berdi');
    } finally {
      if (!silent) setLoading(false);
      didInitial.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
