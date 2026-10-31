import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/auth/me')
      .then(({ data }) => { if (active) setUser(data.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    syncUser(updatedUser) {
      setUser(updatedUser);
    },
    async login(credentials) {
      const { data } = await api.post('/auth/login', credentials);
      setUser(data.user);
      return data.user;
    },
    async register(details) {
      const { data } = await api.post('/auth/register', details);
      setUser(data.user);
      return data.user;
    },
    async logout() {
      try { await api.post('/auth/logout'); }
      catch { /* The client still leaves the protected workspace if the API is unavailable. */ }
      finally { setUser(null); }
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
