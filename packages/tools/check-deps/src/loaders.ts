import fs from 'node:fs';
import path from 'node:path';
import type { RepoConfig } from './types';

export const ROOT = findRepoRoot(process.cwd());

function findRepoRoot(start: string): string {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')) || fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return start;
}

export function readJson<T = any>(file: string): T | null {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return null; }
}

export function listPackageDirs(): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const pkgPath = path.join(p, 'package.json');
        if (fs.existsSync(pkgPath)) out.push(p);
        walk(p);
      }
    }
  }
  const pkgsRoot = path.join(ROOT, 'packages');
  if (fs.existsSync(pkgsRoot)) walk(pkgsRoot);
  const appPkg = path.join(ROOT, 'app', 'package.json');
  if (fs.existsSync(appPkg)) out.push(path.join(ROOT, 'app'));
  return out;
}

export function parseExternalsFromTsup(file: string): string[] {
  try {
    const src = fs.readFileSync(file, 'utf8');
    const m = src.match(/external\s*:\s*\[([\s\S]*?)\]/);
    if (!m) return [];
    const body = m[1];
    const singles = [...body.matchAll(/'([^']+)'/g)].map((x) => x[1]);
    const doubles = [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    return [...new Set([...singles, ...doubles])];
  } catch { return []; }
}

export function loadDefaultExternals(): string[] {
  const base = path.join(ROOT, 'tsup.base.config.ts');
  return parseExternalsFromTsup(base);
}

export function readTsupExternals(pkgDir: string, defaults: string[]): string[] {
  const files = ['tsup.config.ts', 'tsup.config.mjs', 'tsup.config.js']
    .map((f) => path.join(pkgDir, f))
    .filter((f) => fs.existsSync(f));
  const extras = files.flatMap((f) => parseExternalsFromTsup(f));
  return [...new Set([...(defaults || []), ...extras])];
}

export function readTsconfig(pkgDir: string): any {
  const f = path.join(pkgDir, 'tsconfig.json');
  return readJson(f) || {};
}

export function readRepoConfig(): RepoConfig {
  // support both legacy path and package path
  const legacy = path.join(ROOT, 'tools', 'check-deps', 'config.json');
  const pkgPath = path.join(ROOT, 'packages', 'tools', 'check-deps', 'config.json');
  const cfg = (readJson<RepoConfig>(pkgPath) || readJson<RepoConfig>(legacy) || { allowSkipLibCheck: [] });
  return cfg;
}

