import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  useEffect(() => {
    if (!tokenStore.get()) return;
    api('/auth/me')
      .then((res) => (res.data.user.role === 'admin' ? setAdmin(res.data.user) : tokenStore.clear()))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({
    admin,
    loading,
    login: async (body) => {
      const res = await api('/auth/admin/login', { method: 'POST', body, auth: false });
      tokenStore.set(res.data.token);
      setAdmin(res.data.user);
    },
    logout: () => { tokenStore.clear(); setAdmin(null); },
  }), [admin, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
