/**
 * Local Unified Routing Verification Test Suite
 * Tests Cloudflare Worker routing under local development configuration:
 *   - Customer: http://localhost:5173
 *   - Admin:    http://localhost:5174
 *   - Backend:  http://localhost:5000
 *   - Router:   http://localhost:8787
 */

import http from 'node:http';
import assert from 'node:assert/strict';
import worker, { routeRequest, rewriteLocationHeader, sanitizeSetCookie } from '../cloudflare-worker/worker.js';
import { corsOptions } from '../server/src/app.js';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

const LOCAL_CONFIG = {
  CUSTOMER_ORIGIN: 'http://localhost:5173',
  ADMIN_ORIGIN: 'http://localhost:5174',
  BACKEND_ORIGIN: 'http://localhost:5000',
};

console.log('\n================================================================');
console.log('MAJESTIC BLAZER: LOCAL UNIFIED ROUTING VERIFICATION');
console.log('================================================================\n');

console.log('--- Category 1: Local Route URL Mapping ---');

runTest('1.1. /api and /api/* route to local backend (port 5000)', () => {
  const url1 = new URL('http://localhost:8787/api/health');
  const route1 = routeRequest(url1, LOCAL_CONFIG);
  assert.equal(route1.type, 'proxy');
  assert.equal(route1.targetUrl, 'http://localhost:5000/api/health');

  const url2 = new URL('http://localhost:8787/api/products?category=blazers');
  const route2 = routeRequest(url2, LOCAL_CONFIG);
  assert.equal(route2.targetUrl, 'http://localhost:5000/api/products?category=blazers');
});

runTest('1.2. /uploads/* routes to local backend media handler (port 5000)', () => {
  const url = new URL('http://localhost:8787/uploads/blazer-navy-gold.jpg');
  const route = routeRequest(url, LOCAL_CONFIG);
  assert.equal(route.type, 'proxy');
  assert.equal(route.targetUrl, 'http://localhost:5000/uploads/blazer-navy-gold.jpg');
});

runTest('1.3. /admin (no slash) returns 301 redirect to http://localhost:8787/admin/', () => {
  const url = new URL('http://localhost:8787/admin');
  const route = routeRequest(url, LOCAL_CONFIG);
  assert.equal(route.type, 'redirect');
  assert.equal(route.status, 301);
  assert.equal(route.targetUrl, 'http://localhost:8787/admin/');
});

runTest('1.4. /admin?tab=orders preserves query parameters during 301 redirect', () => {
  const url = new URL('http://localhost:8787/admin?tab=orders');
  const route = routeRequest(url, LOCAL_CONFIG);
  assert.equal(route.type, 'redirect');
  assert.equal(route.status, 301);
  assert.equal(route.targetUrl, 'http://localhost:8787/admin/?tab=orders');
});

runTest('1.5. /admin/* routes to local admin portal (port 5174)', () => {
  const url1 = new URL('http://localhost:8787/admin/');
  const route1 = routeRequest(url1, LOCAL_CONFIG);
  assert.equal(route1.type, 'proxy');
  assert.equal(route1.targetUrl, 'http://localhost:5174/admin/');

  const url2 = new URL('http://localhost:8787/admin/orders?status=confirmed');
  const route2 = routeRequest(url2, LOCAL_CONFIG);
  assert.equal(route2.targetUrl, 'http://localhost:5174/admin/orders?status=confirmed');

  const url3 = new URL('http://localhost:8787/admin/assets/vendor-abc.js');
  const route3 = routeRequest(url3, LOCAL_CONFIG);
  assert.equal(route3.targetUrl, 'http://localhost:5174/admin/assets/vendor-abc.js');
});

runTest('1.6. Storefront paths (/*) route to local customer frontend (port 5173)', () => {
  const url1 = new URL('http://localhost:8787/');
  const route1 = routeRequest(url1, LOCAL_CONFIG);
  assert.equal(route1.type, 'proxy');
  assert.equal(route1.targetUrl, 'http://localhost:5173/');

  const url2 = new URL('http://localhost:8787/shop');
  const route2 = routeRequest(url2, LOCAL_CONFIG);
  assert.equal(route2.targetUrl, 'http://localhost:5173/shop');

  const url3 = new URL('http://localhost:8787/assets/index.js');
  const route3 = routeRequest(url3, LOCAL_CONFIG);
  assert.equal(route3.targetUrl, 'http://localhost:5173/assets/index.js');
});

console.log('\n--- Category 2: Local Redirect Location Rewriting ---');

runTest('2.1. Admin port redirect (localhost:5174) rewritten to router URL (localhost:8787/admin)', () => {
  const publicUrl = new URL('http://localhost:8787/admin');
  const upstream = 'http://localhost:5174/login';
  const rewritten = rewriteLocationHeader(upstream, publicUrl, LOCAL_CONFIG);
  assert.equal(rewritten, 'http://localhost:8787/admin/login');
});

