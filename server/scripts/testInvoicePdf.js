import { pool } from '../src/config/db.js';
import http from 'http';

async function testPdf() {
  const { rows } = await pool.query('SELECT invoice_number, order_id, rental_booking_id FROM invoices LIMIT 5');
  console.log('Sample invoices in DB:', rows);

  for (const inv of rows) {
    await new Promise((resolve, reject) => {
      const req = http.get(`http://localhost:5000/api/invoices/${inv.invoice_number}/pdf`, (res) => {
        let size = 0;
        res.on('data', (c) => size += c.length);
        res.on('end', () => {
          console.log(`Invoice ${inv.invoice_number} (Order: ${inv.order_id}, Rental: ${inv.rental_booking_id}) status: ${res.statusCode}, size: ${size} bytes, type: ${res.headers['content-type']}`);
          if (res.statusCode === 200 && res.headers['content-type'] === 'application/pdf' && size > 1000) {
            resolve();
          } else {
            reject(new Error(`PDF download failed with status ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
    });
  }

  console.log('ALL INVOICE PDF GENERATION TESTS PASSED!');
  await pool.end();
  process.exit(0);
}

testPdf().catch((err) => {
  console.error('Invoice test failed:', err);
  process.exit(1);
});
