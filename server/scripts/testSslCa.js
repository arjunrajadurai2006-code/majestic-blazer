import pg from 'pg';
import fs from 'fs';
import 'dotenv/config';

const { Pool } = pg;

async function testSsl() {
  const ca = fs.readFileSync('aiven-ca.pem', 'utf8');
  console.log('Testing pg connection with rejectUnauthorized: true and Aiven CA...');
  
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
      rejectUnauthorized: true,
      ca: ca,
    },
  });

  const client = await pool.connect();
  const res = await client.query('SELECT current_database(), version()');
  console.log('SUCCESS! Verified connection with Aiven CA certificate:');
  console.log('Database:', res.rows[0].current_database);
  console.log('Version:', res.rows[0].version);
  client.release();
  await pool.end();
}

testSsl().catch(err => {
  console.error('FAILED SSL test:', err);
  process.exit(1);
});

