import fs from 'node:fs';
import crypto from 'node:crypto';

const files = [
  'server/src/services/webhookClaimService.js',
  'server/src/utils/webhookSchemaVerifier.js',
  'database/migrations/20261123_create_webhook_events.sql',
  'server/scripts/testPhase56AIsoSchemaV35.js',
];

console.log('=== DETERMINISTIC SHA-256 FILE HASHES ===');
for (const f of files) {
  const content = fs.readFileSync(f);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  console.log(`${f} : ${hash}`);
}
