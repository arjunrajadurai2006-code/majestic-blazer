var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var DEFAULT_CONFIG = {
  CUSTOMER_ORIGIN: "https://majestic-blazer.vercel.app",
  ADMIN_ORIGIN: "https://majestic-blazer-miup.vercel.app",
  BACKEND_ORIGIN: "https://majestic-blazer-production.up.railway.app"
};
function routeRequest(url, config = DEFAULT_CONFIG) {
  const pathname = url.pathname;
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    const origin2 = config.BACKEND_ORIGIN || DEFAULT_CONFIG.BACKEND_ORIGIN;
    return {
      type: "proxy",
      targetUrl: `${origin2.replace(/\/$/, "")}${pathname}${url.search}`,
      origin: origin2,
      service: "backend-api"
    };
  }
  if (pathname === "/uploads" || pathname.startsWith("/uploads/")) {
    const origin2 = config.BACKEND_ORIGIN || DEFAULT_CONFIG.BACKEND_ORIGIN;
    return {
      type: "proxy",
      targetUrl: `${origin2.replace(/\/$/, "")}${pathname}${url.search}`,
      origin: origin2,
      service: "backend-media"
    };
  }
  if (pathname === "/admin") {
    return {
      type: "redirect",
      status: 301,
      targetUrl: `${url.origin}/admin/${url.search}`,
      service: "admin-redirect"
    };
  }
  if (pathname.startsWith("/admin/")) {
    const origin2 = config.ADMIN_ORIGIN || DEFAULT_CONFIG.ADMIN_ORIGIN;
    return {
      type: "proxy",
      targetUrl: `${origin2.replace(/\/$/, "")}${pathname}${url.search}`,
      origin: origin2,
      service: "admin-portal"
    };
  }
  const origin = config.CUSTOMER_ORIGIN || DEFAULT_CONFIG.CUSTOMER_ORIGIN;
  return {
    type: "proxy",
    targetUrl: `${origin.replace(/\/$/, "")}${pathname}${url.search}`,
    origin,
    service: "customer-storefront"
  };
}
__name(routeRequest, "routeRequest");
function rewriteLocationHeader(locationValue, publicUrl, config = DEFAULT_CONFIG) {
  if (!locationValue) return locationValue;
  const customerHost = new URL(config.CUSTOMER_ORIGIN || DEFAULT_CONFIG.CUSTOMER_ORIGIN).host;
  const adminHost = new URL(config.ADMIN_ORIGIN || DEFAULT_CONFIG.ADMIN_ORIGIN).host;
  const backendHost = new URL(config.BACKEND_ORIGIN || DEFAULT_CONFIG.BACKEND_ORIGIN).host;
  try {
    const parsedLoc = new URL(locationValue, publicUrl.origin);
    if (parsedLoc.host === adminHost) {
      let path = parsedLoc.pathname;
      if (!path.startsWith("/admin")) {
        path = `/admin${path.startsWith("/") ? path : `/${path}`}`;
      }
      return `${publicUrl.origin}${path}${parsedLoc.search}${parsedLoc.hash}`;
    }
    if (parsedLoc.host === customerHost) {
      return `${publicUrl.origin}${parsedLoc.pathname}${parsedLoc.search}${parsedLoc.hash}`;
    }
    if (parsedLoc.host === backendHost) {
      return `${publicUrl.origin}${parsedLoc.pathname}${parsedLoc.search}${parsedLoc.hash}`;
    }
    return locationValue;
  } catch {
    return locationValue;
  }
}
__name(rewriteLocationHeader, "rewriteLocationHeader");
function sanitizeSetCookie(cookieStr) {
  if (!cookieStr) return cookieStr;
  return cookieStr.replace(/;\s*Domain=[^;]+/gi, "");
}
__name(sanitizeSetCookie, "sanitizeSetCookie");
function generateHtmlError(status, message, service) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Service Unavailable \u2014 MAJESTIC BLAZER</title>
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
    <p>${message || "Our bespoke service is temporarily undergoing scheduled maintenance. Please refresh in a few moments."}</p>
    <a href="javascript:location.reload()" class="retry-btn">RELOAD PAGE</a>
    <div class="footer">Status: HTTP ${status} \u2022 Routing: ${service}</div>
  </div>
