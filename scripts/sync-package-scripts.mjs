#!/usr/bin/env node
/**
 * Normalize per-package stage scripts across the workspace.
 *
 * Standard pattern enforced:
 *   - stage            -> pnpm run stage:bundle
 *   - prebuild:bundle  -> pnpm run stage:types (if stage:types exists)
 *   - stage:clean      -> removed (tsup.clean handles dist removal)
 *   - prebuild         -> removed when it only called stage:clean
 *
 * The script is idempotent and can be rerun at any time.
 */

import fs from 'node:fs';
import path from 'node:path';

const workspaceRoots = ['packages', 'plugins'];

function findPackageJsonFiles() {
  const files = [];
  const stack = workspaceRoots
    .map((dir) => path.join(process.cwd(), dir))
    .filter((dir) => fs.existsSync(dir));

  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        const full = path.join(current, entry);
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        stack.push(full);
      }
    } else if (stat.isFile() && path.basename(current) === 'package.json') {
      files.push(current);
    }
  }
  return files;
}

function normalisePackage(file) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const scripts = json.scripts;
  if (!scripts) return false;

  let changed = false;

  const hasBuildTypes = typeof scripts['stage:types'] === 'string';
  const hasBuildBundle = typeof scripts['stage:bundle'] === 'string';

  if (hasBuildTypes && hasBuildBundle) {
    if (scripts['build'] !== 'pnpm run stage:bundle') {
      scripts['build'] = 'pnpm run stage:bundle';
      changed = true;
    }
    if (scripts['prebuild:bundle'] !== 'pnpm run stage:types') {
      scripts['prebuild:bundle'] = 'pnpm run stage:types';
      changed = true;
    }
    if (scripts['stage:clean']) {
      delete scripts['stage:clean'];
      changed = true;
    }
    if (
      scripts['prebuild'] &&
      /\bpnpm run build:clean\b/.test(scripts['prebuild'])
    ) {
      delete scripts['prebuild'];
      changed = true;
    }
  }

  if (!changed) return false;

  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  return true;
}

function main() {
  const files = findPackageJsonFiles();
  let touched = 0;
  for (const file of files) {
    if (normalisePackage(file)) {
      touched += 1;
    }
  }
  console.log(`sync-package-scripts: updated ${touched} packages`);
}

main();
