/**
 * Cross-Deployment URL Configuration for Majestic Blazer Atelier Admin Console
 *
 * Production Customer Storefront: https://majestic-blazer.vercel.app
 * Fallback precedence:
 *   1. VITE_CUSTOMER_APP_URL (Primary recommended variable)
 *   2. VITE_STOREFRONT_URL (Legacy variable for backward compatibility)
 *   3. Local dev host check (http://localhost:5173 in development)
 *   4. Production default domain (https://majestic-blazer.vercel.app)
 */
export const CUSTOMER_APP_URL = (() => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'majesticblazer.com' || host === 'www.majesticblazer.com') {
      return window.location.origin;
    }
    // When testing local unified router (e.g. localhost:8787), route customer to worker root
    if ((host === 'localhost' || host === '127.0.0.1') && window.location.port === '8787') {
      return window.location.origin;
    }
  }
  if (import.meta.env.VITE_CUSTOMER_APP_URL) return import.meta.env.VITE_CUSTOMER_APP_URL.replace(/\/$/, '');
  if (import.meta.env.VITE_STOREFRONT_URL) return import.meta.env.VITE_STOREFRONT_URL.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:5173';
    }
  }
  return 'https://majestic-blazer.vercel.app';
})();
