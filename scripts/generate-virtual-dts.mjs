#!/usr/bin/env node
/*
  Generate .d.ts for Vite virtual modules used by the app:
  - virtual:plugin-definitions
  - virtual:plugin-registry-ui
  - virtual:plugin-registry-worker

  Output: app/.generated/types/*.d.ts
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const NODE_TYPE_DIR = path.join(ROOT, 'packages', 'plugins');
const OUT_DIR = path.join(ROOT, 'app', '.generated', 'types');

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function collect() {
  const out = [];
  if (!fs.existsSync(NODE_TYPE_DIR)) return out;
  for (const d of fs.readdirSync(NODE_TYPE_DIR, { withFileTypes: true })) {
    if (!d.isDirectory() || !/-plugin$/.test(d.name)) continue;
    const pkgJson = path.join(NODE_TYPE_DIR, d.name, 'package.json');
    const pkg = readJSON(pkgJson);
    if (!pkg?.name) continue;
    const nodeType = pkg.hierarchidb?.plugin?.nodeType || d.name.replace(/-plugin$/, '');
    const ex = pkg.exports || {};
    const has = (k) => typeof ex === 'object' && !!ex[k];
    const hasUI = has('./ui');
    const hasWorker = has('./worker');
    out.push({ nodeType, pkgName: pkg.name, version: pkg.version || '0.0.0', hasUI, hasWorker });
  }
  return out.sort((a,b)=> a.nodeType.localeCompare(b.nodeType));
}

function genPluginDefinitionsDts(entries) {
  // Keep interface stable and generic
  return `declare module 'virtual:plugin-definitions' {
  export interface PluginDefinition {
    name: string;
    version: string;
    packageName: string;
    nodeType: string;
    priority: number;
    plugin?: any;
    config?: any;
  }

  export const pluginDefinitions: PluginDefinition[];
  export default pluginDefinitions;
}
`;
}

function genRegistryUiDts(entries) {
  const keys = entries.map(e => `    '${e.nodeType}': () => Promise<unknown>;`).join('\n');
  return `declare module 'virtual:plugin-registry-ui' {
  export const pluginMapUI: {
${keys}
    [nodeType: string]: () => Promise<unknown>;
  };
}
`;
}

function genRegistryWorkerDts(entries) {
  const keys = entries.map(e => `    '${e.nodeType}': () => Promise<unknown>;`).join('\n');
  return `declare module 'virtual:plugin-registry-worker' {
  export const pluginMapWorker: {
${keys}
    [nodeType: string]: () => Promise<unknown>;
  };
}
`;
}

function main() {
  const entries = collect();
  ensureDir(OUT_DIR);
  const files = [
    ['virtual-plugin-definitions.d.ts', genPluginDefinitionsDts(entries)],
    ['virtual-plugin-registry-ui.d.ts', genRegistryUiDts(entries)],
    ['virtual-plugin-registry-worker.d.ts', genRegistryWorkerDts(entries)],
    ['virtual-mui-icon-map.d.ts', `declare module 'virtual:mui-icon-map' {\n  export const iconMap: Record<string, any>;\n  export default iconMap;\n}\n`],
  ];
  for (const [name, code] of files) {
    fs.writeFileSync(path.join(OUT_DIR, name), code, 'utf-8');
  }
  console.log(`[virtual-dts] Wrote ${files.length} declaration files to ${path.relative(ROOT, OUT_DIR)}`);
}

main();
