import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function debugHeader() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

  const data = await page.evaluate(() => {
    const header = document.querySelector('header');
    const bar = header ? header.querySelector('div') : null;
    return {
      headerHtml: header ? header.outerHTML : null,
    };
  });

  console.log('HEADER HTML:');
  console.log(data.headerHtml);

  await browser.close();
}

debugHeader().catch(console.error);
