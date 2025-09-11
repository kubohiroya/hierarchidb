#!/usr/bin/env node
/**
 * Simple @deprecated usage report (TS/TSX only)
 * - Ignores node_modules, dist, coverage, .turbo, storybook-static
 * - Groups by top-level package path (packages/<scope>/<name>)
 */
import { globby } from 'globby';
import fs from 'node:fs/promises';
import path from 'node:path';

const IGNORES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/storybook-static/**',
];

const exts = ['ts', 'tsx'];

function toKeyForPackage(file) {
  const parts = file.split(path.sep);
  if (parts[0] === 'packages') {
    return parts.slice(0, 3).join('/'); // packages/<scope>/<name>
  }
  return parts[0];
}

function summarize(countMap) {
  const total = [...countMap.values()].reduce((a, b) => a + b, 0);
  const byPkg = new Map();
  for (const [file, count] of countMap) {
    const key = toKeyForPackage(file);
    byPkg.set(key, (byPkg.get(key) || 0) + count);
  }
  const topFiles = [...countMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topPkgs = [...byPkg.entries()].sort((a, b) => b[1] - a[1]);
  return { total, uniqueFiles: countMap.size, byPkg: topPkgs, topFiles };
}

async function main() {
  const patterns = [`**/*.ts`, `**/*.tsx`];
  const files = await globby(patterns, { ignore: IGNORES, gitignore: true });
  const countMap = new Map();
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    let idx = 0;
    let count = 0;
    while ((idx = text.indexOf('@deprecated', idx)) !== -1) {
      count += 1;
      idx += 11;
    }
    if (count > 0) countMap.set(file, count);
  }

  const summary = summarize(countMap);
  // Pretty print
  console.log('Summary (@deprecated in TS/TSX)');
  console.log(`TOTAL_MATCHES=${summary.total}`);
  console.log(`UNIQUE_TS_FILES=${summary.uniqueFiles}`);
  console.log('\nPer package (descending):');
  for (const [key, val] of summary.byPkg) console.log(String(val).padStart(5), key);
  console.log('\nTop files by occurrences (top 15):');
  for (const [file, val] of summary.topFiles) console.log(String(val).padStart(5), file);

  // Also emit JSON for tooling
  const json = {
    total: summary.total,
    uniqueFiles: summary.uniqueFiles,
    byPackage: Object.fromEntries(summary.byPkg),
    topFiles: summary.topFiles.map(([file, count]) => ({ file, count })),
  };
  console.log('\nJSON:\n' + JSON.stringify(json, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

