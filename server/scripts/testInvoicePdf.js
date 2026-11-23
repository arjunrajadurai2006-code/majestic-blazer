import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

async function testPdf() {
  const adminToken = jwt.sign({ sub: 1, role: 'admin' }, env.jwt.secret, { expiresIn: '1h' });
  
  const allRes = await fetch('http://localhost:5000/api/invoices/all?limit=5', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const allData = await allRes.json();
  const rows = allData.data || [];
  console.log('Sample invoices retrieved from API:', rows.map(r => ({ id: r.id, number: r.invoice_number })));

  for (const inv of rows) {
    const res = await fetch(`http://localhost:5000/api/invoices/${inv.invoice_number}/pdf`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const size = (await res.arrayBuffer()).byteLength;
    const cType = res.headers.get('content-type');
    console.log(`Invoice ${inv.invoice_number} status: ${res.status}, size: ${size} bytes, type: ${cType}`);
    if (res.status !== 200 || !cType?.includes('application/pdf') || size < 1000) {
      throw new Error(`PDF download failed with status ${res.status}`);
    }
  }

  console.log('ALL INVOICE PDF GENERATION TESTS PASSED!');
  process.exit(0);
}

testPdf().catch((err) => {
  console.error('Invoice test failed:', err);
  process.exit(1);
});
