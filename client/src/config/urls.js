/**
 * Cross-Deployment URL Configuration for Majestic Blazer Customer Storefront
 *
 * Production Admin Portal: https://majestic-blazer-miup.vercel.app
 * Fallback precedence:
 *   1. VITE_ADMIN_APP_URL (Primary recommended variable)
 *   2. VITE_ADMIN_URL (Legacy variable for backward compatibility)
 *   3. Local dev host check (http://localhost:5174 in development)
 *   4. Production default domain (https://majestic-blazer-miup.vercel.app)
 */
export const ADMIN_APP_URL = (() => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'majesticblazer.com' || host === 'www.majesticblazer.com' || host.includes('vercel.app')) {
      return `${window.location.origin}/admin`;
    }
    // When testing local unified router (e.g. localhost:8787), route admin under /admin
    if ((host === 'localhost' || host === '127.0.0.1') && window.location.port === '8787') {
      return `${window.location.origin}/admin`;
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:5174';
    }
  }
  return 'https://majestic-blazer-miup.vercel.app';
})();
