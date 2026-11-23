import { pool } from '../src/config/db.js';

async function main() {
  try {
    const col = await pool.query(`
      SELECT column_name, data_type, udt_name, numeric_precision, numeric_scale 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name IN ('total', 'subtotal', 'discount', 'tax', 'shipping_fee')
    `);
    console.log('orders monetary columns:', col.rows);

    const webhookTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE '%webhook%'
    `);
    console.log('webhook tables:', webhookTables.rows);

    const auditActions = await pool.query(`
      SELECT DISTINCT action 
      FROM audit_logs 
      WHERE action LIKE '%WEBHOOK%'
    `);
    console.log('audit webhook actions:', auditActions.rows);

    const paymentCols = await pool.query(`
      SELECT column_name, data_type, udt_name, numeric_precision, numeric_scale
      FROM information_schema.columns 
      WHERE table_name = 'payments'
      ORDER BY ordinal_position
    `);
    console.log('payments columns:', paymentCols.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
