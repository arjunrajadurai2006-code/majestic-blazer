import crypto from 'node:crypto';
import { pool } from '../src/config/db.js';

async function main() {
  try {
    console.log('=== 1. ORDERS MONETARY COLUMNS ===');
    const ordersCol = await pool.query(`
      SELECT column_name, data_type, udt_name, numeric_precision, numeric_scale, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name IN ('total', 'subtotal', 'discount', 'tax', 'shipping_fee')
      ORDER BY ordinal_position;
    `);
    console.log(JSON.stringify(ordersCol.rows, null, 2));

    console.log('\n=== 2. PAYMENTS COLUMNS & ENUMS ===');
    const paymentCols = await pool.query(`
      SELECT column_name, data_type, udt_name, numeric_precision, numeric_scale, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'payments'
      ORDER BY ordinal_position;
    `);
    console.log(JSON.stringify(paymentCols.rows, null, 2));

    const paymentEnums = await pool.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'payment_status'
      ORDER BY enumsortorder;
    `);
    console.log('payment_status enum labels:', paymentEnums.rows.map(r => r.enumlabel));

    const providerEnums = await pool.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'payment_provider'
      ORDER BY enumsortorder;
    `);
    console.log('payment_provider enum labels:', providerEnums.rows.map(r => r.enumlabel));

    console.log('\n=== 3. WEBHOOK-RELATED TABLES & CONSTRAINTS ===');
    const webhookTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name ILIKE '%webhook%';
    `);
    console.log('webhook tables:', webhookTables.rows);

    const webhookConstraints = await pool.query(`
      SELECT conname, contype, conrelid::regclass AS table_name
      FROM pg_constraint
      WHERE conname ILIKE '%webhook%';
    `);
    console.log('webhook constraints:', webhookConstraints.rows);

    console.log('\n=== 4. HISTORICAL FINANCIAL RECORDS (56 BASELINE) FINGERPRINT ===');
    const allPayments = await pool.query(`
      SELECT id, order_id, amount, status, provider, provider_payment_id, created_at
      FROM payments
      ORDER BY id ASC;
    `);
    console.log(`Total payment rows retrieved: ${allPayments.rows.length}`);
    
    // Baseline payments are the historical pre-test records (ids <= 210, total 56 records)
    const baselinePayments = allPayments.rows.filter(r => r.id <= 210);
    console.log(`Baseline historical payments count (id <= 210): ${baselinePayments.length}`);
    console.log('Baseline payment IDs:', baselinePayments.map(r => r.id));

    // Compute deterministic SHA-256 fingerprint of the 56 baseline records
    const hash = crypto.createHash('sha256');
    for (const row of baselinePayments) {
      hash.update(`${row.id}|${row.order_id}|${row.amount}|${row.status}|${row.provider}|${row.provider_payment_id}\n`);
    }
    const fingerprint = hash.digest('hex');
    console.log('Baseline 56 Payments SHA-256 Fingerprint:', fingerprint);

    const totalPayments = await pool.query(`SELECT count(*)::int AS total FROM payments;`);
    console.log('Total current payments:', totalPayments.rows[0].total);

    const totalInvoices = await pool.query(`SELECT count(*)::int AS total FROM invoices;`);
    console.log('Total current invoices:', totalInvoices.rows[0].total);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
