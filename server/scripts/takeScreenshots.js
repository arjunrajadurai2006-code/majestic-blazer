import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();

  // Desktop 1440
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'C:/Users/arjun/.gemini/antigravity/brain/494b4567-0cba-40ec-9dcd-73fe397125b0/home_desktop_post.png' });

  // Desktop 1200
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'C:/Users/arjun/.gemini/antigravity/brain/494b4567-0cba-40ec-9dcd-73fe397125b0/home_desktop_1200.png' });

  // Tablet 820
  await page.setViewport({ width: 820, height: 1180 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'C:/Users/arjun/.gemini/antigravity/brain/494b4567-0cba-40ec-9dcd-73fe397125b0/home_tablet_post.png' });

  // Mobile 390
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'C:/Users/arjun/.gemini/antigravity/brain/494b4567-0cba-40ec-9dcd-73fe397125b0/home_mobile_post.png' });

  await browser.close();
  console.log('Post-refinement screenshots captured successfully');
}

capture().catch(console.error);
