#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const appDir = path.join(repoRoot, 'app');
const appPkgPath = path.join(appDir, 'package.json');
const outDir = path.join(appDir, 'src', 'generated');
const outFile = path.join(outDir, 'loader.ts');
const outUiFile = path.join(outDir, 'ui-loader.ts');

/**
 * Derive nodeType from package name like @hierarchidb/plugins-<nodeType>-plugin
 */
function deriveNodeType(pkgName) {
  const match = pkgName.match(/@hierarchidb\/plugins-([a-z0-9-]+)-plugin$/);
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
  const require = createRequire(import.meta.url);
  // Try resolve via Node resolution first (workspace symlink in node_modules)
  try {
    const resolved = require.resolve(`${pkgName}/package.json`);
    const json = JSON.parse(await fs.readFile(resolved, 'utf8'));
    return { json, path: resolved, dir: path.dirname(resolved) };
  } catch {
    // Fallback to repo layout: packages/plugins/<nodeType>-plugin/package.json
    const fallback = path.join(repoRoot, 'packages', 'plugins', `${nodeType}-plugin`, 'package.json');
    if (await fileExists(fallback)) {
      const json = JSON.parse(await fs.readFile(fallback, 'utf8'));
      return { json, path: fallback, dir: path.dirname(fallback) };
    }
  }
  return { json: undefined, path: undefined, dir: undefined };
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

async function main() {
  const pkgJson = JSON.parse(await fs.readFile(appPkgPath, 'utf8'));
  const allDeps = {
    ...(pkgJson.dependencies || {}),
    ...(pkgJson.devDependencies || {}),
    ...(pkgJson.optionalDependencies || {}),
  };
  const pluginPkgs = Object.keys(allDeps)
    .filter((name) => /@hierarchidb\/plugins-[a-z0-9-]+-plugin$/.test(name))
    .sort();

  // Build metadata for each plugin, including whether it exports "./worker" and "./ui"
  const meta = [];
  for (const name of pluginPkgs) {
    const nodeType = deriveNodeType(name);
    if (!nodeType) continue;
    const { json, dir } = await readPluginPackageJSON(name, nodeType);
    const exportsField = json?.exports;
    const hasWorkerExportPath = !!(exportsField && Object.prototype.hasOwnProperty.call(exportsField, './worker'));
    const hasUiExportPath = !!(exportsField && Object.prototype.hasOwnProperty.call(exportsField, './ui'));

    let entityLoaderKind = 'none';
    let entityLoaderSymbol = undefined;
    let workerEntryPath;
    if (hasWorkerExportPath) {
      try {
        // Resolve worker entry path from exports
        const workerExport = exportsField['./worker'];
        const workerRel = typeof workerExport === 'string'
          ? workerExport
          : (typeof workerExport?.import === 'string' ? workerExport.import : (workerExport?.default || ''));
        if (typeof workerRel === 'string' && workerRel) {
          workerEntryPath = path.join(dir, workerRel);
        } else {
          workerEntryPath = path.join(dir, 'dist', 'worker', 'index.js');
        }
        // Robust check: dynamically import the worker entry and verify named export exists
        const className = `${capitalize(nodeType)}EntitiesDB`;
        const loaderName = `load${capitalize(nodeType)}EntitiesDB`;
        try {
          const urlStr = url.pathToFileURL(workerEntryPath).href;
          const mod = await import(urlStr);
          if (typeof mod[loaderName] === 'function') {
            entityLoaderKind = 'load';
            entityLoaderSymbol = loaderName;
          } else if (typeof mod[className] === 'function') {
            entityLoaderKind = 'class';
            entityLoaderSymbol = className;
          }
        } catch {
          // ignore import-time errors; leave entityLoaderKind as 'none'
        }
      } catch {
        // ignore resolution errors
      }
    }
    const hasEntitiesDbExport = entityLoaderKind !== 'none';

    // Read plugin metadata to compute UI dependency order
    const pluginMeta = json?.hierarchidb?.plugin || {};
    const uiDepsRaw = pluginMeta.dependencies || pluginMeta.config?.dependencies || pluginMeta.dependsOn || [];
    const uiDeps = Array.isArray(uiDepsRaw) ? uiDepsRaw.map(String) : [];

    meta.push({ name, nodeType, hasWorker: hasWorkerExportPath, hasUi: hasUiExportPath, hasEntitiesDbExport, entityLoaderKind, entityLoaderSymbol, uiDeps });
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
  var __HDB_PLUGIN_ENTITY_OVERRIDES__: Record<string, any> | undefined;
}
`;

  const importLines = meta
    .filter((p) => p.hasEntitiesDbExport)
    .map(({ name, nodeType }) => `import * as ${capitalize(nodeType)}Worker from '${name}/worker';`)
    .join('\n');


  const loaderEntries = meta
    .map(({ nodeType, hasWorker, hasEntitiesDbExport, entityLoaderKind, entityLoaderSymbol }) => {
      if (!hasWorker || !hasEntitiesDbExport) {
        return `  '${nodeType}': async () => undefined,`;
      }
      const workerNamespace = `${capitalize(nodeType)}Worker`;
      const className = `${capitalize(nodeType)}EntitiesDB`;
      if (entityLoaderKind === 'load') {
        const loaderSymbol = entityLoaderSymbol || `load${capitalize(nodeType)}EntitiesDB`;
        return `  '${nodeType}': async () => { try { const load = ${workerNamespace}['${loaderSymbol}'] as undefined | (() => Promise<unknown>); if (typeof load !== 'function') return undefined; const Ctor = await load(); if (typeof Ctor !== 'function') return undefined; const db = new (Ctor as any)(); if (typeof (db as any).open === 'function') { try { await (db as any).open(); } catch { /* ignore */ } } return db as PeerEntitiesDB; } catch { return undefined; } },`;
      }
      const symbol = entityLoaderSymbol || className;
      return `  '${nodeType}': async () => { try { const Ctor = ${workerNamespace}['${symbol}'] as unknown as (new () => PeerEntitiesDB) | undefined; if (!Ctor) return undefined; const db = new Ctor(); if (typeof (db as any).open === 'function') { try { await (db as any).open(); } catch { /* ignore */ } } return db as PeerEntitiesDB; } catch { return undefined; } },`;
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
  await fs.writeFile(outFile, content, 'utf8');

  // Build UI loader file with static imports in dependency order
  const uiPlugins = meta.filter(m => m.hasUi);
  const nodeTypes = uiPlugins.map(m => m.nodeType);
  const nodeTypeSet = new Set(nodeTypes);
  const depEdges = [];
  for (const m of uiPlugins) {
    for (const depRaw of m.uiDeps) {
      let depNode = depRaw;
      if (/^@hierarchidb\/plugins-.*-plugin$/.test(depRaw)) {
        depNode = deriveNodeType(depRaw) || depRaw;
      }
      if (nodeTypeSet.has(depNode)) {
        depEdges.push([depNode, m.nodeType]);
      }
    }
  }
  const order = topoSort(nodeTypes, depEdges);
  const ordered = order.filter(n => nodeTypeSet.has(n));

  const uiHeader = `// AUTO-GENERATED FILE. DO NOT EDIT.\n// Generated by scripts/generate-plugin-loader.mjs\n// This file statically imports UI entry points for all discovered plugins in dependency order.\n`;
  const uiImports = ordered.map((nt) => {
    const pkg = uiPlugins.find(p => p.nodeType === nt)?.name;
    return pkg ? `import '${pkg}/ui';` : '';
  }).filter(Boolean).join('\n');
  const uiBody = `\nexport const uiPlugins = ${JSON.stringify(nodeTypes)} as const;\nexport const uiLoadOrder = ${JSON.stringify(ordered)} as const;\n`;
  await fs.writeFile(outUiFile, uiHeader + '\n' + uiImports + '\n' + uiBody, 'utf8');

  console.log(`[generate-plugin-loader] Generated ${path.relative(repoRoot, outFile)} and ${path.relative(repoRoot, outUiFile)} with ${meta.length} plugins (with-worker: ${meta.filter(m=>m.hasWorker).length}, with-ui: ${uiPlugins.length}).`);
}

main().catch((err) => {
  console.error('[generate-plugin-loader] Failed:', err);
  process.exit(1);
});
