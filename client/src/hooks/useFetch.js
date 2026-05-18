import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Universal fetch hook + silent polling.
 *
 * useFetch(fn, deps)
 *   fn   — async funksiya, Promise qaytaradi
 *   deps — fetch funksiyasini qayta yaratish dep'lari
 *
 * refetch(opts?)
 *   opts.silent === true bo'lsa:
 *     - loading state o'zgarmaydi (Spinner ko'rinmaydi)
 *     - data mazmunan bir xil bo'lsa, setState chaqirilmaydi (re-render yo'q)
 *   Bu polling paytida cardlarning "miltillashi"ni butunlay yo'qotadi.
 */
export function useFetch(fn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const didInitial = useRef(false);
  const lastSig    = useRef(null); // oxirgi data JSON imzosi

  const fetch = useCallback(async (opts = {}) => {
    const silent = !!opts.silent && didInitial.current;
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const res = await fn();
      const newData = res?.data !== undefined ? res.data : res;

      // Mazmuniy o'zgarish bo'lmasa setState chaqirmaslik (re-render yo'q)
      let sig;
      try { sig = JSON.stringify(newData); }
      catch { sig = String(Date.now()); /* circular bo'lsa har gal yangilash */ }

      if (sig !== lastSig.current) {
        lastSig.current = sig;
        setData(newData);
      }
      if (silent) setError(null);
    } catch (err) {
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
