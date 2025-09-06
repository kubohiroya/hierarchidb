#!/usr/bin/env node
import { globby } from 'globby';
import fs from 'fs';

const DIST_DTS_RE = /(?:^|[\/])dist[\/].*\.d\.ts$/i;

function stripJsonComments(text) {
  const noComments = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  return noComments.replace(/,(\s*[}\]])/g, '$1');
}

function findViolations(obj, file) {
  const violations = [];
  const paths = obj?.compilerOptions?.paths;
  if (!paths || typeof paths !== 'object') return violations;
  for (const [alias, arr] of Object.entries(paths)) {
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      if (typeof p === 'string' && DIST_DTS_RE.test(p)) {
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
      const json = JSON.parse(stripJsonComments(raw));
      all.push(...findViolations(json, file));
    } catch (e) {
      const raw = fs.readFileSync(file, 'utf8');
      const m = raw.match(/"paths"\s*:\s*\{([\s\S]*?)\}/);
      if (m) {
        const block = m[1];
        const lines = block.split(/\n|\r/).map((s) => s.trim());
        for (const line of lines) {
          const hasDistDts = /dist[\/].*\.d\.ts/.test(line);
          if (hasDistDts) {
            const aliasMatch = line.match(/"([^"]+)"\s*:/);
            const valueMatch = line.match(/"([^\"]*dist[\/][^\"]*\.d\.ts)"/);
            all.push({ file, alias: aliasMatch?.[1] ?? '(unknown)', value: valueMatch?.[1] ?? line });
          }
        }
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

