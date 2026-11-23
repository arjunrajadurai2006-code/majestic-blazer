import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// Pool configuration tuned for remote cloud database resilience (Aiven PostgreSQL over WAN)
const baseConfig = {
  // Connection pool size: conservative limit to prevent exhausting database connection quota
  max: process.env.DB_POOL_MAX ? Math.max(1, Number(process.env.DB_POOL_MAX)) : 5,

  // Idle timeout: keep warm connections alive for 30s to avoid aggressive TLS teardown and reconnection spikes
  idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT_MS ? Number(process.env.DB_IDLE_TIMEOUT_MS) : 30000,

  // Connection timeout: increased from 10000ms to 20000ms for WAN cold-start handshakes under cloud latency
  connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT_MS ? Number(process.env.DB_CONNECTION_TIMEOUT_MS) : 20000,

  // TCP keepalive: periodically probes idle sockets to prevent WAN routers, NAT firewalls, and cloud load balancers from dropping connections (ECONNRESET)
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

const poolConfig = env.db.connectionString
  ? {
    connectionString: env.db.connectionString,
    ssl: env.db.ssl,
    ...baseConfig,
  }
  : {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    ssl: env.db.ssl,
    ...baseConfig,
  };

export const pool = new Pool(poolConfig);

// Safe logging for idle client errors without crashing server process
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message || err);
});

// Attach error handler to individual clients to prevent unhandled TLS reset events (e.g. WAN ECONNRESET) from crashing the process
pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.warn('PostgreSQL client socket error (handled):', err.message || err);
  });
});

// Resilient testConnection with safe retry for cold starts (read-only idempotent query)
export async function testConnection(retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      try {
        const res = await client.query('SELECT NOW() AS now, current_database() AS db, version() AS version');
        return res.rows[0];
      } finally {
        client.release();
      }
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
