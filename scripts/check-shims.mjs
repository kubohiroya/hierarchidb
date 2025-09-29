#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const ALLOW_LIST = new Set([
  'app/src/types/shims.d.ts',
  'packages/plugins/styler-plugin/src/worker/stylerEntitiesDB-shim.d.ts',
]);

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
