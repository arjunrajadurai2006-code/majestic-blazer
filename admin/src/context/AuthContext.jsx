import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  useEffect(() => {
    // Check if token was provided via query param from unified login redirect
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        tokenStore.set(urlToken);
        const cleanUrl = window.location.pathname + (window.location.hash || '');
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }

    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }

    api('/auth/me')
      .then((res) => {
        if (res.data?.user?.role === 'admin') {
          setAdmin(res.data.user);
        } else {
          tokenStore.clear();
          setAdmin(null);
        }
      })
      .catch(() => {
        tokenStore.clear();
        setAdmin(null);
      })
      .finally(() => setLoading(false));

    const handleAuthExpired = () => {
      tokenStore.clear();
      setAdmin(null);
    };

    const handleStorageChange = (e) => {
      if (e.key === 'mb_admin_token' && !e.newValue) {
        setAdmin(null);
      }
    };

    window.addEventListener('mb_auth_expired', handleAuthExpired);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('mb_auth_expired', handleAuthExpired);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const value = useMemo(() => ({
    admin,
    loading,
    login: async (body) => {
      const res = await api('/auth/admin/login', { method: 'POST', body, auth: false });
      tokenStore.set(res.data.token);
      setAdmin(res.data.user);
      return res.data.user;
    },
    demoAdminLogin: async () => {
      const res = await api('/auth/demo-admin', { method: 'POST', auth: false });
      tokenStore.set(res.data.token);
      setAdmin(res.data.user);
      return res.data.user;
    },
    customerLogin: async (body) => {
      const res = await api('/auth/login', { method: 'POST', body, auth: false });
      localStorage.setItem('mb_token', res.data.token);
      return res.data;
    },
    demoCustomerLogin: async () => {
      const res = await api('/auth/demo-customer', { method: 'POST', auth: false });
      localStorage.setItem('mb_token', res.data.token);
      return res.data;
    },
    logout: async () => {
      try {
        await api('/auth/logout', { method: 'POST' });
      } catch {
        // Proceed with client cleanup
      } finally {
        tokenStore.clear();
        setAdmin(null);
      }
    },
  }), [admin, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
