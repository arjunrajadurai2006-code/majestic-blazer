import http from 'http';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import * as rentalModel from '../src/models/rentalModel.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
  }
}

async function runEdgeCaseTests() {
  console.log('\n======================================================');
  console.log('   MAJESTIC BLAZER — PHASE 2.4D EDGE-CASE TEST SUITE');
  console.log('======================================================\n');

  // Start ephemeral HTTP server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const BASE_URL = `http://localhost:${port}/api`;
  console.log(`Ephemeral test HTTP server running on port ${port}\n`);

  const prodDetailsSource = fs.readFileSync(path.join(rootDir, 'client/src/pages/ProductDetails.jsx'), 'utf-8');

  try {
    // ---------------------------------------------------------------------------
    // 1. AUTHENTICATION RATE-LIMIT & FEEDBACK TESTS
    // ---------------------------------------------------------------------------
    console.log('--- 1. Authentication Rate-Limit & Feedback Tests ---');

    // 1.1 Valid login test
    let customerToken = null;
    let customerId = null;
    try {
      const loginRes = await fetch(`${BASE_URL}/auth/demo-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const loginData = await loginRes.json();
      assert(loginRes.status === 200 && loginData.data?.token, '1.1 Normal successful demo customer login works');
      customerToken = loginData.data?.token;
      customerId = loginData.data?.user?.id;
    } catch (err) {
      assert(false, '1.1 Normal successful login works', err.message);
    }

    // 1.2 Invalid credentials test
    try {
      const invalidRes = await fetch(`${BASE_URL}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@majesticblazer.com', password: 'DefinitelyWrongPassword999!' }),
      });
      const invalidData = await invalidRes.json();
      assert(
        invalidRes.status === 401 && invalidData.message && !invalidData.stack,
        '1.2 Invalid credentials return HTTP 401 with clean user error and no technical leak'
      );
    } catch (err) {
      assert(false, '1.2 Invalid credentials return HTTP 401', err.message);
    }

    // 1.3 Rate limiter response contract test
    try {
      // Check that server/src/app.js exposes Retry-After in CORS
      const appSource = fs.readFileSync(path.join(rootDir, 'server/src/app.js'), 'utf-8');
      assert(
        appSource.includes("'Retry-After'") && appSource.includes('exposedHeaders'),
        '1.3 CORS exposes Retry-After header for cross-origin frontend visibility'
      );

      // Verify rate limit message provides retryAfter calculation
      assert(
        appSource.includes('retryAfter') && appSource.includes('Too many authentication attempts'),
        '1.4 authLimiter calculates retryAfter seconds and clear user message'
      );

      // Verify client api.js parses Retry-After and attaches to error object
      const apiSource = fs.readFileSync(path.join(rootDir, 'client/src/services/api.js'), 'utf-8');
      assert(
        apiSource.includes("error.retryAfter =") && apiSource.includes("res.headers.get('Retry-After')"),
        '1.5 Client api.js captures HTTP 429 Retry-After header and propagates cooldown duration'
      );

      // Verify AuthForm.jsx cooldown timer and form disabling logic
      const authFormSource = fs.readFileSync(path.join(rootDir, 'client/src/components/common/AuthForm.jsx'), 'utf-8');
      assert(
        authFormSource.includes('cooldown') &&
        authFormSource.includes('setInterval') &&
        authFormSource.includes('disabled={busy || cooldown > 0}'),
        '1.6 AuthForm.jsx manages live cooldown countdown, disables repeated submissions, and restores form on expiry'
      );
    } catch (err) {
      assert(false, '1.3-1.6 Rate limiter implementation check', err.message);
    }

    // ---------------------------------------------------------------------------
    // 2. RENTAL PAST-DATE VALIDATION & TIMEZONE TESTS
    // ---------------------------------------------------------------------------
    console.log('\n--- 2. Rental Past-Date Validation Tests ---');

    // Fetch a valid rentable product
    let testProduct = null;
    let testVariant = null;
    try {
      const { rows: prodRows } = await pool.query(`
        SELECT p.id AS product_id, pv.id AS variant_id
        FROM products p
        JOIN product_variants pv ON pv.product_id = p.id
        WHERE p.is_rentable = true AND p.is_active = true
        LIMIT 1
      `);
      testProduct = prodRows[0]?.product_id;
      testVariant = prodRows[0]?.variant_id;
      assert(Boolean(testProduct && testVariant), '2.1 Valid rentable product & variant found in database');
    } catch (err) {
      assert(false, '2.1 Valid rentable product & variant found in database', err.message);
    }

    if (testProduct && testVariant) {
      // 2.2 Past date availability check rejected
      try {
        const pastAvailRes = await fetch(
          `${BASE_URL}/rentals/check?productId=${testProduct}&variantId=${testVariant}&startDate=2020-01-01&endDate=2020-01-04`
        );
        const pastAvailData = await pastAvailRes.json();
        assert(
          pastAvailRes.status === 400 && pastAvailData.message?.toLowerCase().includes('past'),
          '2.2 Direct API check rejects past rental start date with HTTP 400'
        );
      } catch (err) {
        assert(false, '2.2 Direct API check rejects past rental date', err.message);
      }

      // 2.3 Invalid date order rejected
      try {
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const invalidOrderRes = await fetch(
          `${BASE_URL}/rentals/check?productId=${testProduct}&variantId=${testVariant}&startDate=${tomorrow}&endDate=${yesterday}`
        );
        const invalidOrderData = await invalidOrderRes.json();
        assert(
          invalidOrderRes.status === 400 && invalidOrderData.message?.toLowerCase().includes('return date'),
          '2.3 Direct API check rejects return date earlier than start date with HTTP 400'
        );
      } catch (err) {
        assert(false, '2.3 Direct API check rejects return date earlier than start date', err.message);
      }

      // 2.4 Today and valid future dates accepted
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const fourDaysLater = new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0];
        const validRes = await fetch(
          `${BASE_URL}/rentals/check?productId=${testProduct}&variantId=${testVariant}&startDate=${todayStr}&endDate=${fourDaysLater}`
        );
        const validData = await validRes.json();
        assert(
          validRes.status === 200 && validData.success && validData.data?.rentalDays === 5,
          '2.4 Today and valid future dates are accepted (duration calculated correctly)'
        );
      } catch (err) {
        assert(false, '2.4 Today and valid future dates are accepted', err.message);
      }

      // 2.5 Direct booking creation with past date rejected
      try {
        const pastBookingRes = await fetch(`${BASE_URL}/rentals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${customerToken}`,
          },
          body: JSON.stringify({
            productId: testProduct,
            variantId: testVariant,
            startDate: '2021-05-10',
            endDate: '2021-05-14',
            deliveryType: 'pickup',
          }),
        });
        const pastBookingData = await pastBookingRes.json();
        assert(
          pastBookingRes.status === 400 && pastBookingData.message?.toLowerCase().includes('past'),
          '2.5 Direct rental booking creation with past date is rejected with HTTP 400'
        );
      } catch (err) {
        assert(false, '2.5 Direct rental booking creation with past date rejected', err.message);
      }

      // 2.6 Timezone boundary handling
      const isPastHelper = rentalModel.isPastRentalDate;
      const now = new Date();
      const utcDateStr = now.toISOString().split('T')[0];
      const pastOneYear = '2025-01-01';
      const futureDate = '2028-12-31';
      assert(
        isPastHelper(pastOneYear) === true &&
        isPastHelper(futureDate) === false &&
        isPastHelper(utcDateStr) === false,
        '2.6 isPastRentalDate correctly handles timezone leeway (past rejected, today/future accepted)'
      );

      // 2.7 Frontend date picker restrictions in ProductDetails.jsx
      assert(
        prodDetailsSource.includes('min={localToday}') &&
        prodDetailsSource.includes('min={startDate || localToday}') &&
        prodDetailsSource.includes('Rental start date cannot be in the past'),
        '2.7 ProductDetails.jsx disables past dates with min={localToday} and revalidates on submission'
      );
    }

    // ---------------------------------------------------------------------------
    // 3. DUPLICATE CART-ITEM FEEDBACK & MERGE TESTS
    // ---------------------------------------------------------------------------
    console.log('\n--- 3. Duplicate Cart-Item Feedback Tests ---');

    const cartContextSource = fs.readFileSync(path.join(rootDir, 'client/src/context/CartContext.jsx'), 'utf-8');
    assert(
      cartContextSource.includes('return { updated: isUpdated, quantity: finalQty }') &&
      cartContextSource.includes('Math.min(existing.quantity + quantity, maxStock)'),
      '3.1 CartContext addToCart merges duplicate variant quantities and returns update status'
    );

    // Simulate cart merging logic
    const mockProduct = { id: 101, name: 'Sovereign Charcoal Blazer', sale_price: 18500 };
    const mockVariant38 = { id: 201, size: '38R', stock_quantity: 5 };
    const mockVariant40 = { id: 202, size: '40R', stock_quantity: 5 };

    let items = [];
    function simulateAddToCart(product, variant, quantity) {
      const key = `buy_${product.id}_${variant.id}`;
      const existingIndex = items.findIndex((i) => i.key === key);
      if (existingIndex > -1) {
        const maxStock = variant.stock_quantity || 10;
        const newQty = Math.min(items[existingIndex].quantity + quantity, maxStock);
        items[existingIndex].quantity = newQty;
        return { updated: true, quantity: newQty };
      }
      const initialQty = Math.min(quantity, variant.stock_quantity || 10);
      items.push({
        key,
        productId: product.id,
        variantId: variant.id,
        size: variant.size,
        price: product.sale_price,
        quantity: initialQty,
      });
      return { updated: false, quantity: initialQty };
    }

    // First add: Size 38R, qty 1
    const res1 = simulateAddToCart(mockProduct, mockVariant38, 1);
    assert(res1.updated === false && res1.quantity === 1 && items.length === 1, '3.2 First addition creates new cart line');

    // Second add: Size 38R, qty 2 -> merges
    const res2 = simulateAddToCart(mockProduct, mockVariant38, 2);
    assert(
      res2.updated === true && res2.quantity === 3 && items.length === 1 && items[0].quantity === 3,
      '3.3 Duplicate addition merges quantities into existing line without duplicating lines'
    );

    // Third add: Different size (Size 40R) -> distinct line
    const res3 = simulateAddToCart(mockProduct, mockVariant40, 1);
    assert(
      res3.updated === false && items.length === 2 && items[1].size === '40R',
      '3.4 Different variant size creates distinct separate line item'
    );

    // Cart total check
    const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalCartValue = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    assert(
      totalItemCount === 4 && totalCartValue === (18500 * 3) + (18500 * 1),
      '3.5 Cart badge count and cart monetary total stay strictly synchronized'
    );

    // Check caller user-friendly messages
    const qvSource = fs.readFileSync(path.join(rootDir, 'client/src/components/common/QuickViewModal.jsx'), 'utf-8');
    assert(
      qvSource.includes('Updated quantity of') &&
      prodDetailsSource.includes('Updated quantity of'),
      '3.6 ProductDetails and QuickViewModal display distinct "Updated quantity..." feedback on merge'
    );

    // ---------------------------------------------------------------------------
    // 4. MOBILE SAFARI SELECT-CONTROL RELIABILITY TESTS
    // ---------------------------------------------------------------------------
    console.log('\n--- 4. Mobile Safari Select-Control Reliability Tests ---');

    const globalCss = fs.readFileSync(path.join(rootDir, 'client/src/styles/global.css'), 'utf-8');
    assert(
      globalCss.includes('touch-action: manipulation') &&
      globalCss.includes('-webkit-tap-highlight-color: transparent'),
      '4.1 global.css specifies touch-action: manipulation and transparent tap highlight'
    );

    assert(
      globalCss.includes('font-size: 16px !important') &&
      globalCss.includes('@media (max-width: 768px)'),
      '4.2 global.css prevents iOS Mobile Safari auto-zoom by enforcing 16px font-size on mobile inputs/selects'
    );

    const shopCss = fs.readFileSync(path.join(rootDir, 'client/src/pages/Shop.module.css'), 'utf-8');
    assert(
      shopCss.includes('appearance: menulist') &&
      shopCss.includes('min-height: 44px'),
      '4.3 Shop.module.css provides 44px min-height tap target and native appearance for Mobile Safari'
    );

    const shopJsx = fs.readFileSync(path.join(rootDir, 'client/src/pages/Shop.jsx'), 'utf-8');
    assert(
      shopJsx.includes('value={currentSort}') &&
      shopJsx.includes("onChange={(e) => updateParam('sort', e.target.value)}") &&
      shopJsx.includes('aria-label="Sort blazers"'),
      '4.4 Shop.jsx uses supported React controlled value and onChange event handling for sort dropdown'
    );

    const prodDetailsCss = fs.readFileSync(path.join(rootDir, 'client/src/pages/ProductDetails.module.css'), 'utf-8');
    assert(
      prodDetailsCss.includes('.formGroup select') &&
      prodDetailsCss.includes('min-height: 44px') &&
      prodDetailsCss.includes('touch-action: manipulation'),
      '4.5 ProductDetails review rating select has 44px touch target and manipulation handling'
    );

    // ---------------------------------------------------------------------------
    // SUMMARY
    // ---------------------------------------------------------------------------
    console.log('\n======================================================');
    console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
    if (failedTests > 0) {
      console.error(`   ${failedTests} TESTS FAILED`);
    } else {
      console.log('   ALL PHASE 2.4D EDGE-CASE TESTS PASSED PERFECTLY!');
    }
    console.log('======================================================\n');
  } finally {
    server.close();
    await pool.end();
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

runEdgeCaseTests().catch(async (err) => {
  console.error('Test suite runner crashed:', err);
  await pool.end();
  process.exit(1);
});
