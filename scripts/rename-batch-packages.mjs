#!/usr/bin/env node

/**
 * Renames batch packages from the legacy @hierarchidb/batch-{api,sdk}
 * naming to the new @hierarchidb/batch-{types,runtime-services} scheme
 * and updates textual references across the repository.
 *
 * Usage:
 *   node scripts/rename-batch-packages.mjs --dry-run
 *   node scripts/rename-batch-packages.mjs
 */

import { execSync } from 'node:child_process';
import { existsSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const stringReplacements = [
  // Scoped package names (longest/specific first)
  { from: '@hierarchidb/batch-api', to: '@hierarchidb/batch-types' },
  { from: '@hierarchidb/batch-sdk', to: '@hierarchidb/batch-runtime-services' },

  // Workspace directory references
  { from: 'packages/batch-api', to: 'packages/batch-types' },
  { from: 'packages/batch-sdk', to: 'packages/batch-runtime-services' },

  // Unscoped identifiers
  { from: 'batch-api', to: 'batch-types' },
  { from: 'batch-sdk', to: 'batch-runtime-services' },
];

const directoryRenames = [
  { from: 'packages/batch-api', to: 'packages/batch-types' },
  { from: 'packages/batch-sdk', to: 'packages/batch-runtime-services' },
];

function getGitFiles() {
  const output = execSync('git ls-files', { encoding: 'utf8', cwd: resolve(__dirname, '..') });
  return output.split('\n').filter(Boolean);
}

function isTextualFile(path) {
  const lower = path.toLowerCase();
  const bannedExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp',
    '.pdf', '.mp4', '.mov', '.zip', '.gzip', '.tgz', '.tar', '.xz',
  ];
  return !bannedExtensions.some(ext => lower.endsWith(ext));
}

function applyReplacements(content) {
  let changed = false;
  let result = content;
  for (const { from, to } of stringReplacements) {
    if (result.includes(from)) {
      result = result.split(from).join(to);
      changed = true;
    }
  }
  return { changed, content: result };
}

const repoRoot = resolve(__dirname, '..');
const files = getGitFiles().filter(path => path !== 'scripts/rename-batch-packages.mjs');

const modifiedFiles = [];

for (const relativePath of files) {
  if (!isTextualFile(relativePath)) continue;

  const fullPath = resolve(repoRoot, relativePath);
  let original;
  try {
    original = readFileSync(fullPath, 'utf8');
  } catch {
    continue;
  }

  const { changed, content } = applyReplacements(original);
  if (!changed) continue;

  modifiedFiles.push(relativePath);
  if (!dryRun) {
    writeFileSync(fullPath, content, 'utf8');
  }
}

const dirActions = [];
for (const { from, to } of directoryRenames) {
  const fromPath = resolve(repoRoot, from);
  const toPath = resolve(repoRoot, to);
  if (!existsSync(fromPath)) {
    continue;
  }
  dirActions.push({ from, to });
  if (!dryRun) {
    renameSync(fromPath, toPath);
  }
}

console.log(`Batch package rename ${dryRun ? '(dry-run)' : ''}`);
console.log('String replacements applied to', modifiedFiles.length, 'files.');
if (modifiedFiles.length && dryRun) {
  for (const file of modifiedFiles) {
    console.log(`  - ${file}`);
  }
}

if (dirActions.length) {
  console.log('Directory renames:');
  for (const action of dirActions) {
    console.log(`  - ${action.from} -> ${action.to}`);
  }
} else {
  console.log('No directory renames performed (directories missing or already renamed).');
}

if (dryRun) {
  console.log('\nDry-run complete. Re-run without --dry-run to apply changes.');
} else {
  console.log('\nRename operation complete.');
}
