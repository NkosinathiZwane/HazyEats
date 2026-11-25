import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me').then((d) => setUser(d.user)).catch(() => {}).finally(() => setLoading(false));
    const expired = () => setUser(null);
    window.addEventListener('he:unauthorized', expired);
    return () => window.removeEventListener('he:unauthorized', expired);
  }, []);

  const value = useMemo(() => ({
    user, loading,
    login: async (email, password) => { const d = await api.post('/auth/login', { email, password }); setUser(d.user); return d.user; },
    signup: async (data) => { const d = await api.post('/auth/signup', data); setUser(d.user); return d.user; },
    google: async (credential, role) => { const d = await api.post('/auth/google', { credential, role }); setUser(d.user); return d.user; },
    logout: async () => { await api.post('/auth/logout').catch(() => {}); setUser(null); },
    refresh: async () => { const d = await api.get('/auth/me'); setUser(d.user); },
  }), [user, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
