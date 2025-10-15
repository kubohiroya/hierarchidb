import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { ModuleNode, Plugin as VitePlugin, ViteDevServer } from 'vite';
import { detectNodeTypePlugins } from './detect-plugins.js';
import type {
  CreateRegistryPluginOptions,
  NodeTypePluginDetails,
  PluginRegistryEntry,
} from './types.js';

const require = createRequire(import.meta.url);
const { loadPluginManifestFromFile } = require('../../../../tools/plugin-manifest-loader.js') as typeof import('../../../../tools/plugin-manifest-loader.js');

const MODULE_DEFINITIONS = {
  maps: { id: 'virtual:plugin-node-types/maps', resolved: '\0virtual:plugin-node-types/maps' },
  services: { id: 'virtual:plugin-node-types/services', resolved: '\0virtual:plugin-node-types/services' },
  meta: { id: 'virtual:plugin-node-types/meta', resolved: '\0virtual:plugin-node-types/meta' },
  definitions: { id: 'virtual:plugin-definitions', resolved: '\0virtual:plugin-definitions' },
  legacyUI: { id: 'virtual:plugin-registry-ui', resolved: '\0virtual:plugin-registry-ui' },
  legacyWorker: { id: 'virtual:plugin-registry-worker', resolved: '\0virtual:plugin-registry-worker' },
  legacyServices: { id: 'virtual:plugin-registry-services', resolved: '\0virtual:plugin-registry-services' },
  legacyCommon: { id: 'virtual:plugin-registry-common', resolved: '\0virtual:plugin-registry-common' },
} as const;

interface GeneratedModules {
  maps: string;
  services: string;
  meta: string;
  definitions: string;
  legacyUI: string;
  legacyWorker: string;
  legacyServices: string;
  legacyCommon: string;
}

interface GeneratorContext {
  readonly rootDir: string;
  readonly debugDir: string | null;
  readonly minimal: boolean;
}

function readAppPluginDependencies(rootDir: string): Set<string> | null {
  try {
    const pkgPath = path.resolve(rootDir, 'app', 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
      optionalDependencies?: Record<string, unknown>;
    };
    const set = new Set<string>();
    const merge = (record: Record<string, unknown> | undefined) => {
      if (!record) return;
      for (const name of Object.keys(record)) {
        if (/^@hierarchidb\/.*-plugin$/.test(name)) {
          set.add(name);
        }
      }
    };
    merge(pkg.dependencies);
    merge(pkg.devDependencies);
    merge(pkg.optionalDependencies);
    return set;
  } catch (error) {
    console.warn('[plugin-node-types] Failed to read app/package.json for dependency filter:', error);
    return null;
  }
}

function filterByDependencies(
  plugins: NodeTypePluginDetails[],
  allowed: Set<string> | null,
): NodeTypePluginDetails[] {
  if (!allowed || allowed.size === 0) return plugins;
  return plugins.filter((plugin) => allowed.has(plugin.packageName));
}

function pickServiceExport(details: NodeTypePluginDetails): string {
  const order: Array<[string, boolean]> = [
    [details.subpaths.services.exportKey, details.subpaths.services.hasExport],
    [details.subpaths.database.exportKey, details.subpaths.database.hasExport],
    [details.subpaths.common.exportKey, details.subpaths.common.hasExport],
    ['.', details.subpaths.root.hasExport],
  ];
  const match = order.find(([_, ok]) => ok);
  return match ? match[0] : '.';
}

function loadManifest(details: NodeTypePluginDetails) {
  if (!details.manifestPath) return null;
  return loadPluginManifestFromFile(details.manifestPath, { silent: true }) ?? null;
}

function buildRegistryEntries(plugins: NodeTypePluginDetails[]): PluginRegistryEntry[] {
  return plugins.map((plugin) => ({
    nodeType: plugin.nodeType,
    packageName: plugin.packageName,
    version: plugin.version,
    hasUI: plugin.subpaths.ui.hasExport,
    hasWorker: plugin.subpaths.worker.hasExport,
    hasServices: plugin.subpaths.services.hasExport
      || plugin.subpaths.database.hasExport
      || plugin.subpaths.common.hasExport,
    hasCommon: plugin.subpaths.common.hasExport,
    fallbackServiceImport: pickServiceExport(plugin),
    manifest: loadManifest(plugin),
  }));
}

function createRegisterHelper(): string {
  return `const __registerExecuted = new WeakSet();
async function __callOnRegister(mod, tag) {
  const fn = mod && typeof mod === 'object' ? mod.onRegister : undefined;
  if (typeof fn !== 'function') {
    return mod;
  }
  if (__registerExecuted.has(mod)) {
    return mod;
  }
  try {
    const result = fn();
    const awaited = result && typeof result.then === 'function' ? await result : result;
    __registerExecuted.add(mod);
    return awaited ?? mod;
  } catch (error) {
    __registerExecuted.delete(mod);
    console.error('[plugin-node-types] onRegister failed for', tag, error);
    throw error;
  }
}
`;
}