</body>
</html>`;
}
__name(generateHtmlError, "generateHtmlError");
var worker_default = {
  async fetch(request, env = {}, ctx) {
    const url = new URL(request.url);
    const config = {
      CUSTOMER_ORIGIN: env.CUSTOMER_ORIGIN || DEFAULT_CONFIG.CUSTOMER_ORIGIN,
      ADMIN_ORIGIN: env.ADMIN_ORIGIN || DEFAULT_CONFIG.ADMIN_ORIGIN,
      BACKEND_ORIGIN: env.BACKEND_ORIGIN || DEFAULT_CONFIG.BACKEND_ORIGIN
    };
    const route = routeRequest(url, config);
    if (route.type === "redirect") {
      return Response.redirect(route.targetUrl, route.status);
    }
    const upstreamHeaders = new Headers(request.headers);
    const targetUrlObj = new URL(route.targetUrl);
    const targetHost = targetUrlObj.host;
    upstreamHeaders.set("Host", targetHost);
    upstreamHeaders.set("X-Forwarded-Host", url.host);
    upstreamHeaders.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
    const clientIp = request.headers.get("CF-Connecting-IP") || request.headers.get("x-real-ip");
    if (clientIp) {
      const existingXff = upstreamHeaders.get("X-Forwarded-For");
      upstreamHeaders.set("X-Forwarded-For", existingXff ? `${existingXff}, ${clientIp}` : clientIp);
    }
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return fetch(route.targetUrl, {
        method: request.method,
        headers: upstreamHeaders
      });
    }
    const hasBody = !["GET", "HEAD"].includes(request.method);
    const fetchOptions = {
      method: request.method,
      headers: upstreamHeaders,
      redirect: "manual"
      // Intercept upstream redirects for Location header rewriting
    };
    if (hasBody) {
      fetchOptions.body = request.body;
      fetchOptions.duplex = "half";
    }
    try {
      const originResponse = await fetch(route.targetUrl, fetchOptions);
      const responseHeaders = new Headers(originResponse.headers);
      if ([301, 302, 303, 307, 308].includes(originResponse.status)) {
        const rawLoc = originResponse.headers.get("Location");
        if (rawLoc) {
          const rewrittenLoc = rewriteLocationHeader(rawLoc, url, config);
          responseHeaders.set("Location", rewrittenLoc);
        }
      }
      if (typeof responseHeaders.getSetCookie === "function") {
        const cookies = responseHeaders.getSetCookie();
        if (cookies && cookies.length > 0) {
          responseHeaders.delete("Set-Cookie");
          for (const c of cookies) {
            responseHeaders.append("Set-Cookie", sanitizeSetCookie(c));
          }
        }
      } else {
        const singleCookie = responseHeaders.get("Set-Cookie");
        if (singleCookie) {
          responseHeaders.set("Set-Cookie", sanitizeSetCookie(singleCookie));
        }
      }
      responseHeaders.set("X-Content-Type-Options", "nosniff");
      return new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: responseHeaders
      });
    } catch (err) {
      if (route.service === "backend-api") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Bad Gateway",
            message: "The Majestic Blazer backend service is currently unreachable. Please try again shortly.",
            details: err.message
          }),
          {
            status: 502,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store, no-cache, must-revalidate"
            }
          }
        );
      }
      return new Response(
        generateHtmlError(502, "The requested application service is currently unreachable. Our team has been notified.", route.service),
        {
          status: 502,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate"
          }
        }
      );
    }
  }
};

// ../../../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-OICTzk/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-OICTzk/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  DEFAULT_CONFIG,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default,
  rewriteLocationHeader,
  routeRequest,
  sanitizeSetCookie
};
//# sourceMappingURL=worker.js.map
