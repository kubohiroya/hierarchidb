#!/usr/bin/env node
/**
 * Extra guard: forbid tsconfig compilerOptions.paths entries that point into other packages' src.
 *
 * Why: paths-to-src breaks the monorepo contract (consume public exports/dist only) and leaks optional deps
 * (e.g., xlsx) into unrelated typecheck programs.
 *
 * Scope:
 * - Repo root tsconfig.base.json is the main place where paths are defined.
 * - We only block cross-package src references under: packages/<pkg>/src and plugins/<plugin>/src.
 * - Same-package relative paths are not applicable here because this file checks the root mapping.
 */

import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const tsconfigPath = path.join(repoRoot, 'tsconfig.base.json');

function stripCommentsAndTrailingCommas(text) {
  let out = '';
  let inStr = false;
  let quote = '';
  let esc = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (inLine) {
      if (c === '\n' || c === '\r') {
        inLine = false;
        out += c;
      }
      continue;
    }
    if (inBlock) {
      if (c === '*' && n === '/') {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inStr) {
      out += c;
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === quote) inStr = false;
      continue;
    }

    if (c === '/' && n === '/') {
      inLine = true;
      i++;
      continue;
    }
    if (c === '/' && n === '*') {
      inBlock = true;
      i++;
      continue;
    }

    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
      out += c;
      continue;
    }

    if (c === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      const nxt = text[j];
      if (nxt === '}' || nxt === ']') continue;
    }

    out += c;
  }
  return out;
}

function readJSONC(p) {
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(stripCommentsAndTrailingCommas(raw));
  } catch {
    return null;
  }
}

const tsconfig = readJSONC(tsconfigPath);
if (!tsconfig) {
  console.error(`ERROR  failed to read ${path.relative(repoRoot, tsconfigPath)}`);
  process.exit(2);
}

const pathsMap = tsconfig?.compilerOptions?.paths;
if (!pathsMap || typeof pathsMap !== 'object') process.exit(0);

/**
 * Forbidden targets:
 * - packages/<pkg>/src/
 * - plugins/<plugin>/src/
 * (dist is allowed; also packages/<pkg>/generated etc are allowed)
 */
const forbidRe = /^(packages|plugins)\/.+\/src\//;

let errors = 0;
for (const [alias, targets] of Object.entries(pathsMap)) {
  if (!Array.isArray(targets)) continue;
  for (const target of targets) {
    if (typeof target !== 'string') continue;
    if (forbidRe.test(target)) {
      console.error(
        `ERROR  tsconfig.base.json: paths['${alias}'] points to src: '${target}'. Use dist/*.d.ts (or public exports) instead.`,
      );
      errors++;
    }
  }
}

process.exit(errors > 0 ? 1 : 0);