function generateMapsModule(entries: PluginRegistryEntry[]): string {
  const helper = createRegisterHelper();
  const uiLines: string[] = [];
  const workerLines: string[] = [];
  const commonLines: string[] = [];

  for (const entry of entries) {
    const pkg = entry.packageName;
    const nodeType = entry.nodeType;

    uiLines.push(`  '${nodeType}': async () => {
    try {
      const mod = await import('${entry.hasUI ? `${pkg}/ui` : pkg}');
      return await __callOnRegister(mod, 'ui:${nodeType}');
    } catch (error) {
      console.warn('[plugin-node-types] UI fallback for ${nodeType}:', error?.message ?? error);
      const fallback = await import('${pkg}');
      return await __callOnRegister(fallback, 'ui:${nodeType}:fallback');
    }
  },`);

    if (entry.hasWorker) {
      workerLines.push(`  '${nodeType}': async () => {
    const mod = await import('${pkg}/worker');
    return await __callOnRegister(mod, 'worker:${nodeType}');
  },`);
    } else {
      workerLines.push(`  '${nodeType}': async () => ({ default: {} }),`);
    }

    if (entry.hasCommon) {
      const target = entry.fallbackServiceImport === './common' || entry.fallbackServiceImport === 'common'
        ? `${pkg}/common`
        : `${pkg}/common`;
      commonLines.push(`  '${nodeType}': async () => {
    const mod = await import('${target}');
    return await __callOnRegister(mod, 'common:${nodeType}');
  },`);
    } else {
      commonLines.push(`  '${nodeType}': async () => ({ default: {} }),`);
    }
  }

  return `${helper}
export const pluginMapUI = Object.freeze({
${uiLines.join('\n')}
});

export const pluginMapWorker = Object.freeze({
${workerLines.join('\n')}
});

export const pluginMapCommon = Object.freeze({
${commonLines.join('\n')}
});

export default pluginMapUI;
`;
}

function generateServicesModule(entries: PluginRegistryEntry[]): string {
  const helper = createRegisterHelper();
  const lines: string[] = [];
  for (const entry of entries) {
    const nodeType = entry.nodeType;
    if (!entry.hasServices) {
      lines.push(`  '${nodeType}': async () => ({ default: {} }),`);
      continue;
    }

    const target = entry.fallbackServiceImport === '.'
      ? entry.packageName
      : `${entry.packageName}${entry.fallbackServiceImport.replace(/^\./, '')}`;

    lines.push(`  '${nodeType}': async () => {
    try {
      const mod = await import('${target}');
      return await __callOnRegister(mod, 'services:${nodeType}');
    } catch (error) {
      console.error('[plugin-node-types] Service import failed for ${nodeType}:', error);
      return { default: {} };
    }
  },`);
  }

  return `${helper}
export const pluginServices = Object.freeze({
${lines.join('\n')}
});

export default pluginServices;
`;
}

function generateDefinitionsModule(entries: PluginRegistryEntry[]): string {
  const defs = entries.map((entry) => ({
    name: entry.nodeType,
    version: entry.version ?? '0.0.0',
    packageName: entry.packageName,
    nodeType: entry.nodeType,
    priority: entry.manifest?.priority ?? 1000,
    plugin: undefined,
    config: entry.manifest ?? {},
  }));
  return `export const pluginDefinitions = ${JSON.stringify(defs, null, 2)};
export default pluginDefinitions;
`;
}

function generateMetaModule(entries: PluginRegistryEntry[]): string {
  return `export const pluginRegistry = ${JSON.stringify(entries, null, 2)};
export default pluginRegistry;
`;
}

function generateCompatModule(sourceId: string, exportName: string, defaultName = exportName): string {
  return `import { ${exportName} } from '${sourceId}';
export { ${exportName} };
export default ${defaultName};
`;
}

