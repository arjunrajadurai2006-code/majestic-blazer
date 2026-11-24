/**
 * Majestic Blazer — Unified Domain Router
 * Cloudflare Worker (Module Syntax)
 *
 * Exposes customer storefront, admin portal, and backend API under majesticblazer.com:
 *   - /api/*     -> Railway Express backend
 *   - /uploads/* -> Railway backend static image storage
 *   - /admin     -> 301 Redirect to /admin/
 *   - /admin/*   -> Admin Vercel deployment
 *   - /*         -> Customer Vercel deployment
 *
 * Features:
 *   - Full streaming request and response bodies (duplex: 'half' for multipart uploads & PDFs)
 *   - Manual redirect handling with Location header rewrites
 *   - Set-Cookie Domain attribute stripping for unified apex cookie binding
 *   - Origin Host header rewriting and X-Forwarded-* injection
 *   - Structured error handling (JSON for API, branded HTML for UI)
 */

export const DEFAULT_CONFIG = {
  CUSTOMER_ORIGIN: 'https://majestic-blazer.vercel.app',
  ADMIN_ORIGIN: 'https://majestic-blazer-miup.vercel.app',
  BACKEND_ORIGIN: 'https://majestic-blazer-production.up.railway.app',
};

/**
 * Determine the destination origin and path for an incoming request URL
 */
export function routeRequest(url, config = DEFAULT_CONFIG) {
  const pathname = url.pathname;

  // 1. Backend API: /api and /api/*
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    const origin = config.BACKEND_ORIGIN || DEFAULT_CONFIG.BACKEND_ORIGIN;
    return {
      type: 'proxy',
      targetUrl: `${origin.replace(/\/$/, '')}${pathname}${url.search}`,
      origin,
      service: 'backend-api',
    };
  }

  // 2. Uploaded Media Assets: /uploads and /uploads/*
  if (pathname === '/uploads' || pathname.startsWith('/uploads/')) {
    const origin = config.BACKEND_ORIGIN || DEFAULT_CONFIG.BACKEND_ORIGIN;
    return {
      type: 'proxy',
      targetUrl: `${origin.replace(/\/$/, '')}${pathname}${url.search}`,
      origin,
      service: 'backend-media',
    };
  }

  // 3. Admin Root without trailing slash: /admin -> redirect to /admin/
  if (pathname === '/admin') {
    return {
      type: 'redirect',
      status: 301,
      targetUrl: `${url.origin}/admin/${url.search}`,
      service: 'admin-redirect',
    };
  }

  // 4. Admin Portal: /admin/*
  if (pathname.startsWith('/admin/')) {
    const origin = config.ADMIN_ORIGIN || DEFAULT_CONFIG.ADMIN_ORIGIN;
    return {
      type: 'proxy',
      targetUrl: `${origin.replace(/\/$/, '')}${pathname}${url.search}`,
      origin,
      service: 'admin-portal',
    };
  }

  // 5. Customer Storefront SPA Catch-All: /*
  const origin = config.CUSTOMER_ORIGIN || DEFAULT_CONFIG.CUSTOMER_ORIGIN;
  return {
    type: 'proxy',
    targetUrl: `${origin.replace(/\/$/, '')}${pathname}${url.search}`,
    origin,
    service: 'customer-storefront',
  };
}

/**
 * Rewrite redirect Location headers so that upstream origin URLs are mapped back to public host
 */
export function rewriteLocationHeader(locationValue, publicUrl, config = DEFAULT_CONFIG) {
  if (!locationValue) return locationValue;

  const customerHost = new URL(config.CUSTOMER_ORIGIN || DEFAULT_CONFIG.CUSTOMER_ORIGIN).host;
  const adminHost = new URL(config.ADMIN_ORIGIN || DEFAULT_CONFIG.ADMIN_ORIGIN).host;
  const backendHost = new URL(config.BACKEND_ORIGIN || DEFAULT_CONFIG.BACKEND_ORIGIN).host;

  try {
    const parsedLoc = new URL(locationValue, publicUrl.origin);

    // If redirect points to Admin origin, ensure /admin prefix is preserved
    if (parsedLoc.host === adminHost) {
      let path = parsedLoc.pathname;
      if (!path.startsWith('/admin')) {
        path = `/admin${path.startsWith('/') ? path : `/${path}`}`;
      }
      return `${publicUrl.origin}${path}${parsedLoc.search}${parsedLoc.hash}`;
    }

    // If redirect points to Customer origin
    if (parsedLoc.host === customerHost) {
      return `${publicUrl.origin}${parsedLoc.pathname}${parsedLoc.search}${parsedLoc.hash}`;
    }

    // If redirect points to Backend origin
    if (parsedLoc.host === backendHost) {
      return `${publicUrl.origin}${parsedLoc.pathname}${parsedLoc.search}${parsedLoc.hash}`;
    }

    return locationValue;
  } catch {
    return locationValue;
  }
}

/**
 * Sanitize Set-Cookie header to strip origin-specific Domain restrictions
 */
export function sanitizeSetCookie(cookieStr) {
  if (!cookieStr) return cookieStr;
  // Strip Domain=... directives so the cookie binds cleanly to the public domain
  return cookieStr.replace(/;\s*Domain=[^;]+/gi, '');
}

