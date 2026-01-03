#!/usr/bin/env node
/**
 * Policy: ban tsconfig.base.json compilerOptions.paths values that point into packages/<pkg>/src or plugins/<plugin>/src.
 *
 * This encodes the repo rule:
 *   - Vite dev may alias to src for HMR.
 *   - TypeScript (tsc/typecheck) must rely on dist types (public API) and never resolve across repo src.
 */

import fs from 'node:fs';
import path from 'node:path';

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

const paths = tsconfig?.compilerOptions?.paths;
if (!paths || typeof paths !== 'object') process.exit(0);

const forbid = /^(packages|plugins)\/.+\/src\//;
let errors = 0;
for (const [key, arr] of Object.entries(paths)) {
  if (!Array.isArray(arr)) continue;
  for (const target of arr) {
    if (typeof target !== 'string') continue;
    if (forbid.test(target)) {
      console.error(
        `ERROR  tsconfig.base.json: paths['${key}'] points to src: '${target}'. Use dist types via exports (or dist/*.d.ts) instead.`,
      );
      errors++;
    }
  }
}

process.exit(errors > 0 ? 1 : 0);
