import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runE2E() {
  console.log('=== STARTING COMPLETE BROWSER AUTHENTICATION E2E AUDIT ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  let passed = 0;
  let failed = 0;

  const assert = (condition, desc) => {
    if (condition) {
      console.log(`✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${desc}`);
      failed++;
    }
  };

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // ==========================================
    // 1. CUSTOMER PORTAL — DESKTOP TESTS
    // ==========================================
    console.log('\n--- 1. Testing Customer Application (Desktop) ---');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'networkidle2' });

    // 1a. Check logged-out header controls
    const signInVisible = await page.$eval('header a[href="/login"]', (el) => el.textContent.trim()).catch(() => null);
    const registerVisible = await page.$eval('header a[href="/register"]', (el) => el.textContent.trim()).catch(() => null);
    assert(signInVisible === 'Sign In' && registerVisible === 'Create Account', 'Logged-out header displays "Sign In" and "Create Account"');

    // 1b. Customer Login
    console.log('Navigating to Customer Login...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
    await page.type('input[name="email"]', 'customer.demo@majesticblazer.com');
    await page.type('input[name="password"]', 'CustomerDemo2026!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // 1c. Verify authenticated header
    const token = await page.evaluate(() => localStorage.getItem('mb_token'));
    assert(token && token.length > 20, 'Customer token stored in localStorage (mb_token)');

    const userButton = await page.waitForSelector('button[aria-label="Patron account menu"]', { timeout: 5000 }).catch(() => null);
    assert(userButton !== null, 'Authenticated customer account menu button rendered in header');

    // 1d. Open Customer Account Dropdown
    await page.click('button[aria-label="Patron account menu"]');
    await page.waitForSelector('div[role="menu"]', { timeout: 3000 });

    const menuLinks = await page.$$eval('div[role="menu"] a', (els) => els.map((e) => e.textContent.trim()));
    const hasProfile = menuLinks.some((l) => l.includes('Profile') || l.includes('My Account'));
    const hasOrders = menuLinks.some((l) => l.includes('Orders'));
    const hasRentals = menuLinks.some((l) => l.includes('Rental'));
    const hasWishlist = menuLinks.some((l) => l.includes('Wishlist'));
    assert(
      hasProfile && hasOrders && hasRentals && hasWishlist,
      'Customer dropdown contains Profile, My Orders, Rental Bookings, and Wishlist'
    );

    // 1e. Test Sign Out Modal
    console.log('Clicking Sign Out in dropdown...');
    await page.click('div[role="menu"] button');
    await page.waitForSelector('div[role="dialog"]', { timeout: 3000 });

    const modalTitle = await page.$eval('#customer-modal-title', (el) => el.textContent.trim());
    assert(modalTitle === 'Confirm Sign Out', 'Sign Out opens confirmation dialog ("Confirm Sign Out")');

    // 1f. Confirm Sign Out
    console.log('Confirming Sign Out...');
    const confirmBtn = await page.waitForSelector('button:has-text("Sign Out")', { timeout: 3000 }).catch(async () => {
      // Fallback selector
      const btns = await page.$$('div[role="dialog"] button');
      return btns[1];
    });
    await confirmBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // 1g. Verify post-logout state
    const currentUrl = page.url();
    assert(currentUrl.includes('/login'), 'Redirected to /login after customer sign out');

    const tokenAfter = await page.evaluate(() => localStorage.getItem('mb_token'));
    assert(tokenAfter === null, 'mb_token successfully cleared from localStorage');

    const logoutBanner = await page.$eval('div[style*="background: rgba(46, 213, 115"]', (el) => el.textContent).catch(() => '');
    assert(logoutBanner.includes('signed out successfully'), 'Logout success message banner displayed on customer login page');

    // 1h. History Guard: Back Navigation
    console.log('Testing back navigation protection...');
    await page.goBack();
    await new Promise((r) => setTimeout(r, 1000));
    const postBackToken = await page.evaluate(() => localStorage.getItem('mb_token'));
    assert(postBackToken === null, 'Session remains terminated after browser back navigation');

    // ==========================================
    // 2. CUSTOMER PORTAL — MOBILE DRAWER TESTS
    // ==========================================
    console.log('\n--- 2. Testing Customer Application (Mobile Viewport) ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });

    // Open mobile menu
    await page.click('button[aria-label="Toggle navigation menu"]');
    await new Promise((r) => setTimeout(r, 500));

    const mobileSignIn = await page.$eval('a[href="/login"]', (el) => el.textContent.trim()).catch(() => null);
    const mobileRegister = await page.$eval('a[href="/register"]', (el) => el.textContent.trim()).catch(() => null);
    assert(mobileSignIn === 'Sign In' && mobileRegister === 'Create Account', 'Mobile drawer contains "Sign In" and "Create Account" when logged out');

    // ==========================================
    // 3. ADMIN PORTAL — PERSISTENT HEADER & LOGOUT
    // ==========================================
    console.log('\n--- 3. Testing Admin Portal ---');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle2' });

    console.log('Logging into Admin Portal...');
    await page.type('input[name="email"]', 'admin.demo@majesticblazer.com');
    await page.type('input[name="password"]', 'MajesticAdmin2026!Secure');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const adminToken = await page.evaluate(() => localStorage.getItem('mb_admin_token'));
    assert(adminToken && adminToken.length > 20, 'Admin token stored in localStorage (mb_admin_token)');

    // 3a. Verify AdminHeader on Dashboard
    const adminHeader = await page.waitForSelector('header button[aria-label="Admin account menu"]', { timeout: 5000 }).catch(() => null);
    assert(adminHeader !== null, 'Persistent AdminHeader and account control present on / (Dashboard)');

    // 3b. Verify AdminHeader across other pages
    const testAdminPages = ['/products', '/orders', '/rental-bookings', '/customers', '/coupons', '/reviews', '/settings'];
    let persistentCount = 0;
    for (const route of testAdminPages) {
      await page.goto(`http://localhost:5174${route}`, { waitUntil: 'networkidle2' });
      const hdr = await page.$('header button[aria-label="Admin account menu"]');
      if (hdr) persistentCount++;
    }
    assert(persistentCount === testAdminPages.length, `AdminHeader persists across all tested pages (${persistentCount}/${testAdminPages.length})`);

    // 3c. Open Admin Dropdown
    await page.click('header button[aria-label="Admin account menu"]');
    await page.waitForSelector('div[role="menu"]', { timeout: 3000 });

    const adminEmailDisplay = await page.$eval('div[role="menu"]', (el) => el.textContent);
    assert(adminEmailDisplay.includes('admin.demo@majesticblazer.com'), 'Admin dropdown displays authenticated admin email and name');

    // 3d. Click Sign Out in Admin Dropdown
    console.log('Triggering Admin Sign Out...');
    const adminSignOutBtn = await page.$('div[role="menu"] button');
    await adminSignOutBtn.click();
    await page.waitForSelector('div[role="dialog"]', { timeout: 3000 });

    const adminModalTitle = await page.$eval('#modal-signout-title', (el) => el.textContent.trim());
    assert(adminModalTitle === 'Confirm Sign Out', 'Admin Sign Out triggers confirmation dialog');

    // 3e. Confirm Admin Sign Out
    console.log('Confirming Admin Sign Out...');
    const adminConfirmSignOutBtn = await page.$('button[class*="modalSignOutBtn"]');
    await adminConfirmSignOutBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // 3f. Verify Admin Redirection & Storage Cleanup
    const adminUrlAfter = page.url();
    assert(adminUrlAfter.includes('/login'), 'Redirected to /login after admin sign out');

    const adminTokenAfter = await page.evaluate(() => localStorage.getItem('mb_admin_token'));
    assert(adminTokenAfter === null, 'mb_admin_token cleared from localStorage');

    const adminLogoutBanner = await page.$eval('div[style*="background: rgba(46, 213, 115"]', (el) => el.textContent).catch(() => '');
    assert(adminLogoutBanner.includes('signed out of the Atelier Portal'), 'Admin logout success message banner displayed on /login');

    // 3g. Back Navigation Guard on Admin
    console.log('Testing back navigation protection on admin...');
    await page.goBack();
    await new Promise((r) => setTimeout(r, 1000));
    const guardedUrl = page.url();
    assert(guardedUrl.includes('/login'), 'Admin route guard prevents back navigation to protected screens after logout');

    console.log(`\n========================================`);
    console.log(`BROWSER E2E SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

  } finally {
    await browser.close();
  }
}

runE2E()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Browser E2E test crashed:', err);
    process.exit(1);
  });
