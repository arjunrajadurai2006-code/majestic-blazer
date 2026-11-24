import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../services/api';

const AuthContext = createContext(null);

const hasHandoffParams = () => {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get('code') || params.get('token'));
  } catch {
    return false;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()) || hasHandoffParams());

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      // 1. Check if single-use handoff code or legacy token was provided in URL
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get('code');
        const urlToken = params.get('token');

        if (urlCode) {
          // Immediately strip code from URL to prevent back-button or history reuse
          const cleanUrl = window.location.pathname + (window.location.hash || '');
          window.history.replaceState({}, document.title, cleanUrl);

          try {
            setLoading(true);
            const res = await api('/auth/handoff/exchange', {
              method: 'POST',
              body: { code: urlCode, targetApp: 'customer' },
              auth: false,
            });
            if (res.data?.token) {
              tokenStore.set(res.data.token);
              if (isMounted) {
                setUser(res.data.user);
                setLoading(false);
              }
              return;
            }
          } catch (err) {
            console.error('Customer handoff code exchange failed:', err.message);
            tokenStore.clear();
            if (isMounted) {
              setUser(null);
              setLoading(false);
            }
            return;
          }
        } else if (urlToken) {
          tokenStore.set(urlToken);
          const cleanUrl = window.location.pathname + (window.location.hash || '');
          window.history.replaceState({}, document.title, cleanUrl);
        }
      }

      if (!tokenStore.get()) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const res = await api('/auth/me');
        if (isMounted) {
          if (res.data?.user) {
            setUser(res.data.user);
          } else {
            tokenStore.clear();
            setUser(null);
          }
        }
      } catch {
        if (isMounted) {
          tokenStore.clear();
          setUser(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initAuth();

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
      isMounted = false;
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
      demoCustomerLogin: async () => {
        const res = await api('/auth/demo-customer', { method: 'POST', auth: false });
        tokenStore.set(res.data.token);
        setUser(res.data.user);
        return res.data.user;
      },
      adminLogin: async (body) => {
        const res = await api('/auth/admin/login', { method: 'POST', body, auth: false });
        return res.data;
      },
      demoAdminLogin: async () => {
        const res = await api('/auth/demo-admin?handoff=true', { method: 'POST', auth: false });
        return res.data;
      },
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
