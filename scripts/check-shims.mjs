#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// NOTE:
// - This repo bans arbitrary "*shim*.d.ts" files because they tend to drift.
// - If you must add one, put it on this allowlist and keep it minimal.
// - The allowlist itself must only contain existing files.
const ALLOW_LIST = new Set([
  // (intentionally empty)
]);

// Validate allowlist entries exist to avoid broken guardrails.
const allowListMissing = [];
for (const rel of ALLOW_LIST) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) allowListMissing.push(rel);
}
if (allowListMissing.length > 0) {
  console.error('[shim-check] Allow list contains missing files:');
  for (const rel of allowListMissing) console.error(`  - ${rel}`);
  console.error('\nFix scripts/check-shims.mjs allow list to reference only existing files.');
  process.exit(1);
}

const matches = [];

function walk(dir, relBase = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo' || entry.name === 'coverage') continue;
    const abs = path.join(dir, entry.name);
    const rel = path.join(relBase, entry.name);
    if (entry.isDirectory()) {
      walk(abs, rel);
      continue;
    }
    if (!rel.endsWith('.d.ts')) continue;
    if (!/shim/i.test(entry.name)) continue;
    matches.push(rel);
  }
}

walk(ROOT);

const unexpected = matches.filter((rel) => !ALLOW_LIST.has(rel));

if (unexpected.length > 0) {
  console.error('[shim-check] Unexpected shim declarations detected:');
  for (const rel of unexpected) {
    console.error(`  - ${rel}`);
  }
  console.error('\nUpdate scripts/check-shims.mjs allow list if these files are intentional, or remove the shims.');
  process.exit(1);
}

console.log(`[shim-check] ok (${matches.length} shim files, all accounted for).`);
