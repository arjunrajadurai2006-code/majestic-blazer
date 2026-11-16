import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from cwd first, then fallback to server/.env relative to this config file
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
const host = process.env.DB_HOST || process.env.PGHOST;
const user = process.env.DB_USER || process.env.PGUSER;
const database = process.env.DB_NAME || process.env.PGDATABASE;
const jwtSecret = process.env.JWT_SECRET;

const missing = [];
if (!databaseUrl && !host) missing.push('DB_HOST or DATABASE_URL');
if (!databaseUrl && !user) missing.push('DB_USER');
if (!databaseUrl && !database) missing.push('DB_NAME');
if (!jwtSecret) missing.push('JWT_SECRET');

if (missing.length) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
}
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}

const isSslRequired =
  process.env.DB_SSL === 'true' ||
  process.env.DB_SSL === '1' ||
  process.env.DB_SSL === 'require' ||
  process.env.PGSSLMODE === 'require' ||
  Boolean(host && host.includes('aivencloud.com')) ||
  Boolean(databaseUrl && databaseUrl.includes('aivencloud.com'));

let caCert = process.env.DB_SSL_CA || undefined;

// If DB_SSL_CA is base64 encoded, decode it
if (caCert && !caCert.includes('-----BEGIN CERTIFICATE-----')) {
  try {
    const decoded = Buffer.from(caCert, 'base64').toString('utf8');
    if (decoded.includes('-----BEGIN CERTIFICATE-----')) {
      caCert = decoded;
    }
  } catch {
    // leave as is
  }
}

// Fallback to reading from DB_SSL_CA_PATH
if (!caCert && process.env.DB_SSL_CA_PATH) {
  try {
    const resolvedPath = path.isAbsolute(process.env.DB_SSL_CA_PATH)
      ? process.env.DB_SSL_CA_PATH
      : path.resolve(process.cwd(), process.env.DB_SSL_CA_PATH);
    if (fs.existsSync(resolvedPath)) {
      caCert = fs.readFileSync(resolvedPath, 'utf8');
    }
  } catch (err) {
    console.warn('Warning: Failed to read DB_SSL_CA_PATH file:', err.message);
  }
}

// If CA certificate is provided, enforce strict SSL verification (rejectUnauthorized: true)
const ssl = isSslRequired
  ? {
    rejectUnauthorized: caCert ? true : process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
    ca: caCert,
  }
  : false;

// Gather allowed CORS origins from CORS_ORIGINS, CLIENT_URL, and ADMIN_URL
const rawOrigins = [
  ...(process.env.CORS_ORIGINS || '').split(','),
  process.env.CLIENT_URL || '',
  process.env.ADMIN_URL || '',
];
const corsOrigins = Array.from(
  new Set(rawOrigins.map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean))
);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || '',
  adminUrl: process.env.ADMIN_URL || '',
  corsOrigins,
  db: {
    connectionString: databaseUrl || undefined,
    host,
    port: Number(process.env.DB_PORT || process.env.PGPORT) || 5432,
    user,
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
    database,
    ssl,
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    isLive: Boolean(process.env.RAZORPAY_LIVE === 'true'),
  },
};
