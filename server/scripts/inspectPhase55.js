import { pool } from '../src/config/db.js';

async function main() {
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('Tables:', tables.rows.map(r => r.table_name));

    const colsAudit = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs'
      ORDER BY ordinal_position
    `);
    console.log('Audit logs columns:', colsAudit.rows.map(r => `${r.column_name} (${r.data_type})`));

  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await pool.end();
  }
}

main();
