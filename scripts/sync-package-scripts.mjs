#!/usr/bin/env node
/**
 * Normalize per-package build scripts across the workspace.
 *
 * Standard pattern enforced:
 *   - build            -> pnpm run build:bundle
 *   - prebuild:bundle  -> pnpm run build:types (if build:types exists)
 *   - build:clean      -> removed (tsup.clean handles dist removal)
 *   - prebuild         -> removed when it only called build:clean
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

  const hasBuildTypes = typeof scripts['build:types'] === 'string';
  const hasBuildBundle = typeof scripts['build:bundle'] === 'string';

  if (hasBuildTypes && hasBuildBundle) {
    if (scripts['build'] !== 'pnpm run build:bundle') {
      scripts['build'] = 'pnpm run build:bundle';
      changed = true;
    }
    if (scripts['prebuild:bundle'] !== 'pnpm run build:types') {
      scripts['prebuild:bundle'] = 'pnpm run build:types';
      changed = true;
    }
    if (scripts['build:clean']) {
      delete scripts['build:clean'];
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
