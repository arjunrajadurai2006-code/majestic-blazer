import { pool } from '../src/config/db.js';

async function reconcile() {
  try {
    console.log('=== FINANCIAL RECORD RECONCILIATION ===');
    
    // 1. Total counts
    const payCountRes = await pool.query('SELECT COUNT(*) AS total FROM payments');
    const invCountRes = await pool.query('SELECT COUNT(*) AS total FROM invoices');
    console.log(`Current Total Payments: ${payCountRes.rows[0].total}`);
    console.log(`Current Total Invoices: ${invCountRes.rows[0].total}`);

    // Invoices schema
    const colsInvoices = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'invoices'
      ORDER BY ordinal_position
    `);
    console.log('Invoices columns:', colsInvoices.rows.map(r => `${r.column_name} (${r.data_type})`));

    // 2. Payments by provider and status
    const payBreakdown = await pool.query(`
      SELECT provider, status, refund_status, COUNT(*) as cnt
      FROM payments
      GROUP BY provider, status, refund_status
      ORDER BY provider, status
    `);
    console.log('\nPayment breakdown:');
    console.table(payBreakdown.rows);

    // 3. Check for test records in payments
    const testPayments = await pool.query(`
      SELECT id, order_id, provider, provider_payment_id, amount, status, refund_status, created_at
      FROM payments
      WHERE provider_payment_id LIKE '%test%'
         OR provider_payment_id LIKE '%mock%'
         OR provider_order_id LIKE '%mock%'
         OR provider_order_id LIKE '%test%'
      ORDER BY id
    `);
    console.log(`\nPayments matching test/mock pattern: ${testPayments.rows.length}`);
    testPayments.rows.forEach(p => {
      console.log(`  ID ${p.id}: order=${p.order_id}, prov=${p.provider}, pid=${p.provider_payment_id}, amt=${p.amount}, status=${p.status}, refund_status=${p.refund_status}`);
    });

    // 4. Check for orphaned payments (order_id doesn't exist)
    const orphanedPayments = await pool.query(`
      SELECT p.id, p.order_id, p.amount, p.status
      FROM payments p
      LEFT JOIN orders o ON o.id = p.order_id
      WHERE p.order_id IS NOT NULL AND o.id IS NULL
    `);
    console.log(`\nOrphaned payments (pointing to non-existent orders): ${orphanedPayments.rows.length}`);
    orphanedPayments.rows.forEach(p => console.log(`  Payment ID ${p.id}: order_id=${p.order_id}`));

    // 5. Check payments with NULL order_id
    const nullOrderPayments = await pool.query(`
      SELECT id, provider, amount, status, created_at
      FROM payments
      WHERE order_id IS NULL
    `);
    console.log(`\nPayments with NULL order_id (direct/unlinked): ${nullOrderPayments.rows.length}`);
    nullOrderPayments.rows.forEach(p => console.log(`  Payment ID ${p.id}: provider=${p.provider}, amount=${p.amount}`));

    // 6. Check for orphaned invoices (order_id doesn't exist)
    const orphanedInvoices = await pool.query(`
      SELECT i.id, i.invoice_number, i.order_id, i.amount
      FROM invoices i
      LEFT JOIN orders o ON o.id = i.order_id
      WHERE i.order_id IS NOT NULL AND o.id IS NULL
    `);
    console.log(`\nOrphaned invoices (pointing to non-existent orders): ${orphanedInvoices.rows.length}`);
    orphanedInvoices.rows.forEach(i => console.log(`  Invoice ID ${i.id}: num=${i.invoice_number}, order_id=${i.order_id}`));

    // 7. Payment ID and date distribution
    const earliestPayments = await pool.query(`
      SELECT MIN(id) as min_id, MAX(id) as max_id, MIN(created_at) as min_created, MAX(created_at) as max_created
      FROM payments
    `);
    console.log('\nPayment span:', earliestPayments.rows[0]);

    const invoiceSpan = await pool.query(`
      SELECT MIN(id) as min_id, MAX(id) as max_id
      FROM invoices
    `);
    console.log('Invoice span:', invoiceSpan.rows[0]);

    // Let's check how many payments have ID <= 210 (historical baseline from initial database setup)
    const baselinePay = await pool.query('SELECT COUNT(*) as cnt FROM payments WHERE id <= 210');
    console.log(`\nBaseline payments (ID <= 210): ${baselinePay.rows[0].cnt}`);

    // Payments created during test runs (ID > 210)
    const testRunPay = await pool.query(`
      SELECT id, order_id, provider, amount, status, refund_status, created_at
      FROM payments WHERE id > 210 ORDER BY id
    `);
    console.log(`Payments created after baseline (ID > 210): ${testRunPay.rows.length}`);
    testRunPay.rows.forEach(p => {
      console.log(`  ID ${p.id}: order=${p.order_id}, prov=${p.provider}, amt=${p.amount}, status=${p.status}, refund_status=${p.refund_status}, date=${p.created_at}`);
    });

  } catch (err) {
    console.error('Reconciliation error:', err);
  } finally {
    await pool.end();
  }
}

reconcile();
