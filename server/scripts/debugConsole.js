import puppeteer from 'puppeteer-core';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();
  const testToken = jwt.sign({ sub: 20, role: 'customer' }, env.jwt.secret, { expiresIn: '1h' });

  await page.evaluateOnNewDocument((token) => {
    localStorage.setItem('mb_token', token);
  }, testToken);

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });

  console.log('--- Visiting Checkout ---');
  await page.goto('http://localhost:5173/checkout', { waitUntil: 'networkidle2' });

  console.log('\n--- Visiting Order Details ---');
  await page.goto('http://localhost:5173/orders/26', { waitUntil: 'networkidle2' });

  await browser.close();
}

main().catch(console.error);
