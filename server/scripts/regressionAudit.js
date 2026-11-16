import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const API_BASE = 'http://localhost:5000/api';

async function runRegressionAudit() {
  console.log('====================================================');
  console.log('MAJESTIC BLAZER — COMPREHENSIVE REGRESSION AUDIT');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function report(name, isSuccess, details = '') {
    if (isSuccess) {
      console.log(`[PASS] ${name}${details ? ` (${details})` : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}: ${details}`);
      failed++;
    }
  }

  // 1. Inquiry Form Submission API
  try {
    const res = await fetch(`${API_BASE}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Regression Patron',
        email: 'patron.audit@majesticblazer.com',
        phone: '8903238882',
        subject: 'bespoke',
        preferredDate: '2027-02-14',
        message: 'Requesting luxury velvet consultation.',
      }),
    });
    const data = await res.json();
    report('Inquiry Form Submission API', res.status === 201, `Ticket reference: ${data.data?.ticketNumber || 'OK'}`);
  } catch (err) {
    report('Inquiry Form Submission API', false, err.message);
  }

  // 2. Demo Customer Seed & Login
  let customerToken = null;
  let customerUser = null;
  try {
    // Call GET /auth/demo-customer to seed/ensure demo customer exists
    const demoCustRes = await fetch(`${API_BASE}/auth/demo-customer`);
    const demoCustData = await demoCustRes.json();
    const demoEmail = demoCustData.data?.email || 'customer.demo@majesticblazer.com';
    const demoPassword = demoCustData.data?.password || 'CustomerDemo2026!';

    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: demoEmail,
        password: demoPassword,
      }),
    });
    const loginData = await loginRes.json();
    customerToken = loginData.data?.token;
    customerUser = loginData.data?.user;
    report('Customer Demo Login', Boolean(customerToken), `Authenticated as ${customerUser?.fullName} (${customerUser?.role})`);
  } catch (err) {
    report('Customer Demo Login', false, err.message);
  }

  // 3. Customer Session Restoration (/api/auth/me)
  try {
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const meData = await meRes.json();
    const userEmail = meData.data?.user?.email;
    report('Customer Session Restoration', meRes.status === 200 && userEmail === 'customer.demo@majesticblazer.com', `Restored user: ${userEmail}`);
  } catch (err) {
    report('Customer Session Restoration', false, err.message);
  }

  // 4. Demo Admin Seed & Login
  let adminToken = null;
  let adminUser = null;
  try {
    // Call GET /auth/demo-admin to seed/ensure demo admin exists
    const demoAdminRes = await fetch(`${API_BASE}/auth/demo-admin`);
    const demoAdminData = await demoAdminRes.json();
    const demoEmail = demoAdminData.data?.email || 'admin.demo@majesticblazer.com';
    const demoPassword = demoAdminData.data?.password || 'MajesticAdmin2026!Secure';

    const adminLoginRes = await fetch(`${API_BASE}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: demoEmail,
        password: demoPassword,
      }),
    });
    const adminData = await adminLoginRes.json();
    adminToken = adminData.data?.token;
    adminUser = adminData.data?.user;
    report('Admin Demo Login', Boolean(adminToken) && adminUser?.role === 'admin', `Authenticated as ${adminUser?.fullName} (${adminUser?.role})`);
  } catch (err) {
    report('Admin Demo Login', false, err.message);
  }

  // 5. Admin Session Restoration & Dashboard Analytics Access
  try {
    const analyticsRes = await fetch(`${API_BASE}/analytics/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const analyticsData = await analyticsRes.json();
    const totalOrders = analyticsData.data?.totalOrders;
    report('Admin Session Restoration & Dashboard Analytics', analyticsRes.status === 200 && totalOrders !== undefined, `Total Orders: ${totalOrders}`);
  } catch (err) {
    report('Admin Session Restoration & Dashboard Analytics', false, err.message);
  }

  // 6. Customer / Admin Permission Separation (RBAC Verification)
  try {
    // Attempt to access admin analytics with customer token -> Expect 403 Forbidden
    const deniedRes = await fetch(`${API_BASE}/analytics/summary`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const isForbidden = deniedRes.status === 403;
    report('Permission Separation: Customer blocked from Admin APIs', isForbidden, `Status: ${deniedRes.status} Forbidden (Secured)`);
  } catch (err) {
    report('Permission Separation: Customer blocked from Admin APIs', false, err.message);
  }

  // 7. Verify Image Assets on Disk
  try {
    const clientAssetsDir = path.resolve(rootDir, '../client/public/assets');
    const heroImage = path.join(clientAssetsDir, 'hero/luxury-menswear-hero.webp');
    const logoImage = path.resolve(rootDir, '../client/src/assets/majestic-blazer-logo.jpeg');
    const productsDir = path.join(clientAssetsDir, 'products');

    const heroExists = fs.existsSync(heroImage);
    const logoExists = fs.existsSync(logoImage);
    const productCount = fs.existsSync(productsDir) ? fs.readdirSync(productsDir).length : 0;

    const allAssetsPresent = heroExists && logoExists && productCount >= 10;
    report('Image Assets Integrity', allAssetsPresent, `Hero: ${heroExists}, Logo: ${logoExists}, Product Images: ${productCount}`);
  } catch (err) {
    report('Image Assets Integrity', false, err.message);
  }

  // 8. Catalog Data & Public API Availability
  try {
    const productsRes = await fetch(`${API_BASE}/products?limit=12`);
    const productsData = await productsRes.json();
    const productList = productsData.data || productsData;
    const total = productList.length;
    const firstProduct = productList[0];
    report('Catalog Listing & API Availability', total > 0, `Returned ${total} blazers; sample: ${firstProduct?.name}`);
  } catch (err) {
    report('Catalog Listing & API Availability', false, err.message);
  }

  // 9. Rental Check Availability API
  try {
    const rentRes = await fetch(`${API_BASE}/rentals/check?productId=8&variantId=23&startDate=2027-04-10&endDate=2027-04-12`);
    const rentData = await rentRes.json();
    const avail = rentData.data?.available;
    const totalAmt = rentData.data?.totalAmount || (Number(rentData.data?.rentAmount) + Number(rentData.data?.depositAmount));
    report('Rental Availability Check API', rentRes.status === 200 && avail, `Available: ${avail}, Total: ₹${totalAmt}`);
  } catch (err) {
    report('Rental Availability Check API', false, err.message);
  }

  console.log('\n====================================================');
  console.log(`REGRESSION AUDIT SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionAudit();
