#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const manifestLoaderPath = url.pathToFileURL(path.join(repoRoot, 'tools', 'plugin-manifest-loader.js')).href;
const { loadPluginManifestFromFile } = await import(manifestLoaderPath);
const appDir = path.join(repoRoot, 'app');
const appPkgPath = path.join(appDir, 'package.json');
const outDir = path.join(appDir, 'src', 'generated');
const outWorkerFile = path.join(outDir, 'worker-loader.ts');
const outUiFile = path.join(outDir, 'ui-loader.ts');
const registrySrcDir = path.join(repoRoot, 'packages', 'plugin-registry', 'src');
const registryGeneratedFile = path.join(registrySrcDir, 'generated.ts');
const registryTypesDir = path.join(repoRoot, 'packages', 'plugin-registry', '.generated', 'types');
const registryAmbientModuleFile = path.join(registryTypesDir, 'plugin-modules.d.ts');

/**
 * Derive nodeType from package name like @hierarchidb/plugin-loader-<nodeType>-plugin
 */
function deriveNodeType(pkgName) {
  const match = pkgName.match(/@hierarchidb\/([a-z0-9-]+)-plugin$/);
  if (!match) return undefined;
  return match[1];
}

/** Capitalize first letter */
function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readPluginPackageJSON(pkgName, nodeType) {
  // Try resolve via Node resolution first (workspace symlink in node_modules)
  try {
    const resolved = require.resolve(`${pkgName}/package.json`);
    const json = JSON.parse(await fs.readFile(resolved, 'utf8'));
    return { json, path: resolved, dir: path.dirname(resolved) };
  } catch {
    // Fallback to repo layout: packages/plugin-loader/<nodeType>-plugin/package.json
    const fallback = path.join(repoRoot, 'plugins', `${nodeType}-plugin`, 'package.json');
    if (await fileExists(fallback)) {
      const json = JSON.parse(await fs.readFile(fallback, 'utf8'));
      return { json, path: fallback, dir: path.dirname(fallback) };
    }
  }
  return { json: undefined, path: undefined, dir: undefined };
}

function normalizeDependency(spec) {
  if (typeof spec !== 'string') return null;
  const trimmed = spec.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^@hierarchidb\/([a-z0-9-]+)-plugin$/i);
  if (match) return match[1];
  return trimmed;
}

function sanitizeManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return null;
  const result = {};

  const addString = (target, key, value) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      target[key] = value.trim();
    }
  };

  addString(result, 'id', manifest.id);
  addString(result, 'name', manifest.name);
  addString(result, 'displayName', manifest.displayName);
  addString(result, 'nodeType', manifest.nodeType);
  addString(result, 'version', manifest.version);
  addString(result, 'description', manifest.description);
  addString(result, 'extends', manifest.extends);

  if (typeof manifest.priority === 'number' && Number.isFinite(manifest.priority)) {
    result.priority = manifest.priority;
  }

  if (Array.isArray(manifest.dependencies)) {
    result.dependencies = manifest.dependencies.map(String);
  }

  if (manifest.icon && typeof manifest.icon === 'object') {
    const icon = {};
    addString(icon, 'muiIconName', manifest.icon.muiIconName);
    addString(icon, 'mui', manifest.icon.mui);
    addString(icon, 'emoji', manifest.icon.emoji);
    addString(icon, 'color', manifest.icon.color);
    if (Object.keys(icon).length > 0) {
      result.icon = icon;
    }
  }

  if (typeof manifest.category === 'string') {
    result.category = manifest.category;
  } else if (manifest.category && typeof manifest.category === 'object') {
    const category = {};
    addString(category, 'menuGroup', manifest.category.menuGroup);
    if (typeof manifest.category.createOrder === 'number' && Number.isFinite(manifest.category.createOrder)) {
      category.createOrder = manifest.category.createOrder;
    }
    addString(category, 'treeId', manifest.category.treeId);
    if (Object.keys(category).length > 0) {
      result.category = category;
    }
  }

  if (manifest.schema && typeof manifest.schema === 'object') {
    const schema = {};
    addString(schema, 'inherits', manifest.schema.inherits);
    if (Array.isArray(manifest.schema.fields)) {
      schema.fields = manifest.schema.fields
        .filter((field) => field && typeof field === 'object')
        .map((field) => ({
          name: String(field.name ?? ''),
          type: String(field.type ?? ''),
          required: Boolean(field.required),
        }))
        .filter((field) => field.name.trim().length > 0 && field.type.trim().length > 0);
    }
    if (Object.keys(schema).length > 0) {
      result.schema = schema;
    }
  }

  if (manifest.capabilities && typeof manifest.capabilities === 'object') {
    const capabilities = {};
    for (const [key, value] of Object.entries(manifest.capabilities)) {
      if (typeof value === 'boolean') {
        capabilities[key] = value;
      }
    }
    if (Object.keys(capabilities).length > 0) {
      result.capabilities = capabilities;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function resolveExportPath(exportsField, key) {
  if (!exportsField) return undefined;
  if (typeof exportsField === 'string') {
    return key === '.' ? exportsField : undefined;
  }
  if (typeof exportsField !== 'object') {
    return undefined;
  }
  const entry = exportsField[key];
  if (!entry) return undefined;
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object') {
    return (
      (typeof entry.import === 'string' && entry.import) ||
      (typeof entry.default === 'string' && entry.default) ||
      (typeof entry.require === 'string' && entry.require) ||
      (typeof entry.module === 'string' && entry.module) ||
      (typeof entry.browser === 'string' && entry.browser) ||
      undefined
    );
  }
  return undefined;
}

async function resolveManifestPath(packageDir) {
  if (!packageDir) return null;
  const primary = path.join(packageDir, 'src', 'plugin-manifest.ts');
  if (await fileExists(primary)) {
    return primary;
  }
  const legacy = path.join(packageDir, 'src', 'extension', 'plugin-manifest.ts');
  if (await fileExists(legacy)) {
    return legacy;
  }
  return null;
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter((item) => item.length > 0);
}
function topoSort(nodes, edges) {
  const incoming = new Map();
  const outgoing = new Map();
  const addNode = (n) => { if (!incoming.has(n)) incoming.set(n, new Set()); if (!outgoing.has(n)) outgoing.set(n, new Set()); };
  nodes.forEach(addNode);
  for (const [from, to] of edges) { addNode(from); addNode(to); outgoing.get(from).add(to); incoming.get(to).add(from); }
  const result = [];
  const S = [...nodes].filter((n) => (incoming.get(n)?.size ?? 0) === 0);
  while (S.length) {
    const n = S.pop();
    result.push(n);
    for (const m of outgoing.get(n) ?? []) {
      incoming.get(m).delete(n);
      if (incoming.get(m).size === 0) S.push(m);
    }
  }
  if (result.length !== new Set(nodes).size) {
    // cycle detected; fall back to input order
    return [...nodes];
  }
  return result;
}

export async function generatePluginRegistry() {
  const pkgJson = JSON.parse(await fs.readFile(appPkgPath, 'utf8'));
  const allDeps = {
    ...(pkgJson.dependencies || {}),
    ...(pkgJson.devDependencies || {}),
    ...(pkgJson.optionalDependencies || {}),
  };
  const pluginPkgs = Object.keys(allDeps)
    .filter((name) => /@hierarchidb\/[a-z0-9-]+-plugin$/.test(name))
    .sort();

  // Build metadata for each plugin, including exported entry points and manifest details
  const meta = [];
  for (const name of pluginPkgs) {
    const nodeType = deriveNodeType(name);
    if (!nodeType) continue;
    const { json, dir } = await readPluginPackageJSON(name, nodeType);
    if (!json || !dir) continue;

    const exportsField = json.exports;
    const workerExportRel = resolveExportPath(exportsField, './worker');
    const uiExportRel = resolveExportPath(exportsField, './ui');
    const databaseExportRel = resolveExportPath(exportsField, './database');
    const commonExportRel = resolveExportPath(exportsField, './common');

    const hasWorker = !!workerExportRel;
    const hasUi = !!uiExportRel;
    const hasDatabase = !!databaseExportRel;
    const hasCommon = !!commonExportRel;

    let hasEntitiesDbExport = false;
    let workerEntryPath;
    if (hasWorker) {
      const rel = workerExportRel && workerExportRel.length > 0 ? workerExportRel : null;
      const candidate = rel ? path.join(dir, rel) : path.join(dir, 'dist', 'worker', 'index.js');
      if (await fileExists(candidate)) {
        workerEntryPath = candidate;
      }
    }

    if (workerEntryPath) {
      const className = `${capitalize(nodeType)}EntitiesDB`;
      try {
        const urlStr = url.pathToFileURL(workerEntryPath).href;
        const mod = await import(urlStr);
        if (typeof mod[className] === 'function') {
          hasEntitiesDbExport = true;
        }
      } catch {
        // ignore import errors; keep flag false
      }
    }

    const manifestPath = await resolveManifestPath(dir);
    const manifestRaw = manifestPath ? loadPluginManifestFromFile(manifestPath, { silent: true }) ?? null : null;
    const manifest = sanitizeManifest(manifestRaw);

    const pluginMeta = json?.hierarchidb?.plugin || {};
    const dependencyCandidates = [
      ...toStringArray(manifest?.dependencies),
      ...toStringArray(pluginMeta.dependencies),
      ...toStringArray(pluginMeta.dependsOn),
      ...toStringArray(pluginMeta.config?.dependencies),
    ];
    const dependencies = Array.from(new Set(
      dependencyCandidates
        .map(normalizeDependency)
        .filter((dep) => dep && dep !== nodeType)
    ));

    const displayName = (() => {
      if (typeof manifest?.displayName === 'string' && manifest.displayName.trim().length > 0) {
        return manifest.displayName.trim();
      }
      if (typeof pluginMeta.name === 'string' && pluginMeta.name.trim().length > 0) {
        return pluginMeta.name.trim();
      }
      return capitalize(nodeType);
    })();

    const priorityCandidates = [manifest?.priority, pluginMeta.priority]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const priority = priorityCandidates.length > 0 ? priorityCandidates[0] : 1000;
    const version = typeof json.version === 'string' ? json.version : '0.0.0';
    const nameValue = typeof pluginMeta.name === 'string' && pluginMeta.name.trim().length > 0
      ? pluginMeta.name.trim()
      : nodeType;

    meta.push({
      packageName: name,
      nodeType,
      name: nameValue,
      version,
      displayName,
      priority,
      dependencies,
      hasWorker,
      hasUi,
      hasDatabase,
      hasCommon,
      hasEntitiesDbExport,
      manifest,
    });
  }

  const header = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Generated by scripts/generate-plugin-loader.mjs
// This file statically wires plugin worker EntitiesDB loaders and registers UI persistence overrides.

import type { Table } from 'dexie';
export type NodeId = string & { readonly __brand: unique symbol };

// Dexie-like shape used by UI/worker utilities
export type PeerDialogPosition = { x: number; y: number };
export type PeerDialogSize = { width: number; height: number };
export interface PeerEntityRecord {
  nodeId: NodeId;
  updatedAt?: number;
  displayMode?: string;
  dialogPosition?: PeerDialogPosition;
  dialogSize?: PeerDialogSize;
  data?: unknown;
}
export type PeerEntitiesDB = { peerEntities: Table<PeerEntityRecord, NodeId>; open?: () => Promise<void>; close?: () => void } & Record<string, unknown>;
export type PeerDbLoader = () => Promise<PeerEntitiesDB | undefined>;

declare global {
  var __HDB_PLUGIN_ENTITY_OVERRIDES__: Record<string, unknown> | undefined;
}
`;

  const factoryImports = meta
    .filter((p) => p.hasWorker)
    .map(({ packageName, nodeType }) => `import { load${capitalize(nodeType)}EntitiesDbModule } from '${packageName}/worker';`)
    .join('\n');

  const importLines = [factoryImports].filter(Boolean).join('\n');

  const loaderEntries = meta
    .map(({ nodeType, hasWorker, hasEntitiesDbExport }) => {
      if (hasWorker && hasEntitiesDbExport) {
        const loadFn = `load${capitalize(nodeType)}EntitiesDbModule`;
        const className = `${capitalize(nodeType)}EntitiesDB`;
        return `  '${nodeType}': async () => {
    try {
      const mod = await ${loadFn}();
      const Ctor = mod?.['${className}'] as unknown as (new () => PeerEntitiesDB) | undefined;
      if (typeof Ctor !== 'function') return undefined;
      const db = new Ctor();
      if (typeof (db as any).open === 'function') {
        try { await (db as any).open(); } catch { /* ignore */ }
      }
      return db as unknown as PeerEntitiesDB;
    } catch {
      return undefined;
    }
  },`;
      }
      return `  '${nodeType}': async () => undefined,`;
    })
    .join('\n');

  const body = `
${importLines}

export const peerDbLoaders: Record<string, PeerDbLoader> = {
${loaderEntries}
};

export function registerUIPersistenceOverrides(): void {
  const g = (globalThis as any);
  const overrides = (g.__HDB_PLUGIN_ENTITY_OVERRIDES__ ??= {});
  for (const [nodeType, loader] of Object.entries(peerDbLoaders)) {
    overrides[nodeType] = async () => {
      const db = await loader();
      if (!db) return { table: () => ({ get: async () => undefined, put: async () => {} }) };
      return {
        table: (_name: string) => ({
          get: (id: string) => (db as any).peerEntities.get(id as any),
          put: (row: any) => (db as any).peerEntities.put(row),
        }),
      };
    };
  }
}
`;

  const content = header + body;
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(registrySrcDir, { recursive: true });
  await fs.writeFile(outWorkerFile, content, 'utf8');

  // Build UI loader file with static imports in dependency order
  const uiPlugins = meta.filter(m => m.hasUi);
  const nodeTypes = uiPlugins.map(m => m.nodeType);
  const nodeTypeSet = new Set(nodeTypes);
  const depEdges = [];
  for (const m of uiPlugins) {
    for (const depRaw of m.dependencies ?? []) {
      let depNode = depRaw;
      if (/^@hierarchidb\/.*-plugin$/.test(depRaw)) {
        depNode = deriveNodeType(depRaw) || depRaw;
      }
      if (nodeTypeSet.has(depNode)) {
        depEdges.push([depNode, m.nodeType]);
      }
    }
  }
  const order = topoSort(nodeTypes, depEdges);
  const ordered = order.filter(n => nodeTypeSet.has(n));

  const uiHeader = `// AUTO-GENERATED FILE. DO NOT EDIT.\n// Generated by scripts/generate-plugin-loader.mjs\n// This file exposes dynamic loaders for plugin UI entry points in dependency order.\n\n`;

  const uiLoaderEntries = ordered.map((nt) => {
    const pkg = uiPlugins.find(p => p.nodeType === nt)?.packageName;
    if (!pkg) {
      return `  '${nt}': async () => undefined,`;
    }
    return `  '${nt}': () => import('${pkg}/ui'),`;
  }).join('\n');

  const uiBody = `const uiLoaders: Record<string, () => Promise<unknown>> = {
${uiLoaderEntries}
};

export const uiPlugins = ${JSON.stringify(nodeTypes)} as const;
export const uiLoadOrder = ${JSON.stringify(ordered)} as const;

const loadedPlugins = new Set<string>();
let allLoaded = false;

export async function loadUIPlugin(nodeType: (typeof uiLoadOrder)[number]): Promise<boolean> {
  const loader = uiLoaders[nodeType];
  if (typeof loader !== 'function') {
    return false;
  }
  if (loadedPlugins.has(nodeType)) {
    return true;
  }
  try {
    await loader();
    loadedPlugins.add(nodeType);
    return true;
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('[ui-loader] Failed to load UI plugin', nodeType, error);
    }
    return false;
  }
}

export async function loadAllUIPlugins(): Promise<void> {
  if (allLoaded) return;
  let hadError = false;
  for (const nodeType of uiLoadOrder) {
    const ok = await loadUIPlugin(nodeType);
    if (!ok) {
      hadError = true;
    }
  }
  if (!hadError) {
    allLoaded = true;
  }
}

export function resetUiPluginLoadStateForTesting(): void {
  loadedPlugins.clear();
  allLoaded = false;
}
`;

  await fs.writeFile(outUiFile, uiHeader + '\n' + uiBody, 'utf8');

  const pluginDefinitionsPayload = meta.map((entry) => ({
    nodeType: entry.nodeType,
    name: entry.name,
    packageName: entry.packageName,
    version: entry.version,
    displayName: entry.displayName,
    priority: entry.priority,
    dependencies: entry.dependencies,
  }));

  const pluginRegistryPayload = meta.map((entry) => ({
    nodeType: entry.nodeType,
    packageName: entry.packageName,
    version: entry.version,
    hasUI: entry.hasUi,
    hasWorker: entry.hasWorker,
    hasDatabase: entry.hasDatabase,
    hasCommon: entry.hasCommon,
    dependencies: entry.dependencies,
    manifest: entry.manifest,
  }));

  const registryUiEntries = meta
    .filter((entry) => entry.hasUi)
    .map((entry) => `  '${entry.nodeType}': () => import('${entry.packageName}/ui'),`)
    .join('\n');
  const registryUiBlock = registryUiEntries ? `{
${registryUiEntries}
}` : '{}';

  const registryWorkerEntries = meta
    .filter((entry) => entry.hasWorker)
    .map((entry) => `  '${entry.nodeType}': () => import('${entry.packageName}/worker'),`)
    .join('\n');
  const registryWorkerBlock = registryWorkerEntries ? `{
${registryWorkerEntries}
}` : '{}';

  const registryHeader = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Generated by scripts/generate-plugin-loader.mjs
import type { PluginDefinition, PluginLoaderMap, PluginRegistryEntry } from './types.js';

`;

  const registryBody = `export const pluginDefinitions: PluginDefinition[] = ${JSON.stringify(pluginDefinitionsPayload, null, 2)};

export const pluginRegistry: PluginRegistryEntry[] = ${JSON.stringify(pluginRegistryPayload, null, 2)};

export const pluginMapUI: PluginLoaderMap = ${registryUiBlock};

export const pluginMapWorker: PluginLoaderMap = ${registryWorkerBlock};
`;

  await fs.writeFile(registryGeneratedFile, registryHeader + registryBody, 'utf8');

  const moduleSpecifiers = new Set();
  for (const entry of meta) {
    if (entry.hasUi) moduleSpecifiers.add(`${entry.packageName}/ui`);
    if (entry.hasWorker) moduleSpecifiers.add(`${entry.packageName}/worker`);
    if (entry.hasDatabase) moduleSpecifiers.add(`${entry.packageName}/database`);
  }

  const ambientHeader = '// AUTO-GENERATED FILE. DO NOT EDIT.\n// Generated by scripts/generate-plugin-loader.mjs\n';
  const ambientBody = Array.from(moduleSpecifiers)
    .sort((a, b) => a.localeCompare(b))
    .map((specifier) => `declare module '${specifier}';`)
    .join('\n');

  await fs.mkdir(registryTypesDir, { recursive: true });
  await fs.writeFile(registryAmbientModuleFile, `${ambientHeader}${ambientBody}\n`, 'utf8');

  const withWorkerCount = meta.filter((m) => m.hasWorker).length;
  const withUiCount = uiPlugins.length;
  console.log(`[generate-plugin-loader] Generated ${path.relative(repoRoot, outWorkerFile)}, ${path.relative(repoRoot, outUiFile)} and ${path.relative(repoRoot, registryGeneratedFile)} with ${meta.length} plugins (worker loaders: ${withWorkerCount}, ui loaders: ${withUiCount}).`);
}

if (import.meta.url === url.pathToFileURL(process.argv[1] ?? '').href) {
  generatePluginRegistry().catch((err) => {
    console.error('[generate-plugin-loader] Failed:', err);
    process.exit(1);
  });
}
