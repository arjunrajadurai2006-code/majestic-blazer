import app from './app.js';
import { env } from './config/env.js';
import { pool, testConnection } from './config/db.js';

try {
  await testConnection();
  console.log('PostgreSQL connected');
} catch (err) {
  console.error('PostgreSQL connection failed:', err.message);
  process.exit(1);
}

const server = app.listen(env.port, () => console.log(`Majestic Blazer API listening on port ${env.port}`));

const shutdown = () => server.close(async () => { await pool.end(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