function writeDebugSnapshot(ctx: GeneratorContext, entries: PluginRegistryEntry[], modules: GeneratedModules): void {
  if (!ctx.debugDir) return;
  try {
    fs.mkdirSync(ctx.debugDir, { recursive: true });
    const payload = {
      generatedAt: new Date().toISOString(),
      entries,
      modules,
    };
    fs.writeFileSync(path.join(ctx.debugDir, 'plugin-node-types.snapshot.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  } catch (error) {
    console.warn('[plugin-node-types] Failed to write debug snapshot', error);
  }
}

function generateAll(ctx: GeneratorContext): { entries: PluginRegistryEntry[]; modules: GeneratedModules } {
  if (ctx.minimal) {
    const emptyMaps = `export const pluginMapUI = Object.freeze({});
export const pluginMapWorker = Object.freeze({});
export const pluginMapCommon = Object.freeze({});
export default pluginMapUI;
`;
    const emptyServices = `export const pluginServices = Object.freeze({});
export default pluginServices;
`;
    const emptyDefinitions = `export const pluginDefinitions = [];
export default pluginDefinitions;
`;
    return {
      entries: [],
      modules: {
        maps: emptyMaps,
        services: emptyServices,
        meta: generateMetaModule([]),
        definitions: emptyDefinitions,
        legacyUI: generateCompatModule('virtual:plugin-node-types/maps', 'pluginMapUI'),
        legacyWorker: generateCompatModule('virtual:plugin-node-types/maps', 'pluginMapWorker'),
        legacyServices: generateCompatModule('virtual:plugin-node-types/services', 'pluginServices'),
        legacyCommon: generateCompatModule('virtual:plugin-node-types/maps', 'pluginMapCommon', 'pluginMapCommon'),
      },
    };
  }

  const allowedPackages = readAppPluginDependencies(ctx.rootDir);
  const detected = detectNodeTypePlugins({ rootDir: ctx.rootDir });
  const filtered = filterByDependencies(detected, allowedPackages);
  const entries = buildRegistryEntries(filtered);

  const modules: GeneratedModules = {
    maps: generateMapsModule(entries),
    services: generateServicesModule(entries),
    meta: generateMetaModule(entries),
    definitions: generateDefinitionsModule(entries),
    legacyUI: generateCompatModule('virtual:plugin-node-types/maps', 'pluginMapUI'),
    legacyWorker: generateCompatModule('virtual:plugin-node-types/maps', 'pluginMapWorker'),
    legacyServices: generateCompatModule('virtual:plugin-node-types/services', 'pluginServices'),
    legacyCommon: generateCompatModule('virtual:plugin-node-types/maps', 'pluginMapCommon', 'pluginMapCommon'),
  };

  writeDebugSnapshot(ctx, entries, modules);
  return { entries, modules };
}

export function createNodeTypeRegistryPlugin(options: CreateRegistryPluginOptions = {}): VitePlugin {
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : process.cwd();
  const minimalEnv = process.env.HDB_PLUGIN_MINIMAL === '1';
  const debugEnv = process.env.HDB_PLUGIN_DEBUG_MODE;
  const ctx: GeneratorContext = {
    rootDir,
    minimal: options.minimal ?? minimalEnv,
    debugDir: options.debugSnapshotDir
      ? path.resolve(rootDir, options.debugSnapshotDir)
      : debugEnv
        ? path.resolve(rootDir, typeof debugEnv === 'string' ? debugEnv : 'app/.debug')
        : null,
  };

  let generated = generateAll(ctx);

  const watchPattern = new RegExp(`${path.sep}plugins${path.sep}[^${path.sep}]+-plugin${path.sep}(package.json|src${path.sep}plugin-manifest.ts|src${path.sep}extension${path.sep}plugin-manifest.ts)$`);
  const appPackagePath = path.resolve(ctx.rootDir, 'app', 'package.json');

  function regenerate(server?: ViteDevServer): void {
    generated = generateAll(ctx);
    if (server) {
      for (const mod of Object.values(MODULE_DEFINITIONS)) {
        const graphModule = server.moduleGraph.getModuleById(mod.resolved);
        if (graphModule) {
          server.moduleGraph.invalidateModule(graphModule);
        }
      }
    }
  }

  return {
    name: '@hierarchidb/vite-plugin-node-type-registry:virtual-modules',
    enforce: 'pre',

    configResolved() {
      regenerate();
    },

    buildStart() {
      regenerate();
    },

    resolveId(id: string) {
      for (const mod of Object.values(MODULE_DEFINITIONS)) {
        if (id === mod.id) {
          return mod.resolved;
        }
      }
      return null;
    },

    load(id: string) {
      switch (id) {
        case MODULE_DEFINITIONS.maps.resolved:
          return generated.modules.maps;
        case MODULE_DEFINITIONS.services.resolved:
          return generated.modules.services;
        case MODULE_DEFINITIONS.meta.resolved:
          return generated.modules.meta;
        case MODULE_DEFINITIONS.definitions.resolved:
          return generated.modules.definitions;
        case MODULE_DEFINITIONS.legacyUI.resolved:
          return generated.modules.legacyUI;
        case MODULE_DEFINITIONS.legacyWorker.resolved:
          return generated.modules.legacyWorker;
        case MODULE_DEFINITIONS.legacyServices.resolved:
          return generated.modules.legacyServices;
        case MODULE_DEFINITIONS.legacyCommon.resolved:
          return generated.modules.legacyCommon;
        default:
          return null;
      }
    },

    configureServer(server: ViteDevServer) {
      const listener = (file: string) => {
        if (watchPattern.test(file)) {
          regenerate(server);
        }
      };
      server.watcher.on('add', listener);
      server.watcher.on('change', listener);
      server.watcher.on('change', (file) => {
        if (path.resolve(file) === appPackagePath) {
          regenerate(server);
        }
      });
    },

    handleHotUpdate(ctxHot: import('vite').HmrContext) {
      if (!watchPattern.test(ctxHot.file)) {
        if (path.resolve(ctxHot.file) !== appPackagePath) {
          return undefined;
        }
      }
      regenerate(ctxHot.server);
      const affected: ModuleNode[] = [];
      for (const mod of Object.values(MODULE_DEFINITIONS)) {
        const module = ctxHot.server.moduleGraph.getModuleById(mod.resolved);
        if (module) {
          affected.push(module);
        }
      }
      return affected;
    },
  };
}
