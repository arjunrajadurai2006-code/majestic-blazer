import http from 'http';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/db.js';

function generateTestToken(userId, role = 'customer') {
  return jwt.sign({ sub: userId, role }, env.jwt.secret, { expiresIn: '1h' });
}

async function runSecurityTests() {
  console.log('================================================================');
  console.log('MAJESTIC BLAZER — INVOICE IDOR SECURITY TEST SUITE');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const API_BASE = `http://localhost:${port}/api`;
  console.log(`Ephemeral test HTTP server listening on port ${port}\n`);

  // Query dynamic invoice and user IDs from database
  const { rows: invOrderRows } = await pool.query(
    `SELECT i.id, i.invoice_number, o.user_id 
     FROM invoices i 
     JOIN orders o ON o.id = i.order_id 
     ORDER BY i.id ASC LIMIT 3`
  );
  const invA = invOrderRows[0];
  const invB = invOrderRows[1];
  const invC = invOrderRows[2] || invOrderRows[1];
  const userA_id = invA ? invA.user_id : 20;
  const userB_id = invB ? invB.user_id : 30;
  const userC_id = invC ? invC.user_id : 31;

  const tokenCustomerA = generateTestToken(userA_id, 'customer');
  const tokenCustomerB = generateTestToken(userB_id, 'customer');
  const tokenCustomerC = generateTestToken(userC_id, 'customer');
  const tokenAdmin = generateTestToken(1, 'admin');
  const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature';

  const invoiceA_Id = invA ? invA.id : 45;
  const invoiceA_Number = invA ? invA.invoice_number : 'INV-2026-7101';
  const invoiceB_Id = invB ? invB.id : 46;
  const invoiceB_Number = invB ? invB.invoice_number : 'INV-2026-7102';
  const invoiceC_Id = invC ? invC.id : 47;
  const nonExistentId = 999999;
  const nonExistentNumber = 'INV-9999-9999';

  let passCount = 0;
  let failCount = 0;

  function assertTest(testName, passed, details = '') {
    if (passed) {
      console.log(`[PASS] ${testName}`);
      if (details) console.log(`       Details: ${details}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       Details: ${details}`);
      failCount++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Anonymous invoice download -> 401 Unauthorized
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${API_BASE}/invoices/${invoiceA_Id}/pdf`);
    const is401 = res.status === 401;
    const body = await res.json().catch(() => ({}));
    assertTest(
      'Test 1: Anonymous invoice download received HTTP 401',
      is401,
      `Status: ${res.status}, Message: "${body.message}"`
    );
  } catch (err) {
    assertTest('Test 1: Anonymous invoice download received HTTP 401', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Customer A downloading Customer A invoice -> HTTP 200 Success
  // -------------------------------------------------------------------------
  try {
    // Via Authorization header
    const resHeader = await fetch(`${API_BASE}/invoices/${invoiceA_Id}/pdf`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const cType = resHeader.headers.get('content-type');
    const disp = resHeader.headers.get('content-disposition');
    const buffer = await resHeader.arrayBuffer();
    const validPdf = resHeader.status === 200 && cType?.includes('application/pdf') && buffer.byteLength > 1000;

    // Via query token (?token=...)
    const resQuery = await fetch(`${API_BASE}/invoices/${invoiceA_Number}/pdf?token=${encodeURIComponent(tokenCustomerA)}`);
    const validPdfQuery = resQuery.status === 200 && resQuery.headers.get('content-type')?.includes('application/pdf');

    assertTest(
      'Test 2: Customer A downloading Customer A invoice succeeds (Header & Query token)',
      validPdf && validPdfQuery,
      `Header Status: ${resHeader.status} (${buffer.byteLength} bytes, disp: ${disp}), Query Status: ${resQuery.status}`
    );
  } catch (err) {
    assertTest('Test 2: Customer A downloading Customer A invoice succeeds', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Customer A downloading Customer B invoice -> HTTP 403 Forbidden
  // -------------------------------------------------------------------------
  try {
    // Attempt by numeric ID
    const resNumeric = await fetch(`${API_BASE}/invoices/${invoiceB_Id}/pdf`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const bodyNumeric = await resNumeric.json().catch(() => ({}));

    // Attempt by invoice number
    const resString = await fetch(`${API_BASE}/invoices/${invoiceB_Number}/pdf`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const bodyString = await resString.json().catch(() => ({}));

    const denied = resNumeric.status === 403 && resString.status === 403;
    assertTest(
      'Test 3: Customer A downloading Customer B invoice is DENIED (HTTP 403)',
      denied,
      `Numeric ID 46: HTTP ${resNumeric.status} ("${bodyNumeric.message}"), String ID ${invoiceB_Number}: HTTP ${resString.status} ("${bodyString.message}")`
    );
  } catch (err) {
    assertTest('Test 3: Customer A downloading Customer B invoice is DENIED', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Customer B downloading Customer A invoice -> HTTP 403 Forbidden
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${API_BASE}/invoices/${invoiceA_Id}/pdf`, {
      headers: { Authorization: `Bearer ${tokenCustomerB}` },
    });
    const body = await res.json().catch(() => ({}));
    assertTest(
      'Test 4: Customer B downloading Customer A invoice is DENIED (HTTP 403)',
      res.status === 403,
      `Status: ${res.status}, Message: "${body.message}"`
    );
  } catch (err) {
    assertTest('Test 4: Customer B downloading Customer A invoice is DENIED', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Invalid invoice ID -> HTTP 404 Not Found
  // -------------------------------------------------------------------------
  try {
    const resNumeric = await fetch(`${API_BASE}/invoices/${nonExistentId}/pdf`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const bodyNumeric = await resNumeric.json().catch(() => ({}));

    const resString = await fetch(`${API_BASE}/invoices/${nonExistentNumber}/pdf`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const bodyString = await resString.json().catch(() => ({}));

    const is404 = resNumeric.status === 404 && resString.status === 404;
    assertTest(
      'Test 5: Non-existent invoice returns HTTP 404 Not Found',
      is404,
      `Numeric 999999: HTTP ${resNumeric.status} ("${bodyNumeric.message}"), String ${nonExistentNumber}: HTTP ${resString.status} ("${bodyString.message}")`
    );
  } catch (err) {
    assertTest('Test 5: Non-existent invoice returns HTTP 404', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Administrator downloading authorized invoice -> HTTP 200 Success
  // -------------------------------------------------------------------------
  try {
    // Admin downloading Customer A invoice
    const resA = await fetch(`${API_BASE}/invoices/${invoiceA_Id}/pdf`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const bufferA = await resA.arrayBuffer();

    // Admin downloading Customer B invoice
    const resB = await fetch(`${API_BASE}/invoices/${invoiceB_Id}/pdf`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const bufferB = await resB.arrayBuffer();

    // Admin downloading via query token
    const resQuery = await fetch(`${API_BASE}/invoices/${invoiceA_Number}/pdf?token=${encodeURIComponent(tokenAdmin)}`);
    const bufferQuery = await resQuery.arrayBuffer();

    const adminSuccess = resA.status === 200 && bufferA.byteLength > 1000 &&
                         resB.status === 200 && bufferB.byteLength > 1000 &&
                         resQuery.status === 200 && bufferQuery.byteLength > 1000;

    assertTest(
      'Test 6: Administrator can download all invoices (Customer A, Customer B, Query token)',
      adminSuccess,
      `Customer A inv: ${resA.status} (${bufferA.byteLength} bytes), Customer B inv: ${resB.status} (${bufferB.byteLength} bytes), Query inv: ${resQuery.status} (${bufferQuery.byteLength} bytes)`
    );
  } catch (err) {
    assertTest('Test 6: Administrator can download all invoices', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Invalid authentication token -> HTTP 401 Unauthorized
  // -------------------------------------------------------------------------
  try {
    const resHeader = await fetch(`${API_BASE}/invoices/${invoiceA_Id}/pdf`, {
      headers: { Authorization: `Bearer ${invalidToken}` },
    });
    const bodyHeader = await resHeader.json().catch(() => ({}));

    const resQuery = await fetch(`${API_BASE}/invoices/${invoiceA_Id}/pdf?token=${encodeURIComponent(invalidToken)}`);
    const bodyQuery = await resQuery.json().catch(() => ({}));

    const invalidBlocked = resHeader.status === 401 && resQuery.status === 401;
    assertTest(
      'Test 7: Invalid authentication token strictly returns HTTP 401 (Header & Query)',
      invalidBlocked,
      `Header Status: ${resHeader.status} ("${bodyHeader.message}"), Query Status: ${resQuery.status} ("${bodyQuery.message}")`
    );
  } catch (err) {
    assertTest('Test 7: Invalid authentication token returns HTTP 401', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Customer cannot bypass ownership using modified URL parameters
  // -------------------------------------------------------------------------
  try {
    // Customer A attempts to access Customer B's invoice by appending spoofed query parameters
    const spoofAttempts = [
      `?userId=20`,
      `?user_id=20`,
      `?customerId=20`,
      `?customer_id=20`,
      `?orderId=26`,
      `?role=admin`,
      `?admin=true`,
      `?override=1`
    ];

    let allSpoofsBlocked = true;
    const spoofResults = [];

    for (const spoof of spoofAttempts) {
      const res = await fetch(`${API_BASE}/invoices/${invoiceB_Id}/pdf${spoof}`, {
        headers: { Authorization: `Bearer ${tokenCustomerA}` },
      });
      if (res.status !== 403) {
        allSpoofsBlocked = false;
      }
      spoofResults.push(`${spoof} => HTTP ${res.status}`);
    }

    assertTest(
      'Test 8: Customer cannot bypass ownership using modified URL parameters (All 8 spoofs blocked with HTTP 403)',
      allSpoofsBlocked,
      `Results: ${spoofResults.slice(0, 4).join(', ')} ...`
    );
  } catch (err) {
    assertTest('Test 8: Customer cannot bypass ownership using modified URL parameters', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 9: Invoice JSON metadata endpoint (GET /api/invoices/:id) IDOR protection
  // -------------------------------------------------------------------------
  try {
    // Customer A accessing Customer B's invoice JSON metadata
    const resCross = await fetch(`${API_BASE}/invoices/${invoiceB_Id}`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const bodyCross = await resCross.json().catch(() => ({}));

    // Anonymous accessing invoice JSON metadata
    const resAnon = await fetch(`${API_BASE}/invoices/${invoiceA_Id}`);
    const bodyAnon = await resAnon.json().catch(() => ({}));

    // Customer A accessing Customer A's invoice JSON metadata
    const resOwn = await fetch(`${API_BASE}/invoices/${invoiceA_Id}`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });
    const bodyOwn = await resOwn.json().catch(() => ({}));

    const jsonSecure = resCross.status === 403 && resAnon.status === 401 && resOwn.status === 200 && Boolean(bodyOwn.data?.invoice_number);

    assertTest(
      'Test 9: Invoice JSON endpoint (/api/invoices/:id) enforces strict IDOR protection',
      jsonSecure,
      `Cross-access: HTTP ${resCross.status} (403), Anon: HTTP ${resAnon.status} (401), Own: HTTP ${resOwn.status} (${JSON.stringify(bodyOwn)})`
    );
  } catch (err) {
    assertTest('Test 9: Invoice JSON endpoint enforces strict IDOR protection', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Multi-customer invoice ownership & IDOR boundary protection
  // -------------------------------------------------------------------------
  try {
    // Customer C (owner) downloading invoice C -> 200
    const resInvoiceCOwner = await fetch(`${API_BASE}/invoices/${invoiceC_Id}/pdf`, {
      headers: { Authorization: `Bearer ${tokenCustomerC}` },
    });
    const bufferC = await resInvoiceCOwner.arrayBuffer();
    const ownerOk = resInvoiceCOwner.status === 200 && bufferC.byteLength > 1000;

    // Customer A (non-owner) attempting to download invoice C -> 403 (or 200 if userA == userC)
    const resUnauthorized = await fetch(`${API_BASE}/invoices/${invoiceC_Id}/pdf`, {
      headers: { Authorization: `Bearer ${tokenCustomerA}` },
    });

    // Admin downloading invoice C -> 200
    const resAdmin = await fetch(`${API_BASE}/invoices/${invoiceC_Id}/pdf`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });

    const passed = ownerOk && (userA_id === userC_id || resUnauthorized.status === 403) && resAdmin.status === 200;
    assertTest(
      'Test 10: Multi-customer invoice ownership & IDOR boundary protection (Owner: 200, Cross-Customer: 403, Admin: 200)',
      passed,
      `Owner: HTTP ${resInvoiceCOwner.status} (${bufferC.byteLength} bytes), Non-owner: HTTP ${resUnauthorized.status}, Admin: HTTP ${resAdmin.status}`
    );
  } catch (err) {
    assertTest('Test 10: Multi-customer invoice ownership & IDOR boundary protection', false, err.message);
  }

  console.log('\n================================================================');
  console.log(`SECURITY TESTS COMPLETED: ${passCount + failCount}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log('================================================================\n');

  server.close();
  await pool.end();
  process.exit(failCount === 0 ? 0 : 1);
}

runSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
