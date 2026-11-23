/**
 * testPhase34RouterCompat.js
 * Comprehensive verification of Phase 3.4 React Router Future Compatibility Cleanup.
 * Validates:
 * 1. Customer application console: Zero React Router future warnings
 * 2. Admin application console: Zero React Router future warnings
 * 3. Customer navigation flows:
 *    - Homepage (/)
 *    - Product detail navigation (/products/:slug)
 *    - Nested route & browser refresh on nested route
 *    - Unknown-route handling (/unknown-luxury-slug -> 404 Page Not Found)
 *    - Protected route customer redirect (/orders -> /login)
 *    - Customer login & logout
 * 4. Admin navigation flows:
 *    - Admin login redirect (/ -> /login when unauthenticated)
 *    - Admin authenticated navigation (/products, /orders, /settings)
 *    - Admin logout redirect
 *    - Browser refresh on nested admin routes
 */

import puppeteer from 'puppeteer-core';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/db.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CLIENT_URL = 'http://localhost:5173';
const ADMIN_URL = 'http://localhost:5174';

async function runRouterCompatTests() {
  console.log('============================================================');
  console.log('MAJESTIC BLAZER - PHASE 3.4 REACT ROUTER COMPATIBILITY TESTS');
  console.log('============================================================\n');

  let passCount = 0;
  let failCount = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      if (details) console.log(`         ${details}`);
      passCount++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      if (details) console.error(`         ${details}`);
      failCount++;
    }
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    // 1. Fetch test users from DB
    const { rows: custRows } = await pool.query(
      "SELECT id, email, role, full_name FROM users WHERE role = 'customer' LIMIT 1"
    );
    const testCustomer = custRows[0] || { id: 2, email: 'customer@majesticblazer.com', role: 'customer' };

    const { rows: adminRows } = await pool.query(
      "SELECT id, email, role, full_name FROM users WHERE role = 'admin' LIMIT 1"
    );
    const testAdmin = adminRows[0] || { id: 1, email: 'admin@majesticblazer.com', role: 'admin' };

    // Fetch an existing product slug
    const { rows: prodRows } = await pool.query(
      "SELECT slug, name FROM products WHERE is_active = true LIMIT 1"
    );
    const testProduct = prodRows[0] || { slug: 'ascot-sand-tan-linen-blazer', name: 'Ascot Sand Tan Linen Blazer' };

    console.log('--- 1. CUSTOMER APPLICATION ROUTING & WARNING CHECK ---');
    const clientPage = await browser.newPage();
    await clientPage.setViewport({ width: 1280, height: 900 });

    const clientConsoleWarnings = [];
    const clientRouterFutureWarnings = [];

    clientPage.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'warning' || text.toLowerCase().includes('warning')) {
        clientConsoleWarnings.push(text);
      }
      if (text.includes('React Router Future Flag Warning') || text.includes('v7_startTransition') || text.includes('v7_relativeSplatPath')) {
        clientRouterFutureWarnings.push(text);
      }
    });

    // 1.1 Homepage Navigation
    await clientPage.goto(CLIENT_URL, { waitUntil: 'networkidle0' });
    await clientPage.waitForSelector('body');
    assert(clientPage.url() === `${CLIENT_URL}/`, 'Homepage renders at base URL');

    // Check for React Router warnings on initial load
    assert(
      clientRouterFutureWarnings.length === 0,
      'No React Router future-compatibility warnings emitted on customer homepage',
      clientRouterFutureWarnings.length > 0 ? `Warnings captured: ${clientRouterFutureWarnings.join('; ')}` : 'Clean console'
    );

    // 1.2 Product Detail Navigation
    const productUrl = `${CLIENT_URL}/products/${testProduct.slug}`;
    await clientPage.goto(productUrl, { waitUntil: 'networkidle0' });
    const productTitle = await clientPage.$eval('h1', (el) => el.innerText).catch(() => '');
    assert(
      productTitle.length > 0,
      'Product details route navigated and rendered successfully',
      `Product: "${productTitle}"`
    );

    // 1.3 Browser Refresh on Nested Route
    await clientPage.reload({ waitUntil: 'networkidle0' });
    const refreshedTitle = await clientPage.$eval('h1', (el) => el.innerText).catch(() => '');
    assert(
      refreshedTitle === productTitle,
      'Browser refresh on nested route preserves state and renders without 404 or errors'
    );

    // 1.4 Unknown Route Handling
    await clientPage.goto(`${CLIENT_URL}/nonexistent-route-for-testing-404`, { waitUntil: 'networkidle0' });
    const notFoundText = await clientPage.evaluate(() => document.body.innerText);
    assert(
      notFoundText.includes('Page not found') || notFoundText.includes('404'),
      'Unknown route is caught by splat route and renders 404 Not Found'
    );

    // 1.5 Protected Route Redirect for Guest
    await clientPage.goto(`${CLIENT_URL}/orders`, { waitUntil: 'networkidle0' });
    assert(
      clientPage.url().includes('/login'),
      'Unauthenticated customer navigating to protected /orders is redirected to /login',
      `Current URL: ${clientPage.url()}`
    );

    // 1.6 Customer Login & Protected Route Access
    const custToken = jwt.sign(
      { sub: testCustomer.id, id: testCustomer.id, email: testCustomer.email, role: 'customer' },
      env.jwt.secret,
      { expiresIn: '2h' }
    );

    await clientPage.evaluate((token, user) => {
      localStorage.setItem('mb_token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, custToken, testCustomer);

    await clientPage.goto(`${CLIENT_URL}/orders`, { waitUntil: 'networkidle0' });
    assert(
      clientPage.url().includes('/orders'),
      'Authenticated customer navigates to protected /orders successfully',
      `URL: ${clientPage.url()}`
    );

    // 1.7 Customer Logout Flow
    await clientPage.evaluate(() => {
      localStorage.removeItem('mb_token');
      localStorage.removeItem('user');
    });
    await clientPage.goto(`${CLIENT_URL}/orders`, { waitUntil: 'networkidle0' });
    assert(
      clientPage.url().includes('/login'),
      'Customer after logout is redirected away from protected routes to /login'
    );

    // 1.8 Verify zero React Router warnings throughout customer navigation
    assert(
      clientRouterFutureWarnings.length === 0,
      'Zero React Router future warnings during entire customer journey',
      `Total future warnings: ${clientRouterFutureWarnings.length}`
    );

    await clientPage.close();

    console.log('\n--- 2. ADMIN APPLICATION ROUTING & WARNING CHECK ---');
    const adminPage = await browser.newPage();
    await adminPage.setViewport({ width: 1280, height: 900 });

    const adminConsoleWarnings = [];
    const adminRouterFutureWarnings = [];

    adminPage.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'warning' || text.toLowerCase().includes('warning')) {
        adminConsoleWarnings.push(text);
      }
      if (text.includes('React Router Future Flag Warning') || text.includes('v7_startTransition') || text.includes('v7_relativeSplatPath')) {
        adminRouterFutureWarnings.push(text);
      }
    });

    // 2.1 Unauthenticated Admin Redirect
    await adminPage.goto(ADMIN_URL, { waitUntil: 'networkidle0' });
    assert(
      adminPage.url().includes('/login'),
      'Unauthenticated admin navigating to / is redirected to /login',
      `Current URL: ${adminPage.url()}`
    );

    // Check for React Router warnings on admin initial load
    assert(
      adminRouterFutureWarnings.length === 0,
      'No React Router future-compatibility warnings emitted on admin login page',
      adminRouterFutureWarnings.length > 0 ? `Warnings captured: ${adminRouterFutureWarnings.join('; ')}` : 'Clean console'
    );

    // 2.2 Authenticated Admin Navigation via Demo Admin Login
    await adminPage.goto(`${ADMIN_URL}/login`, { waitUntil: 'networkidle0' });
    const demoBtn = await adminPage.$('button[class*="demoActionBtn"]');
    if (demoBtn) {
      await demoBtn.click();
      await adminPage.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    } else {
      // Fallback: direct token set
      const adminToken = jwt.sign(
        { sub: testAdmin.id, id: testAdmin.id, email: testAdmin.email, role: 'admin' },
        env.jwt.secret,
        { expiresIn: '2h' }
      );
      await adminPage.evaluate((token) => {
        localStorage.setItem('mb_admin_token', token);
      }, adminToken);
      await adminPage.goto(ADMIN_URL, { waitUntil: 'networkidle0' });
    }

    assert(
      adminPage.url() === `${ADMIN_URL}/` || adminPage.url() === `${ADMIN_URL}`,
      'Admin logged in and redirected to dashboard root (/)',
      `Current URL: ${adminPage.url()}`
    );

    // 2.3 Nested Admin Routes Navigation
    const adminProductsUrl = `${ADMIN_URL}/products`;
    await adminPage.goto(adminProductsUrl, { waitUntil: 'networkidle0' });
    assert(
      adminPage.url().includes('/products'),
      'Admin nested route /products loaded successfully'
    );

    // 2.4 Browser Refresh on Nested Admin Route
    await adminPage.reload({ waitUntil: 'networkidle0' });
    assert(
      adminPage.url().includes('/products'),
      'Admin browser refresh on /products preserves route and view'
    );

    // 2.5 Admin Settings Route Navigation
    await adminPage.goto(`${ADMIN_URL}/settings`, { waitUntil: 'networkidle0' });
    assert(
      adminPage.url().includes('/settings'),
      'Admin route /settings loaded successfully'
    );

    // 2.6 Admin Logout Flow
    await adminPage.evaluate(() => {
      localStorage.removeItem('mb_admin_token');
    });
    await adminPage.goto(`${ADMIN_URL}/products`, { waitUntil: 'networkidle0' });
    assert(
      adminPage.url().includes('/login'),
      'Admin after logout is redirected away from management views to /login'
    );

    // 2.7 Verify zero React Router warnings throughout admin navigation
    assert(
      adminRouterFutureWarnings.length === 0,
      'Zero React Router future warnings during entire admin session',
      `Total future warnings: ${adminRouterFutureWarnings.length}`
    );

    await adminPage.close();

  } catch (err) {
    console.error('Test execution exception:', err);
    failCount++;
  } finally {
    await browser.close();
    await pool.end();
  }

  console.log('\n============================================================');
  console.log(`SUMMARY: ${passCount} passed, ${failCount} failed`);
  console.log('============================================================');

  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL PHASE 3.4 REACT ROUTER COMPATIBILITY TESTS PASSED!');
    process.exit(0);
  }
}

runRouterCompatTests();
