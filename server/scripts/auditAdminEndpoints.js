import { pool } from '../src/config/db.js';

async function testAllAdminEndpoints() {
  console.log('=====================================================');
  console.log('STEP 2: ADMIN PAGES & APIS LIVE RESPONSE AUDIT');
  console.log('=====================================================\n');

  // 1. Authenticate as admin
  const loginRes = await fetch('http://localhost:5000/api/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin.demo@majesticblazer.com',
      password: 'MajesticAdmin2026!Secure',
    }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.token;

  if (!token) {
    console.error('Failed to authenticate as admin!');
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${token}` };

  const endpoints = [
    { page: 'Dashboard', url: 'http://localhost:5000/api/analytics/summary', check: (d) => d.total_revenue > 0 },
    { page: 'Dashboard (Revenue)', url: 'http://localhost:5000/api/analytics/revenue?range=30d', check: (d) => Array.isArray(d) && d.length > 0 },
    { page: 'Products', url: 'http://localhost:5000/api/products?limit=50&all=true', check: (d, meta) => Array.isArray(d) && (d.length >= 30 || meta?.total >= 30) },
    { page: 'Categories', url: 'http://localhost:5000/api/categories?includeInactive=true', check: (d) => Array.isArray(d) && d.length === 6 },
    { page: 'Inventory', url: 'http://localhost:5000/api/inventory', check: (d) => Array.isArray(d) && d.length > 50 },
    { page: 'Orders', url: 'http://localhost:5000/api/orders/all', check: (d, meta) => Array.isArray(d) && (d.length > 0 || meta?.total >= 30) },
    { page: 'Rental Bookings', url: 'http://localhost:5000/api/rentals/all', check: (d, meta) => Array.isArray(d) && (d.length > 0 || meta?.total >= 15) },
    { page: 'Customers', url: 'http://localhost:5000/api/customers', check: (d, meta) => Array.isArray(d) && (d.length > 0 || meta?.total >= 20) },
    { page: 'Payments', url: 'http://localhost:5000/api/payments/all', check: (d, meta) => Array.isArray(d) && (d.length > 0 || meta?.total > 30) },
    { page: 'Coupons', url: 'http://localhost:5000/api/coupons', check: (d) => Array.isArray(d) && d.length === 8 },
    { page: 'Reviews', url: 'http://localhost:5000/api/reviews/all', check: (d) => Array.isArray(d) && d.length >= 25 },
    { page: 'Invoices', url: 'http://localhost:5000/api/invoices/all', check: (d, meta) => Array.isArray(d) && (d.length > 0 || meta?.total > 30) },
    { page: 'Analytics (Top Products)', url: 'http://localhost:5000/api/analytics/top-products?limit=6', check: (d) => Array.isArray(d) && d.length > 0 },
    { page: 'Analytics (Categories)', url: 'http://localhost:5000/api/analytics/categories', check: (d) => Array.isArray(d) && d.length > 0 },
    { page: 'Analytics (Inventory Health)', url: 'http://localhost:5000/api/analytics/inventory-health', check: (d) => Array.isArray(d) && d.length > 0 },
    { page: 'Settings', url: 'http://localhost:5000/api/settings', check: (d) => d.store_name === 'Majestic Blazer' },
  ];

  let passed = 0;
  let failed = 0;

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, { headers });
      const json = await res.json();
      const isOk = res.status === 200 && json.success && ep.check(json.data, json.meta);
      if (isOk) {
        console.log(`✓ PASS: [${ep.page}] -> ${ep.url.replace('http://localhost:5000/api', '')} (${res.status} OK)`);
        passed++;
      } else {
        console.error(`✗ FAIL: [${ep.page}] -> ${ep.url} (${res.status}) data:`, json);
        failed++;
      }
    } catch (err) {
      console.error(`✗ ERROR: [${ep.page}] -> ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=====================================================`);
  console.log(`ADMIN ENDPOINTS AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=====================================================\n`);

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

testAllAdminEndpoints();
