// Native Node 18+ fetch and FormData

const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('--- ADMIN SECURITY & RBAC AUDIT ---');

  // 1. Obtain Admin Token via demo admin login
  const adminLoginRes = await fetch(`${BASE_URL}/auth/demo-admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.data?.token;

  if (!adminToken) {
    console.error('Failed to get admin token:', adminData);
    process.exit(1);
  }

  // 2. Obtain Customer Token via demo customer login
  const customerLoginRes = await fetch(`${BASE_URL}/auth/demo-customer-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const customerData = await customerLoginRes.json();
  const customerToken = customerData.data?.token;

  if (!customerToken) {
    console.error('Failed to get customer token:', customerData);
    process.exit(1);
  }

  console.log('✓ Tokens acquired (Admin & Customer)');

  // 3. Define Strictly Admin-Only Endpoints to Test (Read-Only)
  const endpoints = [
    { name: 'Analytics Summary', method: 'GET', url: '/analytics/summary' },
    { name: 'Analytics Revenue', method: 'GET', url: '/analytics/revenue' },
    { name: 'Analytics Top Products', method: 'GET', url: '/analytics/top-products' },
    { name: 'Analytics Categories', method: 'GET', url: '/analytics/categories' },
    { name: 'Analytics Inventory Health', method: 'GET', url: '/analytics/inventory-health' },
    { name: 'Inventory List', method: 'GET', url: '/inventory' },
    { name: 'Orders List All', method: 'GET', url: '/orders/all' },
    { name: 'Rentals List All', method: 'GET', url: '/rentals/all' },
    { name: 'Customers Directory', method: 'GET', url: '/customers' },
    { name: 'Payments Ledger', method: 'GET', url: '/payments/all' },
    { name: 'Coupons List', method: 'GET', url: '/coupons' },
    { name: 'Reviews List All', method: 'GET', url: '/reviews/all' },
    { name: 'Invoices Archive All', method: 'GET', url: '/invoices/all' },
  ];

  let unauthPass = 0;
  let customerForbiddenPass = 0;
  let adminAuthorizedPass = 0;

  console.log(`\nTesting ${endpoints.length} admin-only endpoints across 3 security tiers:`);

  for (const ep of endpoints) {
    // A. Unauthenticated Request -> Expect 401
    const unauthRes = await fetch(`${BASE_URL}${ep.url}`, {
      method: ep.method,
      headers: { 'Content-Type': 'application/json' },
    });
    if (unauthRes.status === 401) {
      unauthPass++;
    } else {
      console.error(`  FAIL [Unauth]: ${ep.name} (${ep.method} ${ep.url}) returned ${unauthRes.status} (expected 401)`);
    }

    // B. Customer Authenticated Request -> Expect 403
    const custRes = await fetch(`${BASE_URL}${ep.url}`, {
      method: ep.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
    });
    if (custRes.status === 403) {
      customerForbiddenPass++;
    } else {
      console.error(`  FAIL [Customer RBAC]: ${ep.name} (${ep.method} ${ep.url}) returned ${custRes.status} (expected 403)`);
    }

    // C. Admin Authenticated Request -> Expect 200
    const adminRes = await fetch(`${BASE_URL}${ep.url}`, {
      method: ep.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });
    if (adminRes.status === 200) {
      adminAuthorizedPass++;
    } else {
      console.error(`  FAIL [Admin Auth]: ${ep.name} (${ep.method} ${ep.url}) returned ${adminRes.status} (expected 200)`);
    }
  }

  console.log(`✓ Unauthenticated 401 Protection: ${unauthPass}/${endpoints.length} passed`);
  console.log(`✓ Customer RBAC 403 Rejection: ${customerForbiddenPass}/${endpoints.length} passed`);
  console.log(`✓ Admin Authorized Access: ${adminAuthorizedPass}/${endpoints.length} passed`);

  // 4. File Upload Security Audit
  console.log('\n--- FILE UPLOAD SECURITY AUDIT ---');
  let uploadTestsPassed = 0;

  // 4a. Upload without token -> 401
  const formUnauth = new FormData();
  const blob = new Blob(['fake image content'], { type: 'image/png' });
  formUnauth.append('image', blob, 'test.png');
  const uploadUnauthRes = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    body: formUnauth,
  });
  if (uploadUnauthRes.status === 401) {
    console.log('✓ Unauthenticated file upload blocked (401)');
    uploadTestsPassed++;
  } else {
    console.error(`FAIL: Unauth upload returned ${uploadUnauthRes.status}`);
  }

  // 4b. Upload with customer token -> 403
  const formCustomer = new FormData();
  formCustomer.append('image', blob, 'test.png');
  const uploadCustRes = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: formCustomer,
  });
  if (uploadCustRes.status === 403) {
    console.log('✓ Customer token upload blocked (403 Forbidden)');
    uploadTestsPassed++;
  } else {
    console.error(`FAIL: Customer upload returned ${uploadCustRes.status}`);
  }

  // 4c. Upload malicious/non-image mime type with admin token -> 400
  const formMalicious = new FormData();
  const scriptBlob = new Blob(['console.log("malicious")'], { type: 'application/javascript' });
  formMalicious.append('image', scriptBlob, 'exploit.js');
  const uploadMaliciousRes = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: formMalicious,
  });
  if (uploadMaliciousRes.status === 400) {
    console.log('✓ Non-image MIME type rejected (400 Bad Request)');
    uploadTestsPassed++;
  } else {
    console.error(`FAIL: Malicious mime upload returned ${uploadMaliciousRes.status}`);
  }

  console.log(`\nAudit Complete: All ${endpoints.length * 3 + 3} security assertions executed.`);
}

main().catch(err => {
  console.error('Fatal security audit error:', err);
  process.exit(1);
});
