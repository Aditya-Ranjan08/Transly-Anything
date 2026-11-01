import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [sessionCheck, setSessionCheck] = useState(0);

  useEffect(() => {
    let active = true;
    api.get('/auth/me', { timeout: 60000 })
      .then(({ data }) => {
        if (!active) return;
        setUser(data.user);
        setSessionError('');
      })
      .catch((error) => {
        if (!active) return;
        if (error.response?.status === 401) {
          setUser(null);
          setSessionError('');
          return;
        }
        setSessionError('We could not verify your session. Check your connection and try again.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionCheck]);

  const value = useMemo(() => ({
    user,
    loading,
    sessionError,
    retrySession() {
      setLoading(true);
      setSessionError('');
      setSessionCheck((check) => check + 1);
    },
    syncUser(updatedUser) {
      setUser(updatedUser);
      setSessionError('');
    },
    async login(credentials) {
      const { data } = await api.post('/auth/login', credentials);
      setUser(data.user);
      setSessionError('');
      return data.user;
    },
    async register(details) {
      const { data } = await api.post('/auth/register', details);
      setUser(data.user);
      setSessionError('');
      return data.user;
    },
    async logout() {
      try { await api.post('/auth/logout'); }
      catch { /* The client still leaves the protected workspace if the API is unavailable. */ }
      finally {
        setUser(null);
        setSessionError('');
      }
    },
  }), [user, loading, sessionError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
