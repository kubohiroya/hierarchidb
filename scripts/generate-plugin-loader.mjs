import { promises as fs } from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const manifestLoaderPath = url.pathToFileURL(path.join(repoRoot, 'tools', 'plugin-manifest-loader.js')).href;
let loadPluginManifestFromFile = () => undefined;
try {
  ({ loadPluginManifestFromFile } = await import(manifestLoaderPath));
} catch (error) {
  console.warn('[generate-plugin-loader] Failed to load manifest loader:', error?.message ?? error);
  console.warn('[generate-plugin-loader] Continuing without manifest introspection.');
}
const appDir = path.join(repoRoot, 'app');
const appPkgPath = path.join(appDir, 'package.json');
const outDir = path.join(appDir, 'src', 'generated');
const outWorkerFile = path.join(outDir, 'worker-loader.ts');
const outUiFile = path.join(outDir, 'ui-loader.ts');
const registrySrcDir = path.join(repoRoot, 'packages', 'plugin-registry', 'src');
const registryGeneratedDir = path.join(registrySrcDir, 'generated');
const registryIndexFile = path.join(registryGeneratedDir, 'index.ts');
const registryAmbientModuleFile = path.join(registryGeneratedDir, 'plugin-modules.d.ts');

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

async function writeFileIfChanged(filePath, contents) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  try {
    const current = await fs.readFile(filePath, 'utf8');
    if (current === contents) {
      return false;
    }
  } catch {
    // ignore read errors; we'll write the file below.
  }
  await fs.writeFile(filePath, contents, 'utf8');
  return true;
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

function normalizeExportEntry(entry) {
  if (!entry) return undefined;
  if (typeof entry === 'string') {
    return { import: entry };
  }
  if (typeof entry !== 'object') {
    return undefined;
  }

  const info = {};
  if (typeof entry.import === 'string') info.import = entry.import;
  else if (typeof entry.default === 'string') info.import = entry.default;
  else if (typeof entry.require === 'string') info.import = entry.require;
  else if (typeof entry.module === 'string') info.import = entry.module;
  else if (typeof entry.browser === 'string') info.import = entry.browser;

  if (typeof entry.types === 'string') info.types = entry.types;
  if (typeof entry.typings === 'string' && !info.types) info.types = entry.typings;

  return Object.keys(info).length > 0 ? info : undefined;
}

function resolveExportInfo(exportsField, key) {
  if (!exportsField) return undefined;
  if (typeof exportsField === 'string') {
    return key === '.' ? { import: exportsField } : undefined;
  }
  if (typeof exportsField !== 'object') {
    return undefined;
  }

  const entry = key === '.' ? (exportsField['.'] ?? exportsField) : exportsField[key];
  return normalizeExportEntry(entry);
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

function toPosixPath(p) {
  return p.replace(/\\/g, '/');
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
    const exportInfo = new Map();

    if (exportsField && typeof exportsField === 'object' && !Array.isArray(exportsField)) {
      for (const key of Object.keys(exportsField)) {
        const info = resolveExportInfo(exportsField, key);
        if (info) exportInfo.set(key, info);
      }
    }

    const rootExportInfo = resolveExportInfo(exportsField, '.');
    if (rootExportInfo) exportInfo.set('.', rootExportInfo);
    const workerExportInfo = resolveExportInfo(exportsField, './worker');
    if (workerExportInfo) exportInfo.set('./worker', workerExportInfo);
    const uiExportInfo = resolveExportInfo(exportsField, './ui');
    if (uiExportInfo) exportInfo.set('./ui', uiExportInfo);
    const databaseExportInfo = resolveExportInfo(exportsField, './database');
    if (databaseExportInfo) exportInfo.set('./database', databaseExportInfo);
    const commonExportInfo = resolveExportInfo(exportsField, './common');
    if (commonExportInfo) exportInfo.set('./common', commonExportInfo);

    const workerExportRel = workerExportInfo?.import;
    const hasWorker = !!workerExportRel;
    const hasUi = !!uiExportInfo?.import;
    const hasDatabase = !!databaseExportInfo?.import;
    const hasCommon = !!commonExportInfo?.import;

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
      packageDir: dir,
      exportInfo,
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
  const workerChanged = await writeFileIfChanged(outWorkerFile, content);

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
  const uiChanged = await writeFileIfChanged(outUiFile, uiHeader + '\n' + uiBody);

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
import type { PluginDefinition, PluginLoaderMap, PluginRegistryEntry } from '../types.js';

`;

  const registryBody = `export const pluginDefinitions: PluginDefinition[] = ${JSON.stringify(pluginDefinitionsPayload, null, 2)};

export const pluginRegistry: PluginRegistryEntry[] = ${JSON.stringify(pluginRegistryPayload, null, 2)};

export const pluginMapUI: PluginLoaderMap = ${registryUiBlock};

export const pluginMapWorker: PluginLoaderMap = ${registryWorkerBlock};
`;

  const registryChanged = await writeFileIfChanged(registryIndexFile, registryHeader + registryBody);

  const moduleSpecifiers = new Set();
  for (const entry of meta) {
    for (const [key, info] of entry.exportInfo.entries()) {
      const specifier = key === '.' ? entry.packageName : `${entry.packageName}${key.replace(/^[.]/, '')}`;
      moduleSpecifiers.add(specifier);
    }
  }

  const ambientHeader = '// AUTO-GENERATED FILE. DO NOT EDIT.\n// Generated by scripts/generate-plugin-loader.mjs\n';
  const ambientBody = Array.from(moduleSpecifiers)
    .sort((a, b) => a.localeCompare(b))
    .map((specifier) => `declare module '${specifier}';`)
    .join('\n');

  const registryAmbientChanged = await writeFileIfChanged(registryAmbientModuleFile, `${ambientHeader}${ambientBody}\n`);

  const changedFiles = [];
  if (workerChanged) changedFiles.push(path.relative(repoRoot, outWorkerFile));
  if (uiChanged) changedFiles.push(path.relative(repoRoot, outUiFile));
  if (registryChanged) changedFiles.push(path.relative(repoRoot, registryIndexFile));
  if (registryAmbientChanged) changedFiles.push(path.relative(repoRoot, registryAmbientModuleFile));

  if (changedFiles.length > 0) {
    console.log('[generate-plugin-loader] Updated files:\n - ' + changedFiles.join('\n - '));
  } else {
    console.log('[generate-plugin-loader] No changes detected.');
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1] ?? '').href) {
  generatePluginRegistry().catch((err) => {
    console.error('[generate-plugin-loader] Failed:', err);
    process.exit(1);
  });
}
