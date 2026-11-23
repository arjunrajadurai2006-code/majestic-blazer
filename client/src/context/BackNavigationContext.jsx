import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BackNavigationContext = createContext(null);
const ROUTE_STACK_KEY = 'mb_route_stack';

/**
 * Maps any pathname to its most sensible fallback route
 * when direct access, refresh, or no valid in-app history exists.
 */
export function getFallbackRoute(pathname) {
  if (!pathname || pathname === '/') return '/';

  // Product Details -> Shop Blazers
  if (pathname.startsWith('/products/')) {
    return '/shop';
  }

  // Checkout -> Cart
  if (pathname.startsWith('/checkout')) {
    return '/cart';
  }

  // Cart -> Shop Blazers
  if (pathname === '/cart') {
    return '/shop';
  }

  // Wishlist -> Shop Blazers
  if (pathname === '/wishlist') {
    return '/shop';
  }

  // Order Details / History -> Profile
  if (pathname.startsWith('/orders')) {
    return '/profile';
  }

  // Profile -> Home
  if (pathname === '/profile') {
    return '/';
  }

  // Product listing (Shop) -> Home
  if (pathname === '/shop') {
    return '/';
  }

  // Contact & Legal pages -> Home
  if (
    pathname === '/contact' ||
    pathname === '/privacy-policy' ||
    pathname === '/terms-and-conditions'
  ) {
    return '/';
  }

  // Auth pages -> Home
  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/account-access' ||
    pathname === '/access'
  ) {
    return '/';
  }

  return '/';
}

/**
 * Verifies whether genuine, useful in-app navigation history exists in the current session.
 * Evaluates Performance Navigation Timing (reload check), React Router state,
 * History index, and active session route stack.
 */
export function checkHasInAppHistory(location) {
  if (typeof window === 'undefined') return false;

  // 1. Detect if the current page was loaded via browser reload / refresh
  try {
    const navEntries = window.performance?.getEntriesByType?.('navigation');
    if (navEntries && navEntries.length > 0) {
      if (navEntries[0].type === 'reload') {
        return false;
      }
    } else if (window.performance?.navigation?.type === 1) {
      return false;
    }
  } catch {}

  // 2. React Router key check: 'default' indicates first load or direct external entry
  if (!location || location.key === 'default') {
    return false;
  }

  // 3. Browser history index check
  const stateIdx = window.history?.state?.idx;
  if (typeof stateIdx !== 'number' || stateIdx <= 0) {
    return false;
  }

  // 4. Session route stack check
  try {
    const raw = sessionStorage.getItem(ROUTE_STACK_KEY);
    const stack = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(stack) || stack.length < 2) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

export function BackNavigationProvider({ children }) {
  const [config, setConfig] = useState({
    fallback: null,
    customHandler: null,
    hidden: false,
    label: 'Back',
  });

  const location = useLocation();

  // Track session route transitions for reliable back navigation
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ROUTE_STACK_KEY);
      const stack = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(stack)) {
        sessionStorage.setItem(ROUTE_STACK_KEY, JSON.stringify([location.pathname]));
      } else {
        if (stack[stack.length - 1] !== location.pathname) {
          stack.push(location.pathname);
          // Keep the stack bounded to last 20 routes
          if (stack.length > 20) stack.shift();
          sessionStorage.setItem(ROUTE_STACK_KEY, JSON.stringify(stack));
        }
      }
    } catch {}
  }, [location.pathname]);

  // Reset page-level overrides on location change unless page sets new ones
  useEffect(() => {
    setConfig({
      fallback: null,
      customHandler: null,
      hidden: false,
      label: 'Back',
    });
  }, [location.pathname]);

  return (
    <BackNavigationContext.Provider value={{ config, setConfig }}>
      {children}
    </BackNavigationContext.Provider>
  );
}

export function useBackNavigationContext() {
  const ctx = useContext(BackNavigationContext);
  if (!ctx) {
    return {
      config: { fallback: null, customHandler: null, hidden: false, label: 'Back' },
      setConfig: () => {},
    };
  }
  return ctx;
}

/**
 * Hook for pages to configure custom back navigation behavior.
 * 
 * @param {Object} options
 * @param {string} [options.fallback] - Sensible fallback route override
 * @param {Function} [options.customHandler] - Custom click handler (e.g. multi-step forms)
 * @param {boolean} [options.hidden] - Hide back button on this view
 * @param {string} [options.label] - Custom label (defaults to 'Back')
 */
export function useBackNavigation({ fallback, customHandler, hidden, label } = {}) {
  const { setConfig } = useBackNavigationContext();

  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      fallback: fallback !== undefined ? fallback : prev.fallback,
      customHandler: customHandler !== undefined ? customHandler : prev.customHandler,
      hidden: hidden !== undefined ? hidden : prev.hidden,
      label: label !== undefined ? label : prev.label,
    }));

    return () => {
      setConfig({
        fallback: null,
        customHandler: null,
        hidden: false,
        label: 'Back',
      });
    };
  }, [fallback, customHandler, hidden, label, setConfig]);
}
