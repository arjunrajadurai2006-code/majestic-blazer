import app from './app.js';
import { env } from './config/env.js';
import { pool, testConnection } from './config/db.js';
import { initReservationSchema, cleanupExpiredReservations } from './models/reservationModel.js';
import { initHandoffSchema } from './services/handoffService.js';

let cleanupTimer = null;

try {
  await testConnection();
  console.log('PostgreSQL connected');
  await initReservationSchema();
  await initHandoffSchema();
  // Schedule 1-minute interval for cleaning up expired inventory reservations
  cleanupTimer = setInterval(() => {
    cleanupExpiredReservations().catch((err) => console.error('Reservation cleanup error:', err.message));
  }, 60000);
} catch (err) {
  console.error('PostgreSQL connection failed:', err.message);
  if (env.isProd) {
    process.exit(1);
  } else {
    console.warn('⚠️ Server continuing in dev mode without DB. Update server/.env with your PostgreSQL credentials when ready.');
  }
}

const server = app.listen(env.port, () => console.log(`Majestic Blazer API listening on port ${env.port}`));

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${env.port} is already in use. Please terminate existing processes on port ${env.port}.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

const shutdown = () => {
  if (cleanupTimer) clearInterval(cleanupTimer);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
