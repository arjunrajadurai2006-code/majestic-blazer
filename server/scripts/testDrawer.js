import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testDrawer() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

  // Click hamburger
  await page.click('button[aria-label="Toggle navigation menu"]');
  await new Promise((r) => setTimeout(r, 400));

  const drawerData = await page.evaluate(() => {
    const d = document.querySelector('div[class*="mobileDrawer"]');
    return d ? d.outerHTML : 'NOT FOUND';
  });

  console.log('DRAWER DATA:', drawerData);

  await page.screenshot({ path: 'C:/Users/arjun/.gemini/antigravity/brain/494b4567-0cba-40ec-9dcd-73fe397125b0/home_mobile_drawer.png' });

  await browser.close();
}

testDrawer().catch(console.error);
