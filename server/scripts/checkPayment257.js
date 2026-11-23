import { pool } from '../src/config/db.js';

async function checkPayment257() {
  try {
    const r = await pool.query('SELECT * FROM payments WHERE id = 257');
    console.log('Payment 257:', r.rows[0]);

    const a = await pool.query("SELECT * FROM audit_logs WHERE entity_id = '257'");
    console.log('Audit logs for 257:', a.rows);

    // Let's also check if there is an order that was deleted in test 5.5 cleanup
    const notesAudit = await pool.query("SELECT * FROM audit_logs WHERE details::text ILIKE '%Phase 5.5%'");
    console.log('Audit logs matching Phase 5.5:', notesAudit.rows.length);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkPayment257();
