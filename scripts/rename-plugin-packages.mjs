#!/usr/bin/env node

/**
 * Renames plugin packages and updates all references across the repo.
 *
 * Usage:
 *   node scripts/rename-plugin-packages.mjs --dry-run
 *   node scripts/rename-plugin-packages.mjs
 */

import { execSync } from 'node:child_process';
import { existsSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const stringReplacements = [
  // Package names (longest specific first)
  { from: '@hierarchidb/plugin-entity-service', to: '@hierarchidb/plugin-runtime-entities' },
  { from: '@hierarchidb/plugin-sdk', to: '@hierarchidb/plugin-ui-sdk' },
  { from: '@hierarchidb/plugin-api', to: '@hierarchidb/plugin-types' },

  // Workspace directory references
  { from: 'packages/plugin-entity-service', to: 'packages/plugin-runtime-entities' },
  { from: 'packages/plugin-sdk', to: 'packages/plugin-ui-sdk' },
  { from: 'packages/plugin-api', to: 'packages/plugin-types' },

  // Bare identifiers (after the scoped replacements)
  { from: 'plugin-entity-service', to: 'plugin-runtime-entities' },
  { from: 'plugin-sdk', to: 'plugin-ui-sdk' },
  { from: 'plugin-api', to: 'plugin-types' },
];

const directoryRenames = [
  { from: 'packages/plugin-entity-service', to: 'packages/plugin-runtime-entities' },
  { from: 'packages/plugin-sdk', to: 'packages/plugin-ui-sdk' },
  { from: 'packages/plugin-api', to: 'packages/plugin-types' },
];

function getGitFiles() {
  const output = execSync('git ls-files', { encoding: 'utf8', cwd: dirname(__dirname) });
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
  let next = content;
  for (const { from, to } of stringReplacements) {
    if (next.includes(from)) {
      next = next.split(from).join(to);
      changed = true;
    }
  }
  return { changed, content: next };
}

const repoRoot = dirname(__dirname);
const files = getGitFiles().filter(path => path !== 'scripts/rename-plugin-packages.mjs');

const modifiedFiles = [];

for (const relativePath of files) {
  if (!isTextualFile(relativePath)) {
    continue;
  }

  const fullPath = `${repoRoot}/${relativePath}`;
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
  const fromPath = `${repoRoot}/${from}`;
  const toPath = `${repoRoot}/${to}`;
  if (!existsSync(fromPath)) {
    continue;
  }
  dirActions.push({ from, to });
  if (!dryRun) {
    renameSync(fromPath, toPath);
  }
}

console.log(`Renaming packages ${dryRun ? '(dry-run)' : ''}`);
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
