// Applies database/schema.sql to the configured PostgreSQL database.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { parse as parseConnectionString } from 'pg-connection-string';
import { env } from '../src/config/env.js';

const { Client } = pg;
const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../database/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

const parsedConn = env.db.connectionString ? parseConnectionString(env.db.connectionString) : {};
const clientConfig = {
  ...parsedConn,
  ...(env.db.connectionString
    ? {}
    : {
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
    }),
  ssl: env.db.ssl,
};

const client = new Client(clientConfig);

try {
  await client.connect();
  console.log(`Connected to PostgreSQL database "${env.db.database}" at ${env.db.host}`);
  await client.query(schema);
  console.log(`Schema successfully applied to database "${env.db.database}"`);
} catch (err) {
  console.error('Failed to initialize database schema:', err);
  process.exit(1);
} finally {
  await client.end();
}
