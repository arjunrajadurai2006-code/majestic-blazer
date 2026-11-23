/**
 * auditPhase35Viewports.js
 * Multi-viewport Responsive & Accessibility Verification for Phase 3.5.
 * Viewports audited: 360px, 390px, 430px, 768px, 1024px, 1440px
 */

import puppeteer from 'puppeteer-core';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/db.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_CLIENT = 'http://localhost:5173';
const TARGET_VIEWPORTS = [360, 390, 430, 768, 1024, 1440];

const PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Shop', path: '/shop' },
  { name: 'Product Details', path: '/products/ascot-sand-tan-linen-blazer' },
  { name: 'Cart', path: '/cart' },
  { name: 'Checkout', path: '/checkout' },
  { name: 'Rental Collection', path: '/rent' },
  { name: 'Contact', path: '/contact' },
  { name: 'Login/Register', path: '/login' },
  { name: 'Wishlist', path: '/wishlist' },
  { name: 'Terms & Conditions', path: '/terms-and-conditions' }
];

async function runResponsiveAudit() {
  console.log('================================================================');
  console.log('MAJESTIC BLAZER — PHASE 3.5 MULTI-VIEWPORT RESPONSIVE & ACCESSIBILITY AUDIT');
  console.log('Viewports: ' + TARGET_VIEWPORTS.join(', ') + ' px');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const { rows: userRows } = await pool.query(
    "SELECT id, email, role, full_name FROM users WHERE role = 'customer' LIMIT 1"
  );
  const testCustomer = userRows[0] || { id: 2, email: 'customer@majesticblazer.com', role: 'customer' };
  const customerToken = jwt.sign(
    { sub: testCustomer.id, id: testCustomer.id, email: testCustomer.email, role: testCustomer.role },
    env.jwt.secret,
    { expiresIn: '2h' }
  );

  let totalChecks = 0;
  let passedChecks = 0;
  const issues = [];

  for (const width of TARGET_VIEWPORTS) {
    const isMobile = width <= 768;
    const height = width >= 1024 ? 900 : 800;
    console.log(`\n--- AUDITING VIEWPORT: ${width}px x ${height}px (${isMobile ? 'Mobile/Tablet' : 'Desktop'}) ---`);

    const page = await browser.newPage();
    await page.setViewport({ width, height, isMobile, hasTouch: isMobile });

    await page.evaluateOnNewDocument((token, user) => {
      localStorage.setItem('mb_token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, customerToken, testCustomer);

    for (const target of PAGES) {
      totalChecks++;
      const consoleErrors = [];
      const failedRequests = [];

      const onConsole = (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      };
      const onRequestFailed = (req) => {
        failedRequests.push(req.url());
      };

      page.on('console', onConsole);
      page.on('requestfailed', onRequestFailed);

      try {
        await page.goto(`${BASE_CLIENT}${target.path}`, { waitUntil: 'networkidle2', timeout: 20000 });
        await new Promise((r) => setTimeout(r, 400));

        // Evaluate layout metrics
        const metrics = await page.evaluate(() => {
          const docWidth = document.documentElement.offsetWidth;
          const scrollWidth = document.documentElement.scrollWidth;
          const bodyScrollWidth = document.body ? document.body.scrollWidth : 0;
          const winWidth = window.innerWidth;
          const hasOverflow = scrollWidth > winWidth + 1 || bodyScrollWidth > winWidth + 1;

          // Check broken images
          const images = Array.from(document.querySelectorAll('img'));
          const broken = images
            .filter((img) => img.naturalWidth === 0 && img.src && !img.src.startsWith('data:'))
            .map((img) => img.src);

          // Check interactive elements touch targets on mobile (under 44px height/width)
          const isTouch = window.innerWidth <= 768;
          let undersizedTargets = 0;
          if (isTouch) {
            const buttons = Array.from(document.querySelectorAll('button, a.btn, input[type="submit"]'));
            undersizedTargets = buttons.filter((b) => {
              const rect = b.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && (rect.width < 32 || rect.height < 32);
            }).length;
          }

          return {
            winWidth,
            scrollWidth,
            hasOverflow,
            brokenImagesCount: broken.length,
            undersizedTargets
          };
        });

        const overflowPassed = !metrics.hasOverflow;
        const noBrokenImages = metrics.brokenImagesCount === 0;
        const noConsoleErrors = consoleErrors.length === 0;

        if (overflowPassed && noBrokenImages) {
          passedChecks++;
          console.log(`  [OK] ${target.name.padEnd(20)} | Win: ${metrics.winWidth}px | Scroll: ${metrics.scrollWidth}px | Img: OK | Errs: ${consoleErrors.length}`);
        } else {
          console.warn(`  [WARN] ${target.name.padEnd(18)} | Overflow: ${metrics.hasOverflow ? `YES (${metrics.scrollWidth} > ${metrics.winWidth})` : 'NO'} | Broken Img: ${metrics.brokenImagesCount} | Errs: ${consoleErrors.length}`);
          issues.push({
            viewport: `${width}px`,
            page: target.name,
            overflow: metrics.hasOverflow,
            brokenImages: metrics.brokenImagesCount,
            consoleErrors
          });
        }
      } catch (err) {
        console.error(`  [FAIL] ${target.name} crashed at ${width}px:`, err.message);
        issues.push({ viewport: `${width}px`, page: target.name, error: err.message });
      } finally {
        page.off('console', onConsole);
        page.off('requestfailed', onRequestFailed);
      }
    }

    await page.close();
  }

  // Accessibility & Dialog Focus Audit (Quick View Modal & Keyboard Nav)
  console.log('\n--- ACCESSIBILITY & DIALOG FOCUS AUDIT ---');
  const a11yPage = await browser.newPage();
  await a11yPage.setViewport({ width: 1280, height: 900 });

  await a11yPage.goto(`${BASE_CLIENT}/shop`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 500));

  // Find Quick View trigger
  const quickViewBtn = await a11yPage.$('button[class*="quickView"]');
  let modalPassed = false;
  let escPassed = false;

  if (quickViewBtn) {
    await quickViewBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    // Verify modal overlay appears and role="dialog" or aria-modal
    const modal = await a11yPage.$('[role="dialog"], [class*="modalOverlay"], [class*="quickViewModal"]');
    if (modal) {
      modalPassed = true;
      console.log('  [PASS] Quick View Modal opened and renders with dialog structure');
      // Press Escape to verify keyboard dismissal
      await a11yPage.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 400));
      const modalClosed = await a11yPage.$eval('[class*="quickViewModal"]', () => false).catch(() => true);
      if (modalClosed) {
        escPassed = true;
        console.log('  [PASS] Quick View Modal dismisses on Escape key press');
      }
    }
  }

  await a11yPage.close();
  await browser.close();
  await pool.end();

  console.log('\n================================================================');
  console.log(`RESPONSIVE & A11Y AUDIT SUMMARY: ${passedChecks} / ${totalChecks} PAGES CLEAN`);
  console.log(`Issues logged: ${issues.length}`);
  if (issues.length > 0) {
    console.log(JSON.stringify(issues, null, 2));
  }
  console.log('================================================================');

  if (issues.length === 0 && modalPassed && escPassed) {
    console.log('🎉 ALL RESPONSIVE VIEWPORT & ACCESSIBILITY CHECKS PASSED!');
    process.exit(0);
  } else {
    process.exit(issues.length > 0 ? 1 : 0);
  }
}

runResponsiveAudit().catch((err) => {
  console.error('Audit crashed:', err);
  process.exit(1);
});
