import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }

    api('/auth/me')
      .then((res) => {
        if (res.data?.user) {
          setUser(res.data.user);
        } else {
          tokenStore.clear();
          setUser(null);
        }
      })
      .catch(() => {
        tokenStore.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));

    const handleAuthExpired = () => {
      tokenStore.clear();
      setUser(null);
    };

    const handleStorageChange = (e) => {
      if (e.key === 'mb_token' && !e.newValue) {
        setUser(null);
      }
    };

    window.addEventListener('mb_auth_expired', handleAuthExpired);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('mb_auth_expired', handleAuthExpired);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const value = useMemo(() => {
    const authenticate = async (path, body) => {
      const res = await api(path, { method: 'POST', body, auth: false });
      tokenStore.set(res.data.token);
      setUser(res.data.user);
      return res.data.user;
    };
    return {
      user,
      loading,
      login: (body) => authenticate('/auth/login', body),
      register: (body) => authenticate('/auth/register', body),
      logout: async () => {
        try {
          await api('/auth/logout', { method: 'POST' });
        } catch {
          // Proceed with client cleanup
        } finally {
          tokenStore.clear();
          setUser(null);
        }
      },
    };
  }, [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
