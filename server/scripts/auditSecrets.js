import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('=== MAJESTIC BLAZER SECURITY & SECRET AUDIT ===\n');

// 1. Audit Git History
try {
  const gitLog = execSync('git log -p', { maxBuffer: 30 * 1024 * 1024, encoding: 'utf8' });

  const historyPatterns = [
    { category: 'Aiven DB Credentials / Connection String', pattern: /postgres(?:ql)?:\/\/[a-zA-Z0-9_\-]+:[^@\s"']+@[a-zA-Z0-9_\-\.]+\.aivencloud\.com/i },
    { category: 'Aiven / PostgreSQL Password', pattern: /DB_PASSWORD\s*=\s*['"]?[a-zA-Z0-9_\-!@#$%^&*()+=]{8,}['"]?/i },
    { category: 'Hardcoded Production JWT Secret', pattern: /JWT_SECRET\s*=\s*['"]?[a-zA-Z0-9_\-!@#$%^&*()+=]{20,}['"]?/i },
    { category: 'Razorpay Secret Key', pattern: /rzp_(?:live|test)_[a-zA-Z0-9]{14,}/i },
    { category: 'RSA / SSH Private Key', pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/i },
    { category: 'Cloud API Key / Token', pattern: /(?:AIza[0-9A-Za-z-_]{35}|ghp_[0-9a-zA-Z]{36})/i }
  ];

  console.log('--- 1. Scanning Git Commit History (2 commits) ---');
  let historyLeaks = 0;
  for (const { category, pattern } of historyPatterns) {
    if (pattern.test(gitLog)) {
      console.log(`[ALERT] Potential secret pattern matched in Git history: ${category}`);
      historyLeaks++;
    } else {
      console.log(`[PASS] No matches in Git history for: ${category}`);
    }
  }
} catch (e) {
  console.error('Error running git log:', e.message);
}

// 2. Audit All Tracked Files in Git
console.log('\n--- 2. Scanning All Tracked Files in Repository ---');
const trackedFiles = execSync('git ls-files', { encoding: 'utf8' }).split('\n').map(s => s.trim()).filter(Boolean);

let trackedLeaks = 0;
for (const file of trackedFiles) {
  if (!fs.existsSync(file)) continue;
  if (file.match(/\.(png|jpg|jpeg|webp|ico|svg|pdf)$/i)) continue; // skip binary media

  const content = fs.readFileSync(file, 'utf8');

  // Check for credentials
  if (content.match(/postgres(?:ql)?:\/\/[a-zA-Z0-9_\-]+:[^@\s"']+@[a-zA-Z0-9_\-\.]+\.aivencloud\.com/i)) {
    console.log(`[ALERT] Real DB connection URI found in tracked file: ${file}`);
    trackedLeaks++;
  }
  if (file.endsWith('.env')) {
    console.log(`[ALERT] Active .env file tracked in git: ${file}`);
    trackedLeaks++;
  }
}

if (trackedLeaks === 0) {
  console.log('[PASS] Zero active .env files or real database connection strings in tracked repository files.');
}

console.log('\n=== AUDIT SCRIPT COMPLETE ===');

