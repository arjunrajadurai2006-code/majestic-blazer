import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:\\Users\\arjun\\.gemini\\antigravity\\brain\\494b4567-0cba-40ec-9dcd-73fe397125b0';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function capture() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  console.log('Launching headless Chrome via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();

  // 1. Homepage Desktop (1440x900)
  console.log('Capturing Homepage Desktop...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot-homepage-desktop.png') });

  // 2. Homepage Mobile (390x844)
  console.log('Capturing Homepage Mobile...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot-homepage-mobile.png') });

  // 3. Product Page Desktop (1440x900)
  console.log('Capturing Product Details Desktop...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/products/imperial-royal-navy-velvet-peak-lapel-blazer', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot-product-desktop.png') });

  // 4. Product Page Mobile (390x844)
  console.log('Capturing Product Details Mobile...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/products/imperial-royal-navy-velvet-peak-lapel-blazer', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot-product-mobile.png') });

  // 5. Patron Login Page Desktop (1440x900)
  console.log('Capturing Patron Login Desktop...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot-login-desktop.png') });

  // 6. Patron Login Page Mobile (390x844)
  console.log('Capturing Patron Login Mobile...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot-login-mobile.png') });

  // 7. Admin Dashboard Desktop
  console.log('Authenticating and capturing Admin Dashboard Desktop...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));
  
  // Fill admin credentials
  await page.type('input[type="email"]', 'admin.demo@majesticblazer.com');
  await page.type('input[type="password"]', 'MajesticAdmin2026!Secure');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot-admin-dashboard.png') });

  // 8. Admin Dashboard Mobile
  console.log('Capturing Admin Dashboard Mobile...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot-admin-mobile.png') });

  await browser.close();
  console.log('✓ All requested screenshots successfully captured!');
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});

