import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

const ARTIFACT_DIR = 'C:\\Users\\arjun\\.gemini\\antigravity\\brain\\ab16bec3-49e2-41c6-85b1-513c325e243c';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function capture() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const token = jwt.sign({ sub: 20, role: 'customer' }, env.jwt.secret, { expiresIn: '1h' });
  const targetUrl = `http://localhost:5173/orders/26?token=${token}`;

  console.log('Launching headless Chrome via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();

  // Inject authentication token before any script runs
  await page.evaluateOnNewDocument((authToken) => {
    localStorage.setItem('mb_token', authToken);
  }, token);

  // 1. Order Details Desktop (1440x960)
  console.log('Capturing Order Details Desktop...');
  await page.setViewport({ width: 1440, height: 960 });
  await page.goto('http://localhost:5173/orders/26', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2000));
  
  const desktopPath = path.join(ARTIFACT_DIR, 'order-details-desktop.png');
  await page.screenshot({ path: desktopPath, fullPage: true });
  console.log('✓ Desktop screenshot saved:', desktopPath);

  // 2. Order Details Mobile (390x844)
  console.log('Capturing Order Details Mobile...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/orders/26', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2000));

  const mobilePath = path.join(ARTIFACT_DIR, 'order-details-mobile.png');
  await page.screenshot({ path: mobilePath, fullPage: true });
  console.log('✓ Mobile screenshot saved:', mobilePath);

  // 3. Order Details Pending with Cancel Button (Desktop)
  console.log('Capturing Order Details Pending with Cancel Button...');
  await page.setViewport({ width: 1440, height: 960 });
  await page.goto('http://localhost:5173/orders/48', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2000));

  const pendingPath = path.join(ARTIFACT_DIR, 'order-details-pending.png');
  await page.screenshot({ path: pendingPath, fullPage: true });
  console.log('✓ Pending order screenshot saved:', pendingPath);

  await browser.close();
  console.log('✓ Both screenshots successfully captured!');
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