runTest('2.2. Customer port redirect (localhost:5173) rewritten to router URL (localhost:8787)', () => {
  const publicUrl = new URL('http://localhost:8787/checkout');
  const upstream = 'http://localhost:5173/login?redirect=%2Fcheckout';
  const rewritten = rewriteLocationHeader(upstream, publicUrl, LOCAL_CONFIG);
  assert.equal(rewritten, 'http://localhost:8787/login?redirect=%2Fcheckout');
});

console.log('\n--- Category 3: Local Dev CORS Allowlist ---');

await runAsyncTest('3.1. Express server allows http://localhost:8787 in development', async () => {
  await new Promise((resolve, reject) => {
    corsOptions.origin('http://localhost:8787', (err, allow) => {
      if (err || !allow) reject(new Error('Rejected http://localhost:8787'));
      else resolve();
    });
  });
});

await runAsyncTest('3.2. Express server allows http://127.0.0.1:8787 in development', async () => {
  await new Promise((resolve, reject) => {
    corsOptions.origin('http://127.0.0.1:8787', (err, allow) => {
      if (err || !allow) reject(new Error('Rejected http://127.0.0.1:8787'));
      else resolve();
    });
  });
});

console.log('\n--- Category 4: End-to-End Worker Proxy Simulation ---');

// Setup ephemeral mock HTTP servers for Customer, Admin, and Backend
const customerServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<html><body>Customer Storefront [Path: ${req.url}]</body></html>`);
});

const adminServer = http.createServer((req, res) => {
  if (req.url === '/admin/redirect-test') {
    const port = adminServer.address().port;
    res.writeHead(302, { Location: `http://localhost:${port}/admin/dashboard` });
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<html><body>Admin Console [Path: ${req.url}]</body></html>`);
});

const backendServer = http.createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', service: 'local-backend', host: req.headers.host }));
  }
  if (req.url === '/uploads/test.jpg') {
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    return res.end('JPEG_MOCK_BYTES');
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

await new Promise((r) => customerServer.listen(0, r));
await new Promise((r) => adminServer.listen(0, r));
await new Promise((r) => backendServer.listen(0, r));

const custPort = customerServer.address().port;
const admPort = adminServer.address().port;
const backPort = backendServer.address().port;

const DYNAMIC_LOCAL_CONFIG = {
  CUSTOMER_ORIGIN: `http://localhost:${custPort}`,
  ADMIN_ORIGIN: `http://localhost:${admPort}`,
  BACKEND_ORIGIN: `http://localhost:${backPort}`,
};

await runAsyncTest('4.1. Worker proxies API request to local backend and receives JSON', async () => {
  const req = new Request('http://localhost:8787/api/health', {
    method: 'GET',
    headers: { 'User-Agent': 'Local-Test' },
  });
  const res = await worker.fetch(req, DYNAMIC_LOCAL_CONFIG);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.service, 'local-backend');
});

await runAsyncTest('4.2. Worker proxies media upload request to local backend', async () => {
  const req = new Request('http://localhost:8787/uploads/test.jpg', { method: 'GET' });
  const res = await worker.fetch(req, DYNAMIC_LOCAL_CONFIG);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'image/jpeg');
  const body = await res.text();
  assert.equal(body, 'JPEG_MOCK_BYTES');
});

await runAsyncTest('4.3. Worker returns 301 for /admin to /admin/', async () => {
  const req = new Request('http://localhost:8787/admin', { method: 'GET' });
  const res = await worker.fetch(req, DYNAMIC_LOCAL_CONFIG);
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('Location'), 'http://localhost:8787/admin/');
});

await runAsyncTest('4.4. Worker proxies /admin/ to local admin server', async () => {
  const req = new Request('http://localhost:8787/admin/', { method: 'GET' });
  const res = await worker.fetch(req, DYNAMIC_LOCAL_CONFIG);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('Admin Console'));
});

await runAsyncTest('4.5. Worker rewrites upstream admin redirects back to router origin', async () => {
  const req = new Request('http://localhost:8787/admin/redirect-test', { method: 'GET' });
  const res = await worker.fetch(req, DYNAMIC_LOCAL_CONFIG);
  assert.equal(res.status, 302);
  const loc = res.headers.get('Location');
  assert.equal(loc, 'http://localhost:8787/admin/dashboard');
});

await runAsyncTest('4.6. Worker proxies / to local customer server', async () => {
  const req = new Request('http://localhost:8787/', { method: 'GET' });
  const res = await worker.fetch(req, DYNAMIC_LOCAL_CONFIG);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('Customer Storefront'));
});

await runAsyncTest('4.7. Worker handles backend failure with structured 502 Bad Gateway JSON', async () => {
  const brokenConfig = {
    ...DYNAMIC_LOCAL_CONFIG,
    BACKEND_ORIGIN: 'http://localhost:59999', // Port with no server
  };
  const req = new Request('http://localhost:8787/api/users', { method: 'GET' });
  const res = await worker.fetch(req, brokenConfig);
  assert.equal(res.status, 502);
  const data = await res.json();
  assert.equal(data.error, 'Bad Gateway');
});

customerServer.close();
adminServer.close();
backendServer.close();

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);
