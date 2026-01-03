#!/usr/bin/env node
import { globby } from 'globby';
import fs from 'fs';
import path from 'path';

/**
 * Policy: Ban tsconfig.paths entries that reference dist/*.d.ts unless they represent a package public types entry.
 *
 * Repo rule:
 * - Vite dev may alias to src for HMR.
 * - TypeScript typecheck must rely on dist types (package public API) to prevent cross-package src coupling.
 *
 * Therefore, dist/*.d.ts is allowed only when the target path matches that package's declared public types
 * (package.json "types" or exports["."].types).
 */

const DIST_DTS_RE = /(?:^|[\/])dist[\/].*\.d\.ts$/i;

// Replace naive stripper with JSONC-safe parser (same approach as other repo scripts)
function stripJsonCommentsAndTrailingCommas(text) {
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

function parseJSONC(raw) {
  return JSON.parse(stripJsonCommentsAndTrailingCommas(raw));
}

function isAllowedDistReference(tsconfigPath, value) {
  const tsconfigDir = path.dirname(tsconfigPath);
  const absolute = path.resolve(tsconfigDir, value);
  let cursor = absolute;

  while (true) {
    const pkgJsonPath = path.join(cursor, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const rel = path.posix.normalize(path.relative(cursor, absolute).split(path.sep).join('/'));

        const declaredTypes = typeof pkg.types === 'string' ? pkg.types.replace(/^\.\//, '') : null;
        const exportTypes = typeof pkg?.exports?.['.']?.types === 'string'
          ? pkg.exports['.'].types.replace(/^\.\//, '')
          : null;

        if (rel === declaredTypes || rel === exportTypes) {
          return true;
        }
      } catch {
        // fall through to violation
      }
      return false;
    }

    const parent = path.dirname(cursor);
    if (parent === cursor) {
      return false;
    }
    cursor = parent;
  }
}

function findViolations(obj, file) {
  const violations = [];
  const paths = obj?.compilerOptions?.paths;
  if (!paths || typeof paths !== 'object') return violations;
  for (const [alias, arr] of Object.entries(paths)) {
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      if (typeof p === 'string' && DIST_DTS_RE.test(p)) {
        if (isAllowedDistReference(file, p)) continue;
        violations.push({ file, alias, value: p });
      }
    }
  }
  return violations;
}

async function main() {
  const files = await globby(['**/tsconfig*.json', '!**/node_modules/**', '!**/dist/**']);
  const all = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const json = parseJSONC(raw);
      all.push(...findViolations(json, file));
    } catch (e) {
      // Fallback: do a loose scan limited to the paths block
      try {
        const raw = fs.readFileSync(file, 'utf8');
        const m = raw.match(/"paths"\s*:\s*\{([\s\S]*?)\}/);
        if (m) {
          const block = m[1];
          const lines = block.split(/\n|\r/).map((s) => s.trim());
          for (const line of lines) {
            const hasDistDts = /dist[\/].*\.d\.ts/.test(line);
            if (hasDistDts) {
              // Try to extract alias and value heuristically
              const aliasMatch = line.match(/"([^"]+)"\s*:/);
              const valueMatch = line.match(/"([^\"]*dist[\/][^\"]*\.d\.ts)"/);
              const alias = aliasMatch?.[1] ?? '(unknown)';
              const value = valueMatch?.[1] ?? line;
              if (isAllowedDistReference(file, value)) continue;
              all.push({ file, alias, value });
            }
          }
        }
        if (!m) {
          console.warn(`[policy:warn] Could not parse ${file}: ${e.message}`);
        }
      } catch (e2) {
        console.warn(`[policy:warn] Could not parse ${file}: ${e.message}`);
      }
    }
  }

  if (all.length) {
    console.error('\nPolicy violation: tsconfig.paths must not reference dist/*.d.ts');
    for (const v of all) {
      console.error(` - ${v.file}: ${v.alias} -> ${v.value}`);
    }
    console.error('\nFix: point to source (e.g., src/index.ts) or add a project reference.');
    process.exit(1);
  } else {
    console.log('[policy] OK: no dist/*.d.ts found in tsconfig paths');
  }
}

main();
