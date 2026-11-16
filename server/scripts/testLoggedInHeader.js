import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testLoggedIn() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });

  // Fill credentials
  await page.type('input[name="email"]', 'customer.demo@majesticblazer.com');
  await page.type('input[name="password"]', 'CustomerDemo2026!');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.log('Logged in successfully. Current URL:', page.url());

  // Navigate to home
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });

  // Open account dropdown
  await page.waitForSelector('button[aria-label="Patron account menu"]', { timeout: 5000 });
  await page.click('button[aria-label="Patron account menu"]');
  await new Promise((r) => setTimeout(r, 400));

  await page.screenshot({ path: 'C:/Users/arjun/.gemini/antigravity/brain/494b4567-0cba-40ec-9dcd-73fe397125b0/home_desktop_loggedin_dropdown.png' });

  // Also test tablet & mobile logged in drawer
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await page.waitForSelector('button[aria-label="Toggle navigation menu"]', { timeout: 5000 });
  await page.click('button[aria-label="Toggle navigation menu"]');
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'C:/Users/arjun/.gemini/antigravity/brain/494b4567-0cba-40ec-9dcd-73fe397125b0/home_mobile_loggedin_drawer.png' });

  await browser.close();
  console.log('Logged-in screenshots captured');
}

testLoggedIn().catch(console.error);
