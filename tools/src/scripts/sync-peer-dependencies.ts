/**
 * Script: sync-peer-dependencies
 * Purpose: Ensure designated shared libraries live in peerDependencies + devDependencies
 *          and are removed from dependencies for UI-oriented packages.
 * Invocation: run via `pnpm --filter @hierarchidb/tools run sync-peer-dependencies`.
 * Output: Updates package-level `package.json` files (and optional tsup config) in place.
 */
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const TARGET_LIBRARIES = [
  'react',
  'react-dom',
  '@mui/material',
  '@mui/icons-material',
  '@emotion/react',
  '@emotion/styled',
];

function readJson(file: string): Record<string, any> | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file: string, value: Record<string, any>): void {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function* walkPackages(root: string): Generator<string> {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const pkgJson = path.join(fullPath, 'package.json');
      if (fs.existsSync(pkgJson)) {
        yield fullPath;
      }
      yield* walkPackages(fullPath);
    }
  }
}

function collectRootRanges(): Record<string, string> {
  const rootPkg = readJson(path.join(repoRoot, 'package.json')) ?? {};
  return {
    ...(rootPkg.dependencies ?? {}),
    ...(rootPkg.devDependencies ?? {}),
  };
}

function pickVersion(rangeMap: Record<string, string>, name: string, fallback: string): string {
  return rangeMap[name] ?? fallback;
}

function ensurePeers(pkgJson: Record<string, any>, rangeMap: Record<string, string>): boolean {
  pkgJson.peerDependencies ||= {};
  pkgJson.devDependencies ||= {};
  let changed = false;

  for (const name of TARGET_LIBRARIES) {
    const depRange = pkgJson.dependencies?.[name];
    const devRange = pkgJson.devDependencies?.[name];
    const peerRange = pkgJson.peerDependencies?.[name];
    if (!depRange && !devRange && !peerRange) continue;

    const desired = pickVersion(rangeMap, name, depRange || devRange || peerRange || '^0.0.0');

    if (pkgJson.dependencies && pkgJson.dependencies[name]) {
      delete pkgJson.dependencies[name];
      changed = true;
    }
    if (pkgJson.peerDependencies?.[name] !== desired) {
      pkgJson.peerDependencies[name] = desired;
      changed = true;
    }
    if (pkgJson.devDependencies?.[name] !== desired) {
      pkgJson.devDependencies[name] = desired;
      changed = true;
    }
  }

  if (pkgJson.dependencies && Object.keys(pkgJson.dependencies).length === 0) {
    delete pkgJson.dependencies;
    changed = true;
  }

  return changed;
}

function updateTsupExternal(configPath: string): boolean {
  if (!fs.existsSync(configPath)) return false;
  const original = fs.readFileSync(configPath, 'utf8');
  let updated = original;

  const alreadyHasExternal = /external\s*:\s*\[/m.test(updated);
  if (alreadyHasExternal) {
    for (const lib of TARGET_LIBRARIES) {
      const pattern = new RegExp(`['"]${lib}['"]`);
      if (!pattern.test(updated)) {
        updated = updated.replace(/external\s*:\s*\[/, (match) => `${match}'${lib}', `);
      }
    }
  } else {
    const insertion = `external: [${TARGET_LIBRARIES.map((lib) => `'${lib}'`).join(', ')}],\n`;
    updated = updated.replace(/(defineConfig\s*\(\s*\{\s*)/, `$1${insertion}`);
  }

  if (updated !== original) {
    fs.writeFileSync(configPath, updated);
    return true;
  }

  return false;
}

function findTsupConfig(dir: string): string | null {
  for (const file of ['tsup.config.ts', 'tsup.config.mts', 'tsup.config.mjs', 'tsup.config.js']) {
    const candidate = path.join(dir, file);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function isLikelyUiPackage(dir: string, pkgJson: Record<string, any>): boolean {
  if (pkgJson.private) return false;
  if (pkgJson.name && /ui|plugin/i.test(pkgJson.name)) return true;
  if (/\bui\b/.test(dir)) return true;
  const srcDir = path.join(dir, 'src');
  if (!fs.existsSync(srcDir)) return false;
  const stack = [srcDir];
  while (stack.length) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(candidate);
      } else if (candidate.endsWith('.tsx')) {
        return true;
      }
    }
  }
  return false;
}

function main(): void {
  const rootRanges = collectRootRanges();
  const packagesRoot = path.join(repoRoot, 'packages');
  const packageDirs = fs.existsSync(packagesRoot) ? Array.from(walkPackages(packagesRoot)) : [];

  let peerAdjustments = 0;
  let tsupAdjustments = 0;
  const touched: Array<{ name: string; dir: string; peers: boolean; tsup: boolean }> = [];

  for (const dir of packageDirs) {
    const pkgPath = path.join(dir, 'package.json');
    const pkgJson = readJson(pkgPath);
    if (!pkgJson) continue;
    if (!isLikelyUiPackage(dir, pkgJson)) continue;

    const peersChanged = ensurePeers(pkgJson, rootRanges);
    if (peersChanged) {
      writeJson(pkgPath, pkgJson);
      peerAdjustments++;
    }

    const tsupConfig = findTsupConfig(dir);
    const tsupChanged = tsupConfig ? updateTsupExternal(tsupConfig) : false;
    if (tsupChanged) tsupAdjustments++;

    if (peersChanged || tsupChanged) {
      touched.push({ name: pkgJson.name ?? path.basename(dir), dir, peers: peersChanged, tsup: tsupChanged });
    }
  }

  console.log(`sync-peer-dependencies: peers=${peerAdjustments}, tsup=${tsupAdjustments}`);
  for (const entry of touched) {
    console.log(`- ${entry.name}: peers=${entry.peers ? 'yes' : 'no'}, tsup=${entry.tsup ? 'yes' : 'no'}`);
  }
}

main();
