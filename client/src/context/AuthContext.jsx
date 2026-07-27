import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';
import { tg, isTelegram } from '../hooks/useTelegram.js';
import { clearStickyState } from '../hooks/useStickyState.js';

const AuthContext = createContext(null);

/**
 * Auth boot oqimi:
 *  1) Telegram WebApp ichida bo'lsak — initData (+ start_param/invite token)
 *     ni serverga yuboramiz. Status: active | pending | rejected | no-invite | error.
 *  2) Aks holda — localStorage'dagi token bo'lsa /auth/me chaqiramiz.
 *  3) Hech narsa — login formaga o'tamiz (status: 'guest').
 */
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [status,  setStatus]  = useState('booting'); // booting|active|pending|rejected|no-invite|guest|error
  const [error,   setError]   = useState(null);

  const bootTelegram = useCallback(async () => {
    if (!isTelegram || !tg?.initData) return false;
    setStatus('booting');
    setError(null);
    try {
      const urlInvite = new URLSearchParams(window.location.search).get('invite');
      const startParam = tg?.initDataUnsafe?.start_param || urlInvite || null;
      const res = await api.auth.telegram(tg.initData, startParam);
      if (res.token) localStorage.setItem('ep_token', res.token);
      setUser(res.data);
      setStatus(res.status === 'pending' ? 'pending' : 'active');
      return true;
    } catch (err) {
      const p = err.payload;
      if (p?.token) localStorage.setItem('ep_token', p.token);
      if (p?.data)  setUser(p.data);

      if (err.status === 202 || p?.status === 'pending') {
        setStatus('pending');
      } else if (err.status === 403 && p?.status === 'rejected') {
        setStatus('rejected');
      } else if (err.status === 403) {
        setStatus('no-invite');
        setError(err.message || 'Taklif link yaroqsiz');
      } else {
        setStatus('error');
        setError(err.message || 'Telegram auth failed');
      }
      return true;
    }
  }, []);

  const bootStored = useCallback(async () => {
    const token = localStorage.getItem('ep_token');
    if (!token) { setStatus('guest'); return; }
    try {
      const res = await api.auth.me();
      setUser(res.data);
      setStatus(res.data.status === 'active' ? 'active' :
                res.data.status === 'pending' ? 'pending' :
                res.data.status === 'rejected' ? 'rejected' : 'guest');
    } catch {
      localStorage.removeItem('ep_token');
      setUser(null);
      setStatus('guest');
    }
  }, []);

  useEffect(() => {
    (async () => {
      const handled = await bootTelegram();
      if (!handled) await bootStored();
    })();
  }, [bootTelegram, bootStored]);

  const login = async (email, password) => {
    const res = await api.auth.login(email, password);
    localStorage.setItem('ep_token', res.token);
    setUser(res.data);
    setStatus('active');
    return res.data;
  };

  const logout = () => {
    clearStickyState();
    localStorage.removeItem('ep_token');
    setUser(null);
    setStatus(isTelegram ? 'no-invite' : 'guest');
  };

  const refresh = async () => {
    if (isTelegram && tg?.initData) {
      await bootTelegram();
    } else {
      await bootStored();
    }
  };

  return (
    <AuthContext.Provider value={{
      user, status, error,
      loading: status === 'booting',
      login, logout, refresh, setUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
