#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const EXTENSIONS = new Set(['.ts', '.tsx']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'coverage', '.turbo', 'storybook-static', '.generated', 'build']);

const regex = /\bas\s+any\b/g;
let maxAllowed = null;

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--max=')) {
    const value = Number(arg.slice('--max='.length));
    if (!Number.isNaN(value)) {
      maxAllowed = value;
    }
  }
}

const packageTotals = new Map();
const fileTotals = new Map();
let grandTotal = 0;

function shouldSkipFile(relPath) {
  if (relPath.includes('__tests__')) return true;
  if (/\.test\./.test(relPath)) return true;
  if (/\.spec\./.test(relPath)) return true;
  if (/deprecated\//.test(relPath)) return true;
  return false;
}

function getPackageKey(relPath) {
  if (relPath.startsWith('app/')) return 'app';
  if (relPath.startsWith('packages/')) {
    const parts = relPath.split(path.sep);
    if (parts.length >= 3) {
      return parts.slice(0, 3).join('/');
    }
  }
  return 'other';
}

function walk(dir, relBase = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (IGNORE_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = path.join(relBase, entry.name);
    if (entry.isDirectory()) {
      walk(abs, rel);
      continue;
    }
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    if (shouldSkipFile(rel)) continue;
    analyzeFile(abs, rel);
  }
}

function analyzeFile(absPath, relPath) {
  const content = fs.readFileSync(absPath, 'utf8');
  let count = 0;
  regex.lastIndex = 0;
  while (regex.exec(content)) {
    count += 1;
  }
  if (count === 0) return;
  grandTotal += count;
  fileTotals.set(relPath, count);
  const key = getPackageKey(relPath);
  packageTotals.set(key, (packageTotals.get(key) || 0) + count);
}

console.log('[as-any] scanning workspace for "as-any" assertions...');
walk(path.join(ROOT, 'app'), 'app');
walk(path.join(ROOT, 'packages'), 'packages');

const sortedPackages = [...packageTotals.entries()]
  .sort((a, b) => b[1] - a[1])
  .filter(([, count]) => count > 0);

const sortedFiles = [...fileTotals.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);

console.log(`\n[as-any] total occurrences: ${grandTotal}`);
console.log('\n[as-any] top packages:');
for (const [pkg, count] of sortedPackages.slice(0, 15)) {
  console.log(`  ${pkg.padEnd(40)} ${count.toString().padStart(5)}`);
}

console.log('\n[as-any] top files:');
for (const [file, count] of sortedFiles) {
  console.log(`  ${file.padEnd(60)} ${count.toString().padStart(5)}`);
}

if (sortedPackages.length > 15) {
  const remaining = sortedPackages.length - 15;
  const remainingCount = sortedPackages.slice(15).reduce((sum, [, c]) => sum + c, 0);
  console.log(`\n  ... ${remaining} more packages (${remainingCount} occurrences)`);
}

console.log('\nRun with "pnpm as-any:report" to regenerate.');

if (maxAllowed !== null && grandTotal > maxAllowed) {
  console.error(`\n[as-any] ERROR: occurrences (${grandTotal}) exceeded threshold ${maxAllowed}.`);
  process.exitCode = 1;
}
