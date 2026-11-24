/**
 * Automated Verification Script for Customer <-> Admin Routing Integration
 *
 * Verifies:
 * 1. Centralized URL resolution (defaults, env overrides, trailing slash sanitization).
 * 2. Complete absence of obsolete URLs ('majestic-blazer-admin.vercel.app') in active client & admin code.
 * 3. Correct cross-deployment links in AccountAccess, AuthForm, AdminHeader, AdminLayout, and Login.
 * 4. Token isolation ('mb_token' in client vs 'mb_admin_token' in admin).
 * 5. Vercel SPA rewrites in client/vercel.json and admin/vercel.json.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';

const ROOT_DIR = process.cwd();

console.log('====================================================');
console.log('MAJESTIC BLAZER: CUSTOMER <-> ADMIN ROUTING TEST SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------
// 1. Verify client and admin url config files
// -----------------------------------------------------------------
runTest('client/src/config/urls.js exists and exports ADMIN_APP_URL', () => {
  const file = path.join(ROOT_DIR, 'client', 'src', 'config', 'urls.js');
  assert.ok(fs.existsSync(file), 'urls.js must exist in client/src/config');
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(content.includes('export const ADMIN_APP_URL'), 'Must export ADMIN_APP_URL');
  assert.ok(content.includes('majestic-blazer-miup.vercel.app'), 'Must target majestic-blazer-miup.vercel.app as default admin URL');
  assert.ok(content.includes('VITE_ADMIN_APP_URL'), 'Must check VITE_ADMIN_APP_URL');
  assert.ok(content.includes('VITE_ADMIN_URL'), 'Must check VITE_ADMIN_URL');
});

runTest('admin/src/config/urls.js exists and exports CUSTOMER_APP_URL', () => {
  const file = path.join(ROOT_DIR, 'admin', 'src', 'config', 'urls.js');
  assert.ok(fs.existsSync(file), 'urls.js must exist in admin/src/config');
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(content.includes('export const CUSTOMER_APP_URL'), 'Must export CUSTOMER_APP_URL');
  assert.ok(content.includes('majestic-blazer.vercel.app'), 'Must target majestic-blazer.vercel.app as default customer URL');
  assert.ok(content.includes('VITE_CUSTOMER_APP_URL'), 'Must check VITE_CUSTOMER_APP_URL');
  assert.ok(content.includes('VITE_STOREFRONT_URL'), 'Must check VITE_STOREFRONT_URL');
});

// -----------------------------------------------------------------
// 2. Scan active code for obsolete domain
// -----------------------------------------------------------------
runTest('Zero obsolete domain references in client/src and admin/src', () => {
  const obsoleteDomain = 'majestic-blazer-admin.vercel.app';
  const dirsToScan = [
    path.join(ROOT_DIR, 'client', 'src'),
    path.join(ROOT_DIR, 'admin', 'src')
  ];

  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.json') || file.endsWith('.css')) {
        const text = fs.readFileSync(fullPath, 'utf8');
        assert.ok(!text.includes(obsoleteDomain), `Found obsolete domain ${obsoleteDomain} in ${fullPath}`);
      }
    }
  }

  dirsToScan.forEach(scanDir);
});

// -----------------------------------------------------------------
// 3. Verify AccountAccess.jsx
// -----------------------------------------------------------------
runTest('AccountAccess.jsx uses ADMIN_APP_URL', () => {
  const file = path.join(ROOT_DIR, 'client', 'src', 'pages', 'AccountAccess.jsx');
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(content.includes("import { ADMIN_APP_URL } from '../config/urls'"), 'Must import ADMIN_APP_URL');
  assert.ok(content.includes('const adminLoginUrl = ADMIN_APP_URL'), 'Must assign adminLoginUrl to ADMIN_APP_URL');
  assert.ok(content.includes('href={adminLoginUrl}'), 'Admin sign-in button must point to adminLoginUrl');
  assert.ok(content.includes('to="/login"'), 'Customer sign-in button must link to customer login');
});

// -----------------------------------------------------------------
// 4. Verify AuthForm.jsx
// -----------------------------------------------------------------
runTest('AuthForm.jsx uses centralized ADMIN_APP_URL with secure handoff code', () => {
  const file = path.join(ROOT_DIR, 'client', 'src', 'components', 'common', 'AuthForm.jsx');
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(content.includes("import { ADMIN_APP_URL } from '../../config/urls'"), 'Must import ADMIN_APP_URL');
  assert.ok(content.includes('const adminUrl = ADMIN_APP_URL'), 'Must assign adminUrl = ADMIN_APP_URL');
  assert.ok(content.includes('ADMIN_APP_URL}/?code='), 'Admin redirect must pass single-use handoff code to ADMIN_APP_URL');
  assert.ok(!content.includes('ADMIN_APP_URL}/?token='), 'Admin redirect must NOT expose reusable token in URL');
});

// -----------------------------------------------------------------
// 5. Verify AdminHeader.jsx
// -----------------------------------------------------------------
runTest('AdminHeader.jsx uses CUSTOMER_APP_URL for View Boutique', () => {
  const file = path.join(ROOT_DIR, 'admin', 'src', 'components', 'AdminHeader.jsx');
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(content.includes("import { CUSTOMER_APP_URL } from '../config/urls'"), 'Must import CUSTOMER_APP_URL');
  assert.ok(content.includes('const storefrontUrl = CUSTOMER_APP_URL'), 'Must assign storefrontUrl to CUSTOMER_APP_URL');
  assert.ok(!content.includes("? 'http://localhost:5173' : '/'"), 'Must not fallback to "/" in production');
});

// -----------------------------------------------------------------
// 6. Verify AdminLayout.jsx
// -----------------------------------------------------------------
runTest('AdminLayout.jsx links logo to / and handles sign out cleanly', () => {
  const file = path.join(ROOT_DIR, 'admin', 'src', 'components', 'AdminLayout.jsx');
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(content.includes('<Link to="/" title="Atelier Dashboard"'), 'Logo must be wrapped in Link to "/"');
  assert.ok(content.includes("navigate('/login'"), 'Sign out must navigate to /login');
  assert.ok(content.includes('if (!admin) return <Navigate to="/login" replace />'), 'Protected guard must redirect unauthenticated admins to /login');
});

// -----------------------------------------------------------------
// 7. Verify admin/src/pages/Login.jsx
// -----------------------------------------------------------------
runTest('admin/src/pages/Login.jsx uses CUSTOMER_APP_URL for customer & demo redirection', () => {
  const file = path.join(ROOT_DIR, 'admin', 'src', 'pages', 'Login.jsx');
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(content.includes("import { CUSTOMER_APP_URL } from '../config/urls'"), 'Must import CUSTOMER_APP_URL');
  assert.ok(content.includes('const storefrontUrl = CUSTOMER_APP_URL'), 'Must assign storefrontUrl to CUSTOMER_APP_URL');
  assert.ok(content.includes("${storefrontUrl.replace(/\\/$/, '')}/?code="), 'Must redirect customer to storefrontUrl with single-use handoff code');
  assert.ok(!content.includes("${storefrontUrl.replace(/\\/$/, '')}/?token="), 'Must NOT redirect customer with reusable token');
});

// -----------------------------------------------------------------
// 8. Verify admin/src/App.jsx 404 handling
// -----------------------------------------------------------------
runTest('admin/src/App.jsx contains NotFound route for invalid paths', () => {
  const file = path.join(ROOT_DIR, 'admin', 'src', 'App.jsx');
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(content.includes('<Route path="*" element={<NotFound />} />'), 'App.jsx must route * to <NotFound />');
});

// -----------------------------------------------------------------
// 9. Verify Vercel SPA rewrites
// -----------------------------------------------------------------
runTest('client/vercel.json and admin/vercel.json contain correct SPA rewrites', () => {
  const clientVercel = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'client', 'vercel.json'), 'utf8'));
  const adminVercel = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'admin', 'vercel.json'), 'utf8'));

  assert.ok(Array.isArray(clientVercel.rewrites), 'client/vercel.json must have rewrites array');
  assert.strictEqual(clientVercel.rewrites[0].source, '/(.*)');
  assert.strictEqual(clientVercel.rewrites[0].destination, '/index.html');

  assert.ok(Array.isArray(adminVercel.rewrites), 'admin/vercel.json must have rewrites array');
  assert.ok(adminVercel.rewrites.some(r => r.source === '/(.*)' && r.destination === '/index.html'), 'admin/vercel.json must include SPA fallback rewrite');
  assert.ok(adminVercel.rewrites.some(r => r.source === '/admin/assets/(.*)' && r.destination === '/assets/$1'), 'admin/vercel.json must include /admin/assets rewrite for base path');
  assert.ok(adminVercel.rewrites.some(r => r.source === '/admin/(.*)' && r.destination === '/index.html'), 'admin/vercel.json must include /admin/(.*) rewrite for base path');
});

// -----------------------------------------------------------------
// 10. Verify Token Storage Key Separation
// -----------------------------------------------------------------
runTest('Client uses mb_token and Admin uses mb_admin_token', () => {
  const clientApi = fs.readFileSync(path.join(ROOT_DIR, 'client', 'src', 'services', 'api.js'), 'utf8');
  const adminApi = fs.readFileSync(path.join(ROOT_DIR, 'admin', 'src', 'services', 'api.js'), 'utf8');

  assert.ok(clientApi.includes("const TOKEN_KEY = 'mb_token'"), 'Client must use mb_token');
  assert.ok(adminApi.includes("const TOKEN_KEY = 'mb_admin_token'"), 'Admin must use mb_admin_token');
});

// -----------------------------------------------------------------
// 11. Verify .env.example files
// -----------------------------------------------------------------
runTest('.env.example files document modern variables with fallbacks', () => {
  const clientEnv = fs.readFileSync(path.join(ROOT_DIR, 'client', '.env.example'), 'utf8');
  const adminEnv = fs.readFileSync(path.join(ROOT_DIR, 'admin', '.env.example'), 'utf8');

  assert.ok(clientEnv.includes('VITE_ADMIN_APP_URL=https://majestic-blazer-miup.vercel.app'), 'client .env.example must specify VITE_ADMIN_APP_URL');
  assert.ok(clientEnv.includes('VITE_ADMIN_URL='), 'client .env.example must note legacy fallback');
  assert.ok(adminEnv.includes('VITE_CUSTOMER_APP_URL=https://majestic-blazer.vercel.app'), 'admin .env.example must specify VITE_CUSTOMER_APP_URL');
  assert.ok(adminEnv.includes('VITE_STOREFRONT_URL='), 'admin .env.example must note legacy fallback');
});

console.log('\n----------------------------------------------------');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed.`);
console.log('----------------------------------------------------');

if (passedTests === totalTests) {
  console.log('ALL ROUTING INTEGRATION VERIFICATIONS PASSED SUCCESSFULLY!');
} else {
  process.exit(1);
}
