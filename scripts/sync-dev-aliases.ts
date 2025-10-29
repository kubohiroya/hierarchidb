import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectWorkspacePackages,
  createDevAliasSelection,
  loadDevAliasConfig,
  parseDevAliasOverride,
  shouldUsePluginSource,
  shouldUseSource,
  toPosixRelative,
  type WorkspacePackageMeta,
} from '../config/dev-alias-config.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..');
const tsconfigPath = path.resolve(repoRoot, 'tsconfig.base.json');

const baseConfig = loadDevAliasConfig(repoRoot);
const effectiveConfig = parseDevAliasOverride(process.env.VITE_DEV_ALIAS_OVERRIDE, baseConfig);
const selection = createDevAliasSelection(effectiveConfig);
const workspacePackages = collectWorkspacePackages(repoRoot);

const tsconfigRaw = fs.readFileSync(tsconfigPath, 'utf-8');
const tsconfig = JSON.parse(tsconfigRaw) as {
  compilerOptions?: {
    paths?: Record<string, string[]>;
  };
};

const compilerOptions = (tsconfig.compilerOptions = tsconfig.compilerOptions ?? {});
const paths = (compilerOptions.paths = compilerOptions.paths ?? {});
const tsconfigDir = path.dirname(tsconfigPath);

const managedKeys = new Set<string>();
const warnings: string[] = [];

const shouldManage = (meta: WorkspacePackageMeta): boolean => meta.name.startsWith('@hierarchidb/');

const setPathMapping = (key: string, target: string | null) => {
  if (!target) {
    if (key in paths) delete paths[key];
    managedKeys.add(key);
    return;
  }
  paths[key] = [target];
  managedKeys.add(key);
};

for (const meta of workspacePackages) {
  if (!shouldManage(meta)) continue;

  const isPlugin = meta.category === 'plugins';
  const useSrc = isPlugin
    ? shouldUsePluginSource(selection, meta.name, null)
    : shouldUseSource(selection, meta.name, meta.group);

  const srcEntryAbs = meta.srcEntry ?? null;
  const srcDirAbs = meta.srcDir ?? null;

  const preferredDistEntries: (string | null)[] = [];
  if (meta.distEntry) preferredDistEntries.push(meta.distEntry);
  if (meta.typesEntry) preferredDistEntries.push(meta.typesEntry);

  let distEntryAbs: string | null = null;
  for (const candidate of preferredDistEntries) {
    if (!candidate) continue;
    const isDeclaration = candidate.endsWith('.d.ts') || candidate.endsWith('.d.mts');
    if (isDeclaration) continue;
    if (candidate === srcEntryAbs) continue;
    distEntryAbs = candidate;
    break;
  }

  const distDirAbs = meta.distDir && meta.distDir !== srcDirAbs ? meta.distDir : null;

  const srcEntry = srcEntryAbs ? toPosixRelative(tsconfigDir, srcEntryAbs) : null;
  const srcWildcard = srcDirAbs ? `${toPosixRelative(tsconfigDir, srcDirAbs)}/*` : null;
  const distEntry = distEntryAbs ? toPosixRelative(tsconfigDir, distEntryAbs) : null;
  const distWildcard = distDirAbs ? `${toPosixRelative(tsconfigDir, distDirAbs)}/*` : null;

  const baseKey = meta.name;
  const wildcardKey = `${meta.name}/*`;

  if (useSrc && srcEntry) {
    setPathMapping(baseKey, srcEntry);
  } else if (!useSrc && distEntry) {
    setPathMapping(baseKey, distEntry);
  } else if (srcEntry) {
    setPathMapping(baseKey, srcEntry);
    if (!useSrc) warnings.push(`Fallback to src for ${meta.name} (dist entry missing)`);
  } else {
    warnings.push(`Skipping ${meta.name}: unable to resolve entry path`);
    setPathMapping(baseKey, null);
    setPathMapping(wildcardKey, null);
    continue;
  }

  if (useSrc && srcWildcard) {
    setPathMapping(wildcardKey, srcWildcard);
  } else if (!useSrc && distWildcard && distEntry) {
    setPathMapping(wildcardKey, distWildcard);
  } else if (useSrc && !srcWildcard) {
    setPathMapping(wildcardKey, null);
  } else {
    setPathMapping(wildcardKey, srcWildcard ?? null);
    if (!useSrc && srcWildcard) warnings.push(`Wildcard fallback to src for ${meta.name}`);
  }
}

const sortedPaths = Object.keys(paths)
  .sort()
  .reduce<Record<string, string[]>>((acc, key) => {
    acc[key] = paths[key];
    return acc;
  }, {});

compilerOptions.paths = sortedPaths;

fs.writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`, 'utf-8');

if (warnings.length > 0) {
  console.warn('[sync-dev-aliases] warnings:');
  for (const warning of warnings) {
    console.warn(`  - ${warning}`);
  }
}

console.log('[sync-dev-aliases] Updated tsconfig.base.json paths.');
