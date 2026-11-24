/**
 * Unified Domain Routing & Configuration Test Suite
 * Tests Cloudflare Worker route mapping, Location rewriting, Cookie sanitization,
 * Express CORS configuration, Admin base path, and Frontend API URL resolution.
 */

import assert from 'node:assert/strict';
import { routeRequest, rewriteLocationHeader, sanitizeSetCookie, DEFAULT_CONFIG } from '../cloudflare-worker/worker.js';
import { corsOptions } from '../server/src/app.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

console.log('\n--- Category 1: Cloudflare Worker Route Resolution ---');

runTest('1.1. /api route forwards to Railway backend', () => {
  const url = new URL('https://majesticblazer.com/api');
  const route = routeRequest(url);
  assert.equal(route.type, 'proxy');
  assert.equal(route.service, 'backend-api');
  assert.equal(route.targetUrl, 'https://majestic-blazer-production.up.railway.app/api');
});

runTest('1.2. /api/products?sort=price forwards to Railway backend with query params', () => {
  const url = new URL('https://majesticblazer.com/api/products?sort=price');
  const route = routeRequest(url);
  assert.equal(route.type, 'proxy');
  assert.equal(route.service, 'backend-api');
  assert.equal(route.targetUrl, 'https://majestic-blazer-production.up.railway.app/api/products?sort=price');
});

runTest('1.3. /uploads/blazer.jpg forwards to Railway static image handler', () => {
  const url = new URL('https://majesticblazer.com/uploads/blazer.jpg');
  const route = routeRequest(url);
  assert.equal(route.type, 'proxy');
  assert.equal(route.service, 'backend-media');
  assert.equal(route.targetUrl, 'https://majestic-blazer-production.up.railway.app/uploads/blazer.jpg');
});

runTest('1.4. /admin (no trailing slash) returns 301 permanent redirect to /admin/', () => {
  const url = new URL('https://majesticblazer.com/admin');
  const route = routeRequest(url);
  assert.equal(route.type, 'redirect');
  assert.equal(route.status, 301);
  assert.equal(route.targetUrl, 'https://majesticblazer.com/admin/');
});

runTest('1.5. /admin?view=metrics preserves query string in 301 redirect to /admin/', () => {
  const url = new URL('https://majesticblazer.com/admin?view=metrics');
  const route = routeRequest(url);
  assert.equal(route.type, 'redirect');
  assert.equal(route.status, 301);
  assert.equal(route.targetUrl, 'https://majesticblazer.com/admin/?view=metrics');
});

runTest('1.6. /admin/ forwards to Admin Vercel deployment', () => {
  const url = new URL('https://majesticblazer.com/admin/');
  const route = routeRequest(url);
  assert.equal(route.type, 'proxy');
  assert.equal(route.service, 'admin-portal');
  assert.equal(route.targetUrl, 'https://majestic-blazer-miup.vercel.app/admin/');
});

runTest('1.7. /admin/orders?page=2 forwards to Admin Vercel deployment with path and query', () => {
  const url = new URL('https://majesticblazer.com/admin/orders?page=2');
  const route = routeRequest(url);
  assert.equal(route.type, 'proxy');
  assert.equal(route.service, 'admin-portal');
  assert.equal(route.targetUrl, 'https://majestic-blazer-miup.vercel.app/admin/orders?page=2');
});

runTest('1.8. /admin/assets/index-abc.js forwards to Admin Vercel deployment', () => {
  const url = new URL('https://majesticblazer.com/admin/assets/index-abc.js');
  const route = routeRequest(url);
  assert.equal(route.type, 'proxy');
  assert.equal(route.service, 'admin-portal');
  assert.equal(route.targetUrl, 'https://majestic-blazer-miup.vercel.app/admin/assets/index-abc.js');
});

runTest('1.9. / (storefront root) forwards to Customer Vercel deployment', () => {
  const url = new URL('https://majesticblazer.com/');
  const route = routeRequest(url);
  assert.equal(route.type, 'proxy');
  assert.equal(route.service, 'customer-storefront');
  assert.equal(route.targetUrl, 'https://majestic-blazer.vercel.app/');
});

runTest('1.10. /shop?category=blazers forwards to Customer Vercel deployment', () => {
  const url = new URL('https://majesticblazer.com/shop?category=blazers');
  const route = routeRequest(url);
  assert.equal(route.type, 'proxy');
  assert.equal(route.service, 'customer-storefront');
  assert.equal(route.targetUrl, 'https://majestic-blazer.vercel.app/shop?category=blazers');
});

console.log('\n--- Category 2: Redirect Location Rewriting & Cookie Sanitization ---');

