import { pool } from '../src/config/db.js';

async function main() {
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables:', tables.rows.map(r => r.table_name));

    const auditColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs'
      ORDER BY ordinal_position;
    `);
    console.log('audit_logs columns:', auditColumns.rows);

    const auditIndexes = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'audit_logs';
    `);
    console.log('audit_logs indexes:', auditIndexes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
