import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ADMIN_BASE = 'http://localhost:5174';
const API_BASE = 'http://localhost:5000/api';

const VIEWPORTS = [
  { name: 'Mobile Small', width: 360, height: 640 },
  { name: 'Mobile Standard (iPhone 13)', width: 390, height: 844 },
  { name: 'Tablet Portrait (iPad)', width: 768, height: 1024 },
  { name: 'Tablet Landscape / Laptop', width: 1024, height: 768 },
  { name: 'Desktop Large', width: 1440, height: 900 },
];

const PAGES_TO_TEST = [
  { route: '/', name: 'Dashboard' },
  { route: '/products', name: 'Products' },
  { route: '/categories', name: 'Categories' },
  { route: '/inventory', name: 'Inventory' },
  { route: '/orders', name: 'Orders' },
  { route: '/rental-bookings', name: 'Rental Bookings' },
  { route: '/customers', name: 'Customers' },
  { route: '/payments', name: 'Payments' },
  { route: '/coupons', name: 'Coupons' },
  { route: '/reviews', name: 'Reviews' },
  { route: '/invoices', name: 'Invoices' },
  { route: '/analytics', name: 'Analytics' },
  { route: '/settings', name: 'Settings' },
];

async function main() {
  console.log('--- ADMIN MULTI-VIEWPORT RESPONSIVE AUDIT ---');

  // 1. Get Admin Token via demo-admin-login (with retry for cloud DB connection warmup)
  let loginData = null;
  let token = null;
  let adminUser = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const loginRes = await fetch(`${API_BASE}/auth/demo-admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      loginData = await loginRes.json();
      if (loginData.data?.token) {
        token = loginData.data.token;
        adminUser = loginData.data.user;
        break;
      }
    } catch (e) {
      console.log(`Connection attempt ${attempt} failed: ${e.message}, retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!token) {
    console.error('Failed to authenticate admin:', loginData);
    process.exit(1);
  }
  console.log('✓ Admin authenticated successfully.');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });

    // Inject token before navigation
    await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((tok, usr) => {
      localStorage.setItem('mb_admin_token', tok);
      localStorage.setItem('mb_admin_user', JSON.stringify(usr));
    }, token, adminUser);

    for (const p of PAGES_TO_TEST) {
      const consoleErrors = [];
      const onConsole = (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      };
      page.on('console', onConsole);

      try {
        await page.goto(`${ADMIN_BASE}${p.route}`, { waitUntil: 'networkidle2', timeout: 15000 });

        // Measure page dimensions for horizontal scroll / overflow
        const overflowCheck = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
          const clientWidth = docEl.clientWidth;
          return {
            hasHorizontalOverflow: scrollWidth > clientWidth + 2, // 2px margin of error
            scrollWidth,
            clientWidth,
          };
        });

        // Test mobile drawer button visibility on small viewports
        let drawerStatus = 'N/A';
        if (vp.width < 1024) {
          const hasMenuButton = await page.$('button[title="Open navigation menu"], button[aria-label="Toggle navigation drawer"]') !== null;
          drawerStatus = hasMenuButton ? 'Menu Toggle Present' : 'Missing Toggle';
        }

        results.push({
          viewport: vp.name,
          width: vp.width,
          page: p.name,
          route: p.route,
          overflow: overflowCheck.hasHorizontalOverflow,
          scrollWidth: overflowCheck.scrollWidth,
          clientWidth: overflowCheck.clientWidth,
          drawerStatus,
          errors: consoleErrors,
        });

        const statusIcon = !overflowCheck.hasHorizontalOverflow && consoleErrors.length === 0 ? '✓' : '⚠';
        console.log(`  ${statusIcon} ${p.name.padEnd(16)} | Overflow: ${overflowCheck.hasHorizontalOverflow ? `YES (${overflowCheck.scrollWidth}px vs ${overflowCheck.clientWidth}px)` : 'None'} | Errors: ${consoleErrors.length}`);
      } catch (err) {
        console.error(`  ✖ ${p.name}: Navigation failed (${err.message})`);
        results.push({
          viewport: vp.name,
          width: vp.width,
          page: p.name,
          route: p.route,
          overflow: false,
          drawerStatus: 'Failed',
          errors: [err.message],
        });
      } finally {
        page.off('console', onConsole);
      }
    }

    await page.close();
  }

  await browser.close();

  // Summary aggregation
  console.log('\n--- VIEWPORT AUDIT SUMMARY ---');
  const totalAudits = results.length;
  const overflows = results.filter(r => r.overflow);
  const totalErrors = results.reduce((acc, r) => acc + r.errors.length, 0);

  console.log(`Total Page/Viewport Combinations Tested: ${totalAudits}`);
  console.log(`Total Horizontal Overflows Detected: ${overflows.length}`);
  console.log(`Total Console Errors Detected: ${totalErrors}`);

  if (overflows.length > 0) {
    console.log('\nOverflow Details:');
    overflows.forEach(o => {
      console.log(`  - [${o.viewport} ${o.width}px] ${o.page} (${o.route}): scrollWidth=${o.scrollWidth}px > clientWidth=${o.clientWidth}px`);
    });
  }
}

main().catch(err => {
  console.error('Fatal viewport audit error:', err);
  process.exit(1);
});
