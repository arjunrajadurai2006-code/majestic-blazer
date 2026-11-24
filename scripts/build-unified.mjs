import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const clientDist = path.resolve(rootDir, 'client', 'dist');
const adminDist = path.resolve(rootDir, 'admin', 'dist');

console.log('=== Building Majestic Blazer Unified Vercel Deployment ===');

// 1. Build Client
console.log('\n[1/3] Building Customer Storefront (client)...');
execSync('npm --prefix client run build', { stdio: 'inherit', cwd: rootDir });

// 2. Build Admin with base: /admin/
console.log('\n[2/3] Building Atelier Admin Console (admin)...');
execSync('npm --prefix admin run build', { stdio: 'inherit', cwd: rootDir });

// 3. Assemble unified dist/
console.log('\n[3/3] Assembling Unified Output in dist/ ...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy customer storefront to root of dist
fs.cpSync(clientDist, distDir, { recursive: true });
console.log('✓ Copied customer storefront to dist/');

// Copy admin to dist/admin
const adminTarget = path.resolve(distDir, 'admin');
fs.mkdirSync(adminTarget, { recursive: true });
fs.cpSync(adminDist, adminTarget, { recursive: true });
console.log('✓ Copied admin portal to dist/admin/');

// Verify key artifacts exist
const checks = [
  path.resolve(distDir, 'index.html'),
  path.resolve(distDir, 'assets'),
  path.resolve(distDir, 'admin', 'index.html'),
  path.resolve(distDir, 'admin', 'assets'),
];

for (const check of checks) {
  if (!fs.existsSync(check)) {
    throw new Error(`Missing expected build output: ${check}`);
  }
}

console.log('\n=== Unified Build Complete! Output verified in dist/ ===');