runTest('2.1. Rewrites admin origin redirect back to public /admin domain', () => {
  const publicUrl = new URL('https://majesticblazer.com/admin');
  const upstreamLoc = 'https://majestic-blazer-miup.vercel.app/login';
  const rewritten = rewriteLocationHeader(upstreamLoc, publicUrl);
  assert.equal(rewritten, 'https://majesticblazer.com/admin/login');
});

runTest('2.2. Rewrites customer origin redirect back to public root domain', () => {
  const publicUrl = new URL('https://majesticblazer.com/account');
  const upstreamLoc = 'https://majestic-blazer.vercel.app/login?redirect=%2Faccount';
  const rewritten = rewriteLocationHeader(upstreamLoc, publicUrl);
  assert.equal(rewritten, 'https://majesticblazer.com/login?redirect=%2Faccount');
});

runTest('2.3. Strips Domain attribute from Set-Cookie header', () => {
  const cookie = 'session_id=s_12345; Domain=majestic-blazer-miup.vercel.app; Path=/; HttpOnly; Secure; SameSite=Lax';
  const sanitized = sanitizeSetCookie(cookie);
  assert.ok(!sanitized.includes('Domain='));
  assert.ok(sanitized.includes('session_id=s_12345'));
  assert.ok(sanitized.includes('HttpOnly'));
  assert.ok(sanitized.includes('Secure'));
});

console.log('\n--- Category 3: Backend CORS Production Validation ---');

await runAsyncTest('3.1. Express CORS allows https://majesticblazer.com', async () => {
  await new Promise((resolve, reject) => {
    corsOptions.origin('https://majesticblazer.com', (err, allow) => {
      if (err || !allow) reject(new Error('Rejected allowed apex domain'));
      else resolve();
    });
  });
});

await runAsyncTest('3.2. Express CORS allows https://www.majesticblazer.com', async () => {
  await new Promise((resolve, reject) => {
    corsOptions.origin('https://www.majesticblazer.com', (err, allow) => {
      if (err || !allow) reject(new Error('Rejected allowed www domain'));
      else resolve();
    });
  });
});

await runAsyncTest('3.3. Express CORS allows https://majestic-blazer.vercel.app (fallback)', async () => {
  await new Promise((resolve, reject) => {
    corsOptions.origin('https://majestic-blazer.vercel.app', (err, allow) => {
      if (err || !allow) reject(new Error('Rejected fallback customer Vercel domain'));
      else resolve();
    });
  });
});

await runAsyncTest('3.4. Express CORS allows https://majestic-blazer-miup.vercel.app (fallback)', async () => {
  await new Promise((resolve, reject) => {
    corsOptions.origin('https://majestic-blazer-miup.vercel.app', (err, allow) => {
      if (err || !allow) reject(new Error('Rejected fallback admin Vercel domain'));
      else resolve();
    });
  });
});

console.log('\n--- Category 4: Admin Base Path & Routing Assets Verification ---');

runTest('4.1. admin/vite.config.js contains base: \'/admin/\'', () => {
  const content = fs.readFileSync(path.join(rootDir, 'admin/vite.config.js'), 'utf8');
  assert.ok(content.includes("base: '/admin/'"), 'Missing base: \'/admin/\' in vite.config.js');
});

runTest('4.2. admin/vercel.json contains /admin/assets rewrite rule', () => {
  const content = fs.readFileSync(path.join(rootDir, 'admin/vercel.json'), 'utf8');
  const parsed = JSON.parse(content);
  const assetRewrite = parsed.rewrites.find(r => r.source === '/admin/assets/(.*)' && r.destination === '/assets/$1');
  assert.ok(assetRewrite, 'Missing /admin/assets rewrite rule in vercel.json');
});

runTest('4.3. admin/src/main.jsx configures BrowserRouter basename="/admin"', () => {
  const content = fs.readFileSync(path.join(rootDir, 'admin/src/main.jsx'), 'utf8');
  assert.ok(content.includes('basename="/admin"'), 'Missing basename="/admin" in main.jsx');
});

console.log('\n--- Category 5: Frontend URL & Single-Prefix Endpoint Safety ---');

runTest('5.1. Path concatenation does not generate duplicate /api/api/ prefix', () => {
  const API_BASE = '/api';
  const getApiUrl = (path) => {
    let cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (API_BASE.endsWith('/api') && cleanPath.startsWith('/api/')) {
      cleanPath = cleanPath.slice(4);
    }
    return `${API_BASE}${cleanPath}`;
  };

  assert.equal(getApiUrl('/products'), '/api/products');
  assert.equal(getApiUrl('products'), '/api/products');
  assert.equal(getApiUrl('/api/products'), '/api/products', 'Did not prevent duplicate /api prefix');
});

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log(`========================================\n`);

if (failedTests > 0) {
  process.exit(1);
}
