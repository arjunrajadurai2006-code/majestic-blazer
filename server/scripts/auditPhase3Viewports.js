import puppeteer from 'puppeteer-core';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const VIEWPORTS = [320, 375, 390, 430, 768, 1024, 1440, 1920];
const BASE_CLIENT = 'http://localhost:5173';

const PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Shop', path: '/shop' },
  { name: 'Product Details', path: '/products/sovereign-charcoal-grey-glen-check-executive-blazer' },
  { name: 'Cart', path: '/cart' },
  { name: 'Checkout', path: '/checkout' },
  { name: 'Order Details', path: '/orders/26' },
  { name: 'Rent Collection', path: '/rent' },
  { name: 'Contact', path: '/contact' },
  { name: 'Auth/Login', path: '/login' },
];

async function runResponsiveAudit() {
  console.log('================================================================');
  console.log('MAJESTIC BLAZER — PHASE 3 MULTI-VIEWPORT RESPONSIVE AUDIT');
  console.log('Testing Viewports: ' + VIEWPORTS.join(', ') + ' px');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const testToken = jwt.sign({ sub: 20, role: 'customer' }, env.jwt.secret, { expiresIn: '1h' });

  let totalAudits = 0;
  let passedAudits = 0;
  let overflowIssues = [];
  let brokenImagesTotal = [];
  let consoleErrorsTotal = [];

  for (const width of VIEWPORTS) {
    const isMobile = width <= 768;
    const height = width >= 1024 ? 900 : 844;
    console.log(`\n--- AUDITING VIEWPORT: ${width}px x ${height}px (${isMobile ? 'Mobile/Tablet' : 'Desktop'}) ---`);

    const page = await browser.newPage();
    await page.setViewport({ width, height, isMobile, hasTouch: isMobile });

    // Set auth token in localStorage before navigation
    await page.evaluateOnNewDocument((token) => {
      localStorage.setItem('mb_token', token);
    }, testToken);

    for (const target of PAGES) {
      totalAudits++;
      const consoleErrors = [];
      const failedRequests = [];

      const onConsole = (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      };
      const onRequestFailed = (req) => {
        failedRequests.push(req.url());
      };

      page.on('console', onConsole);
      page.on('requestfailed', onRequestFailed);

      try {
        await page.goto(`${BASE_CLIENT}${target.path}`, { waitUntil: 'networkidle2', timeout: 25000 });
        await new Promise((r) => setTimeout(r, 600));

        // Scroll to trigger lazy images
        await page.evaluate(async () => {
          window.scrollTo(0, document.body.scrollHeight / 2);
          await new Promise((r) => setTimeout(r, 200));
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise((r) => setTimeout(r, 200));
          window.scrollTo(0, 0);
        });
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
          const broken = images.filter((img) => img.naturalWidth === 0 && img.src && !img.src.startsWith('data:')).map((img) => img.src);

          return {
            winWidth,
            scrollWidth,
            hasOverflow,
            brokenImages: broken,
          };
        });

        const overflowPassed = !metrics.hasOverflow;
        const noBrokenImages = metrics.brokenImages.length === 0;
        const noFatalErrors = consoleErrors.length === 0;

        if (overflowPassed && noBrokenImages) {
          passedAudits++;
          console.log(`  [OK] ${target.name.padEnd(16)} | Win: ${metrics.winWidth}px | Scroll: ${metrics.scrollWidth}px | Images: OK | Errs: ${consoleErrors.length}`);
        } else {
          console.error(`  [WARN] ${target.name.padEnd(14)} | Overflow: ${metrics.hasOverflow ? 'YES (' + metrics.scrollWidth + ' > ' + metrics.winWidth + ')' : 'NO'} | Broken Img: ${metrics.brokenImages.length} | Errs: ${consoleErrors.length}`);
          if (metrics.hasOverflow) {
            overflowIssues.push({ width, page: target.name, scrollWidth: metrics.scrollWidth, winWidth: metrics.winWidth });
          }
          if (metrics.brokenImages.length > 0) {
            brokenImagesTotal.push({ width, page: target.name, images: metrics.brokenImages });
          }
        }

        if (consoleErrors.length > 0) {
          consoleErrorsTotal.push({ width, page: target.name, errors: consoleErrors });
        }
      } catch (err) {
        console.error(`  [FAIL] ${target.name} crashed at ${width}px:`, err.message);
      } finally {
        page.off('console', onConsole);
        page.off('requestfailed', onRequestFailed);
      }
    }

    await page.close();
  }

  await browser.close();

  console.log('\n================================================================');
  console.log(`RESPONSIVE AUDIT RESULTS: ${passedAudits} / ${totalAudits} PASSED`);
  console.log(`Horizontal Overflows: ${overflowIssues.length}`);
  console.log(`Broken Images Found: ${brokenImagesTotal.length}`);
  console.log(`Console Errors Found: ${consoleErrorsTotal.length}`);
  console.log('================================================================\n');

  if (overflowIssues.length > 0) {
    console.log('Overflow Details:', JSON.stringify(overflowIssues, null, 2));
  }
}

runResponsiveAudit().catch((err) => {
  console.error('Audit crashed:', err);
  process.exit(1);
});