/**
 * Generate branded luxury HTML error page for UI proxy failures
 */
function generateHtmlError(status, message, service) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Service Unavailable — MAJESTIC BLAZER</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #0D0D0D;
      color: #E6E6E6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      max-width: 480px;
      margin: 1.5rem;
      padding: 2.5rem 2rem;
      background: #141414;
      border: 1px solid #282828;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
    }
    .brand {
      letter-spacing: 0.25em;
      font-size: 0.85rem;
      color: #C5A059;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 500;
      color: #FFFFFF;
      margin: 0 0 1rem 0;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 0.95rem;
      line-height: 1.6;
      color: #A0A0A0;
      margin-bottom: 2rem;
    }
    .retry-btn {
      display: inline-block;
      padding: 0.75rem 1.75rem;
      background: #C5A059;
      color: #0D0D0D;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.85rem;
      letter-spacing: 0.05em;
      border-radius: 4px;
      transition: background 0.2s ease;
    }
    .retry-btn:hover { background: #D8B26E; }
    .footer {
      margin-top: 2rem;
      font-size: 0.75rem;
      color: #555555;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">Majestic Blazer Atelier</div>
    <h1>Connection Interrupted</h1>
    <p>${message || 'Our bespoke service is temporarily undergoing scheduled maintenance. Please refresh in a few moments.'}</p>
    <a href="javascript:location.reload()" class="retry-btn">RELOAD PAGE</a>
    <div class="footer">Status: HTTP ${status} • Routing: ${service}</div>
  </div>
</body>
</html>`;
}

export default {
  async fetch(request, env = {}, ctx) {
    const url = new URL(request.url);
    const config = {
      CUSTOMER_ORIGIN: env.CUSTOMER_ORIGIN || DEFAULT_CONFIG.CUSTOMER_ORIGIN,
      ADMIN_ORIGIN: env.ADMIN_ORIGIN || DEFAULT_CONFIG.ADMIN_ORIGIN,
      BACKEND_ORIGIN: env.BACKEND_ORIGIN || DEFAULT_CONFIG.BACKEND_ORIGIN,
    };

    const route = routeRequest(url, config);

    // Handle 301 Redirect for /admin -> /admin/
    if (route.type === 'redirect') {
      return Response.redirect(route.targetUrl, route.status);
    }

    // Build upstream request headers
    const upstreamHeaders = new Headers(request.headers);
    const targetUrlObj = new URL(route.targetUrl);
    // Use host (including port for local dev, e.g. localhost:5000)
    const targetHost = targetUrlObj.host;

    upstreamHeaders.set('Host', targetHost);
    upstreamHeaders.set('X-Forwarded-Host', url.host);
    upstreamHeaders.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

    const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('x-real-ip');
    if (clientIp) {
      const existingXff = upstreamHeaders.get('X-Forwarded-For');
      upstreamHeaders.set('X-Forwarded-For', existingXff ? `${existingXff}, ${clientIp}` : clientIp);
    }

    // Support WebSocket upgrades (e.g. Vite HMR hot module replacement)
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return fetch(route.targetUrl, {
        method: request.method,
        headers: upstreamHeaders,
      });
    }

    // Prepare fetch options with streaming body support
    const hasBody = !['GET', 'HEAD'].includes(request.method);
    const fetchOptions = {
      method: request.method,
      headers: upstreamHeaders,
      redirect: 'manual', // Intercept upstream redirects for Location header rewriting
    };

    if (hasBody) {
      fetchOptions.body = request.body;
      fetchOptions.duplex = 'half';
    }

    try {
      const originResponse = await fetch(route.targetUrl, fetchOptions);

      // Copy response headers and apply necessary rewrites
      const responseHeaders = new Headers(originResponse.headers);

      // 1. Rewrite Location header on redirects
      if ([301, 302, 303, 307, 308].includes(originResponse.status)) {
        const rawLoc = originResponse.headers.get('Location');
        if (rawLoc) {
          const rewrittenLoc = rewriteLocationHeader(rawLoc, url, config);
          responseHeaders.set('Location', rewrittenLoc);
        }
      }

      // 2. Sanitize Set-Cookie headers
      if (typeof responseHeaders.getSetCookie === 'function') {
        const cookies = responseHeaders.getSetCookie();
        if (cookies && cookies.length > 0) {
          responseHeaders.delete('Set-Cookie');
          for (const c of cookies) {
            responseHeaders.append('Set-Cookie', sanitizeSetCookie(c));
          }
        }
      } else {
        const singleCookie = responseHeaders.get('Set-Cookie');
        if (singleCookie) {
          responseHeaders.set('Set-Cookie', sanitizeSetCookie(singleCookie));
        }
      }

      // 3. Security headers
      responseHeaders.set('X-Content-Type-Options', 'nosniff');

      return new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      // Graceful error handling for origin unavailability
      if (route.service === 'backend-api') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Bad Gateway',
            message: 'The Majestic Blazer backend service is currently unreachable. Please try again shortly.',
            details: err.message,
          }),
          {
            status: 502,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        );
      }

      return new Response(
        generateHtmlError(502, 'The requested application service is currently unreachable. Our team has been notified.', route.service),
        {
          status: 502,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }
  },
};
