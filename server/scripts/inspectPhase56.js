import { pool } from '../src/config/db.js';

async function main() {
  try {
    console.log('=== COD PAYMENTS & LINKED ORDERS INSPECTION ===');
    const codRows = await pool.query(`
      SELECT 
        p.id AS payment_id,
        p.order_id,
        p.provider,
        p.provider_payment_id,
        p.amount,
        p.status AS payment_status,
        p.refund_status,
        p.created_at AS payment_created_at,
        o.order_number,
        o.status AS order_status,
        o.total AS order_total,
        o.created_at AS order_created_at
      FROM payments p
      LEFT JOIN orders o ON o.id = p.order_id
      WHERE p.provider = 'cod'
      ORDER BY p.id ASC
    `);

    console.table(codRows.rows.map(r => ({
      p_id: r.payment_id,
      ord_id: r.order_id,
      ord_num: r.order_number,
      amt: r.amount,
      p_status: r.payment_status,
      o_status: r.order_status,
      ref_status: r.refund_status,
      date: r.payment_created_at ? new Date(r.payment_created_at).toISOString().split('T')[0] : null
    })));

    console.log('\n=== ALL PAYMENTS SUMMARY ===');
    const allPaySummary = await pool.query(`
      SELECT 
        CASE WHEN id <= 210 THEN 'Historical (<=210)' ELSE 'Post-Baseline (>210)' END as cohort,
        provider,
        status,
        refund_status,
        COUNT(*) as cnt
      FROM payments
      GROUP BY 1, 2, 3, 4
      ORDER BY 1, 2, 3
    `);
    console.table(allPaySummary.rows);

    const totalPay = await pool.query('SELECT COUNT(*) FROM payments');
    const totalInv = await pool.query('SELECT COUNT(*) FROM invoices');
    const totalOrd = await pool.query('SELECT COUNT(*) FROM orders');
    console.log(`Totals -> Payments: ${totalPay.rows[0].count}, Invoices: ${totalInv.rows[0].count}, Orders: ${totalOrd.rows[0].count}`);

  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await pool.end();
  }
}

main();
