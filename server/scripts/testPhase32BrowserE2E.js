/**
 * Phase 3.2 End-to-End Browser Test Suite (Headless Chrome)
 * Verifies live browser behavior of Rental Duration Preservation and PIN-code Autofill
 */

import puppeteer from 'puppeteer-core';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/db.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_CLIENT = 'http://localhost:5173';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName} - ${details}`);
    failed++;
  }
}

async function runBrowserE2E() {
  console.log('============================================================');
  console.log('MAJESTIC BLAZER - PHASE 3.2 LIVE BROWSER E2E TESTS');
  console.log('============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => console.log('  PAGE CONSOLE:', msg.text()));
  page.on('pageerror', (err) => console.log('  PAGE ERROR:', err.message));

  const { rows: userRows } = await pool.query("SELECT id, email, role, full_name FROM users WHERE role = 'customer' LIMIT 1");
  const testCustomer = userRows[0] || { id: 2, email: 'customer@majesticblazer.com', role: 'customer', full_name: 'Lord Chesterfield' };

  // Authenticate patron in browser localStorage
  const customerToken = jwt.sign(
    { sub: testCustomer.id, email: testCustomer.email, role: testCustomer.role },
    env.jwt.secret,
    { expiresIn: '2h' }
  );

  await page.goto(`${BASE_CLIENT}/shop`, { waitUntil: 'networkidle2' });
  await page.evaluate((tok, u) => {
    localStorage.setItem('mb_token', tok);
    localStorage.setItem('mb_user', JSON.stringify(u));
  }, customerToken, testCustomer);

  try {
    // -------------------------------------------------------------
    // PART 1: RENTAL DURATION PRESERVATION ON PRODUCT DETAILS
    // -------------------------------------------------------------
    console.log('--- Part 1: Rental Duration Live Browser Interaction ---');

    await page.goto(`${BASE_CLIENT}/products/sovereign-charcoal-grey-glen-check-executive-blazer`, {
      waitUntil: 'networkidle2',
    });

    // Click the RENT tab button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const rentBtn = btns.find((b) => b.innerText.includes('RENT'));
      if (rentBtn) rentBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Locate Start Date and Return Date inputs
    const dateInputs = await page.$$('input[type="date"]');
    assert(dateInputs.length >= 2, 'Found Start Date and Return Date inputs');

    const startInput = dateInputs[0];
    const endInput = dateInputs[1];

    // Read initial dates
    const initialStart = await page.evaluate((el) => el.value, startInput);
    const initialEnd = await page.evaluate((el) => el.value, endInput);
    console.log(`  Initial Dates: Start=${initialStart}, Return=${initialEnd}`);

    const [sy, sm, sd] = initialStart.split('-').map(Number);
    const [ey, em, ed] = initialEnd.split('-').map(Number);
    const initialDiffDays = Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000);
    const initialDurationDays = initialDiffDays + 1;
    console.log(`  Initial Duration: ${initialDurationDays} rental days (${initialDiffDays} days span)`);

    // Change start date forward by 5 days
    const newStartDateObj = new Date(Date.UTC(sy, sm - 1, sd + 5));
    const newStartStr = newStartDateObj.toISOString().split('T')[0];

    await page.evaluate((el, val) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, startInput, newStartStr);

    await new Promise((r) => setTimeout(r, 600));

    // Verify Return Date moved forward by same duration
    const shiftedEnd = await page.evaluate((el) => el.value, endInput);
    const [sey, sem, sed] = shiftedEnd.split('-').map(Number);
    const [sny, snm, snd] = newStartStr.split('-').map(Number);
    const shiftedDiffDays = Math.round((Date.UTC(sey, sem - 1, sed) - Date.UTC(sny, snm - 1, snd)) / 86400000);
    const shiftedDurationDays = shiftedDiffDays + 1;

    console.log(`  Shifted Dates: Start=${newStartStr}, Return=${shiftedEnd} (${shiftedDurationDays} days)`);
    assert(
      shiftedDurationDays === initialDurationDays,
      'Rental duration preserved when start date changes',
      `Expected ${initialDurationDays} days, got ${shiftedDurationDays}`
    );

    // Test 1-day rental preservation
    console.log('  Testing 1-day rental preservation...');
    await page.evaluate((el, val) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, endInput, newStartStr); // End date = Start date => 1 day

    await new Promise((r) => setTimeout(r, 600));
    const oneDayEnd = await page.evaluate((el) => el.value, endInput);
    assert(oneDayEnd === newStartStr, 'Return Date set to Start Date for 1-day rental');

    // Move start date again by 3 days
    const nextStartObj = new Date(Date.UTC(sny, snm - 1, snd + 3));
    const nextStartStr = nextStartObj.toISOString().split('T')[0];

    await page.evaluate((el, val) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, startInput, nextStartStr);

    await new Promise((r) => setTimeout(r, 600));
    const newOneDayEnd = await page.evaluate((el) => el.value, endInput);
    assert(
      newOneDayEnd === nextStartStr,
      'One-day rental remains 1 day when start date moves forward',
      `Expected ${nextStartStr}, got ${newOneDayEnd}`
    );

    // -------------------------------------------------------------
    // PART 2: INDIAN PIN-CODE AUTOFILL ON CHECKOUT
    // -------------------------------------------------------------
    console.log('\n--- Part 2: Indian PIN-Code Autofill Live Browser Interaction ---');

    // Populate a cart item in localStorage so checkout page does not show empty bag
    await page.evaluate(() => {
      const mockCartItem = {
        key: 'buy_1_1',
        type: 'buy',
        productId: 1,
        variantId: 1,
        quantity: 1,
        name: 'The Imperial Blazer',
        price: 35000,
        originalPrice: 42000,
        size: '40R',
        image: '/assets/products/imperial-navy-velvet-front.webp',
      };
      localStorage.setItem('mb_cart_v2', JSON.stringify([mockCartItem]));
    });

    await page.goto(`${BASE_CLIENT}/checkout`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    // Ensure we are viewing the new address form
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addBtn = btns.find((b) => b.innerText.includes('Add New Address'));
      if (addBtn) addBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    const pincodeInput = await page.$('#checkout-pincode');
    const cityInput = await page.$('#checkout-city');
    const stateInput = await page.$('#checkout-state');

    assert(Boolean(pincodeInput && cityInput && stateInput), 'Found Pincode, City, and State input fields');

    // Clear and enter 6-digit PIN 560001 (Bangalore, Karnataka)
    await page.evaluate((el) => {
      el.value = '';
      el.focus();
    }, pincodeInput);

    await pincodeInput.type('560001', { delay: 50 });
    console.log('  Typed PIN 560001, waiting for postal autofill...');

    // Wait for status banner
    await page.waitForSelector('[role="status"]', { timeout: 8000 });
    const statusText1 = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent || '');
    const autofilledCity1 = await page.evaluate((el) => el.value, cityInput);
    const autofilledState1 = await page.evaluate((el) => el.value, stateInput);

    console.log(`  Autofill Result for 560001: City="${autofilledCity1}", State="${autofilledState1}", Status="${statusText1}"`);
    assert(
      autofilledCity1.toLowerCase().includes('bangalore'),
      'PIN 560001 autofilled City to Bangalore',
      `Got ${autofilledCity1}`
    );
    assert(
      autofilledState1.toLowerCase().includes('karnataka'),
      'PIN 560001 autofilled State to Karnataka',
      `Got ${autofilledState1}`
    );
    assert(
      statusText1.includes('Autofilled'),
      'Status banner displayed success feedback',
      `Got ${statusText1}`
    );

    // Verify fields remain manually editable
    await page.evaluate((el) => {
      el.value = 'Bangalore Central Prestige Zone';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, cityInput);
    const editedCity = await page.evaluate((el) => el.value, cityInput);
    assert(
      editedCity === 'Bangalore Central Prestige Zone',
      'City field remains manually editable after autofill'
    );

    // Test invalid PIN: 999999
    console.log('  Testing invalid PIN 999999...');
    await page.evaluate((el) => {
      el.value = '';
    }, pincodeInput);
    await pincodeInput.type('999999', { delay: 50 });

    await new Promise((r) => setTimeout(r, 1500));
    const statusTextInvalid = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent || '');
    console.log(`  Invalid PIN status banner: "${statusTextInvalid}"`);
    assert(
      statusTextInvalid.includes('not found') || statusTextInvalid.includes('manually'),
      'Invalid PIN displays helpful manual entry fallback notice'
    );

    // Test re-entering 641107 (Coimbatore atelier)
    console.log('  Testing re-entering 641107 (Coimbatore atelier)...');
    await page.evaluate((el) => {
      el.value = '';
    }, pincodeInput);
    await pincodeInput.type('641107', { delay: 50 });

    await new Promise((r) => setTimeout(r, 2000));
    const autofilledCityCbe = await page.evaluate((el) => el.value, cityInput);
    const autofilledStateCbe = await page.evaluate((el) => el.value, stateInput);
    console.log(`  Re-entry 641107 Result: City="${autofilledCityCbe}", State="${autofilledStateCbe}"`);
    assert(
      autofilledCityCbe.toLowerCase().includes('coimbatore'),
      'PIN 641107 updated City to Coimbatore'
    );
    assert(
      autofilledStateCbe.toLowerCase().includes('tamil nadu'),
      'PIN 641107 updated State to Tamil Nadu'
    );

    // Capture screenshot of the verified checkout form
    const screenshotPath = 'C:\\Users\\arjun\\.gemini\\antigravity\\brain\\ab16bec3-49e2-41c6-85b1-513c325e243c\\phase-3-2-checkout-pincode-autofill.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`  Saved screenshot of live PIN autofill: ${screenshotPath}`);

  } catch (err) {
    console.error('Browser E2E Execution Error:', err);
    failed++;
  } finally {
    await browser.close();
  }

  console.log('\n============================================================');
  console.log(`BROWSER E2E SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('============================================================');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runBrowserE2E();
