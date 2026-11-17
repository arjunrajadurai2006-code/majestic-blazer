import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BackNavigationContext = createContext(null);

/**
 * Maps any pathname to its most sensible fallback route
 * when direct access, refresh, or no in-app history exists.
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

  // Order Details / History / Rental Bookings -> Profile or Home
  if (pathname.startsWith('/orders') || pathname.startsWith('/rental-bookings')) {
    return '/profile';
  }

  // Profile -> Home
  if (pathname === '/profile') {
    return '/';
  }

  // Product listings (Shop / Rent) -> Home
  if (pathname === '/shop' || pathname === '/rent') {
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

export function BackNavigationProvider({ children }) {
  const [config, setConfig] = useState({
    fallback: null,
    customHandler: null,
    hidden: false,
    label: 'Back',
  });

  const location = useLocation();

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
      // Clean up override on unmount
      setConfig({
        fallback: null,
        customHandler: null,
        hidden: false,
        label: 'Back',
      });
    };
  }, [fallback, customHandler, hidden, label, setConfig]);
}
