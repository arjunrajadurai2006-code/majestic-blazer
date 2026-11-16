import { pool } from '../src/config/db.js';

async function cleanup() {
  try {
    const res = await pool.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'defaultdb' AND pid != pg_backend_pid() AND state = 'idle'"
    );
    console.log(`Cleaned up ${res.rowCount} idle connections.`);
  } catch (err) {
    console.error('Cleanup error:', err.message);
  } finally {
    await pool.end();
  }
}

cleanup();
