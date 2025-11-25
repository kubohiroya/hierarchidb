import { defineConfig, loadEnv } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import dts from 'vite-plugin-dts';
import * as fs from 'node:fs';
import * as path from 'path';
import { readFileSync } from 'node:fs';
import { faviconPlugin } from './vite-plugins/vite-plugin-favicon.js';
import { comlink } from 'vite-plugin-comlink';
import { visualizer } from 'rollup-plugin-visualizer';
import { createNodeTypeAliasPlugin } from './vite-plugins/vite-plugin-hierarchidb-plugin-alias/src/index.js';
import { pluginWorkerVirtualModule } from './vite-plugins/vite-plugin-plugin-worker-virtual.js';
import {
  collectWorkspacePackages,
  createDevAliasSelection,
  EMPTY_DEV_ALIAS_SELECTION,
  loadDevAliasConfig,
  parseDevAliasOverride,
  shouldUsePluginSource,
  shouldUseSource,
  toPosixRelative,
} from '../config/dev-alias-config.js';
import type { DevAliasSelection, WorkspacePackageMeta } from '../config/dev-alias-config.js';
import {
  generatePluginRegistry,
  type PluginSpecifierMode,
} from '../packages/tools/build-scripts/src/gen-plugin-registry.js';

if (!process.listenerCount('uncaughtException')) {
  process.on('uncaughtException', (error) => {
    console.error('[vite.config] uncaught exception', error?.message);
    if (error && typeof (error as any).url === 'string') {
      console.error('[vite.config] error url:', (error as any).url);
    }
    if (error && typeof (error as any).code === 'string') {
      console.error('[vite.config] error code:', (error as any).code);
    }
    if (error && typeof (error as any).stack === 'string') {
      console.error('[vite.config] stack:', (error as any).stack);
    }
    process.exit(1);
  });
}

if (!process.listenerCount('unhandledRejection')) {
  process.on('unhandledRejection', (reason) => {
    console.error('[vite.config] unhandled rejection', reason);
  });
}

type AliasEntry = { find: string | RegExp; replacement: string };

interface RuntimeAliasConfig {
  aliases: AliasEntry[];
  optimizeDepsExclude: string[];
}

function createRuntimeAliasConfig({
  rootDir,
  isDev,
  selection,
  workspacePackages,
}: {
  rootDir: string;
  isDev: boolean;
  selection: DevAliasSelection;
  workspacePackages: WorkspacePackageMeta[];
}): RuntimeAliasConfig {
  const aliasMap = new Map<string, AliasEntry>();
  const optimizeExclude = new Set<string>(['@hierarchidb/runtime-client']);

  const legacyUiMappings = [
    { spec: '@hierarchidb/components', src: '../packages/components/src/index.ts', dist: '../packages/components/dist/index.js' },
    { spec: '@hierarchidb/plugin-ui-host', src: '../packages/plugin-ui-host/src/index.ts', dist: '../packages/plugin-ui-host/dist/index.js' },
    { spec: '@hierarchidb/ui-auth', src: '../packages/ui/auth/src/index.ts', dist: '../packages/ui/auth/dist/index.js' },
    { spec: '@hierarchidb/ui-dialog', src: '../packages/ui/dialog/src/index.ts', dist: '../packages/ui/dialog/dist/index.js' },
    { spec: '@hierarchidb/ui-icon', src: '../packages/ui/icon/src/index.ts', dist: '../packages/ui/icon/dist/index.js' },
    { spec: '@hierarchidb/ui-i18n', src: '../packages/ui/i18n/src/index.ts', dist: '../packages/ui/i18n/dist/index.js' },
    { spec: '@hierarchidb/ui-layout', src: '../packages/ui/layout/src/index.ts', dist: '../packages/ui/layout/dist/index.js' },
    { spec: '@hierarchidb/ui-map', src: '../packages/ui/map/src/index.ts', dist: '../packages/ui/map/dist/index.js' },
    { spec: '@hierarchidb/ui-navigation', src: '../packages/ui/navigation/src/index.ts', dist: '../packages/ui/navigation/dist/index.js' },
    { spec: '@hierarchidb/ui-routing', src: '../packages/ui/routing/src/index.ts', dist: '../packages/ui/routing/dist/index.js' },
    { spec: '@hierarchidb/ui-theme', src: '../packages/ui/theme/src/index.ts', dist: '../packages/ui/theme/dist/index.js' },
    { spec: '@hierarchidb/ui-tour', src: '../packages/ui/tour/src/index.ts', dist: '../packages/ui/tour/dist/index.js' },
    { spec: '@hierarchidb/ui-treeconsole-base', src: '../packages/ui/treeconsole/base/src/index.ts', dist: '../packages/ui/treeconsole/base/dist/index.js' },
    { spec: '@hierarchidb/ui-treeconsole-breadcrumb', src: '../packages/ui/treeconsole/breadcrumb/src/index.ts', dist: '../packages/ui/treeconsole/breadcrumb/dist/index.js' },
    { spec: '@hierarchidb/ui-treeconsole-toolbar', src: '../packages/ui/treeconsole/toolbar/src/index.ts', dist: '../packages/ui/treeconsole/toolbar/dist/index.js' },
    { spec: '@hierarchidb/ui-treeconsole-treetable', src: '../packages/ui/treeconsole/treetable/src/index.ts', dist: '../packages/ui/treeconsole/treetable/dist/index.js' },
    { spec: '@hierarchidb/ui-usermenu', src: '../packages/ui/usermenu/src/index.ts', dist: '../packages/ui/usermenu/dist/index.js' },
    { spec: '@hierarchidb/ui-plugin-basic-info', src: '../packages/ui/plugin-basic-info/src/index.ts', dist: '../packages/ui/plugin-basic-info/dist/index.js' },
  ] as const;

  const legacyFeatureMappings = [
    { spec: '@hierarchidb/common-api', src: '../packages/common/api/src/index.ts', dist: '../packages/common/api/dist/index.js' },
    { spec: '@hierarchidb/common-auth', src: '../packages/common/auth/src/index.ts', dist: '../packages/common/auth/dist/index.js' },
    { spec: '@hierarchidb/common-types', src: '../packages/common/types/src/index.ts', dist: '../packages/common/types/dist/index.js' },
    { spec: '@hierarchidb/util', src: '../packages/util/src/index.ts', dist: '../packages/util/dist/index.js' },
    { spec: '@hierarchidb/runtime-client', src: '../packages/runtime/client/src/index.ts', dist: '../packages/runtime/client/dist/index.js' },
    { spec: '@hierarchidb/runtime-worker', src: '../packages/runtime/worker/src/index.ts', dist: '../packages/runtime/worker/dist/index.js' },
    { spec: '@hierarchidb/map-adapter', src: '../packages/features/map-adapter/src/index.ts', dist: '../packages/features/map-adapter/dist/index.js' },
    { spec: '@hierarchidb/plugin-presentation', src: '../packages/plugin-presentation/src/index.ts', dist: '../packages/plugin-presentation/dist/index.js' },
    { spec: '@hierarchidb/plugin-registry', src: '../packages/plugin-registry/generated/registry.ts', dist: '../packages/plugin-registry/dist/registry.js' },
    { spec: '@hierarchidb/plugin-registry/derivations', src: '../packages/plugin-registry/src/derivations.ts', dist: '../packages/plugin-registry/dist/derivations.js' },
    { spec: '@hierarchidb/plugin-registry/types', src: '../packages/plugin-registry/src/types.ts', dist: '../packages/plugin-registry/dist/types.d.ts' },
    { spec: '@hierarchidb/plugin-ui-sdk', src: '../packages/plugin-ui-sdk/src/index.ts', dist: '../packages/plugin-ui-sdk/dist/index.js' },
    { spec: '@hierarchidb/folder-plugin', src: '../plugins/folder-plugin/src/index.ts', dist: '../plugins/folder-plugin/dist/index.js' },
    { spec: '@hierarchidb/location-plugin', src: '../plugins/location-plugin/src/index.ts', dist: '../plugins/location-plugin/dist/index.js' },
    { spec: '@hierarchidb/linker-plugin', src: '../plugins/linker-plugin/src/index.ts', dist: '../plugins/linker-plugin/dist/index.js' },
    { spec: '@hierarchidb/resolver-plugin', src: '../plugins/resolver-plugin/src/index.ts', dist: '../plugins/resolver-plugin/dist/index.js' },
    { spec: '@hierarchidb/route-plugin', src: '../plugins/route-plugin/src/index.ts', dist: '../plugins/route-plugin/dist/index.js' },
    { spec: '@hierarchidb/shape-plugin', src: '../plugins/shape-plugin/src/index.ts', dist: '../plugins/shape-plugin/dist/index.js' },
    { spec: '@hierarchidb/spreadsheet-plugin', src: '../plugins/spreadsheet-plugin/src/index.ts', dist: '../plugins/spreadsheet-plugin/dist/index.js' },
    { spec: '@hierarchidb/styler-plugin', src: '../plugins/styler-plugin/src/index.ts', dist: '../plugins/styler-plugin/dist/index.js' },
    { spec: '@hierarchidb/tabular-source-xlsx', src: '../packages/features/tabular-source-xlsx/src/index.ts', dist: '../packages/features/tabular-source-xlsx/dist/index.js' },
    { spec: '@hierarchidb/timeline-plugin', src: '../plugins/timeline-plugin/src/index.ts', dist: '../plugins/timeline-plugin/dist/index.js' },
  ] as const;

  const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const addAlias = (
    specifier: string,
    relativePath: string | null,
    { exclude = false, exact = false } = {},
  ) => {
    if (!relativePath) return;
    const absolutePath = path.resolve(rootDir, relativePath);
    if (!fs.existsSync(absolutePath)) return;
    if (aliasMap.has(specifier)) {
      aliasMap.delete(specifier);
    }
    const find = exact ? new RegExp(`^${escapeForRegex(specifier)}$`) : specifier;
    aliasMap.set(specifier, { find, replacement: absolutePath });
    if (exclude) optimizeExclude.add(specifier);
  };

  const registerMetadataAliases = () => {
    const files = ['gadm.json', 'geoboundaries.json', 'naturalearth.json', 'osm.json'];
    for (const fileName of files) {
      addAlias(
        `@hierarchidb/fetch-save-metadata/output/${fileName}`,
        `../packages/features/fetch-save-metadata/output/${fileName}`,
        { exclude: true, exact: true }
      );
    }
  };

  registerMetadataAliases();

  const processedPackages = new Set<string>();
  const shouldAliasPackage = (specifier: string, group?: string) => shouldUseSource(selection, specifier, group);

  const registerDevPackage = (
    specifier: string,
    relativeSrc: string,
    options: { group?: string; exclude?: boolean } = {},
  ) => {
    if (!isDev) return;
    if (!shouldAliasPackage(specifier, options.group)) return;
    addAlias(specifier, relativeSrc, { exclude: options.exclude ?? true, exact: true });
    processedPackages.add(specifier);
  };

  const resolvePluginCandidate = (candidates: string[], pluginName: string): string | null => {
    for (const candidate of candidates) {
      const resolved = path.resolve(rootDir, `../plugins/${pluginName}/${candidate}`);
      if (fs.existsSync(resolved)) {
        return `../plugins/${pluginName}/${candidate}`;
      }
    }
    return null;
  };

  if (isDev) {
    registerDevPackage('@hierarchidb/runtime-worker', '../packages/runtime/worker/src/index.ts', {
      group: 'runtime',
      exclude: true,
    });
    addAlias('@hierarchidb/runtime-worker/stage-worker', '../packages/runtime/worker/src/stageWorker.entry.ts', {
      exclude: true,
      exact: true,
    });
    registerDevPackage('@hierarchidb/runtime-client', '../packages/runtime/client/src/index.ts', {
      group: 'runtime',
      exclude: true,
    });
    registerDevPackage('@hierarchidb/map-adapter', '../packages/features/map-adapter/src/index.ts', {
      group: 'features',
      exclude: true,
    });
    registerDevPackage('@hierarchidb/tabular-source-xlsx', '../packages/features/tabular-source-xlsx/src/index.ts', {
      group: 'features',
      exclude: true,
    });
    registerDevPackage('@hierarchidb/ui-shell/ui-i18n', '../packages/ui/i18n/src/index.ts', {
      group: 'ui',
      exclude: true,
    });
    registerDevPackage('@hierarchidb/ui-shell/ui-icon', '../packages/ui/icon/src/index.ts', {
      group: 'ui',
      exclude: true,
    });

    for (const mapping of [...legacyUiMappings, ...legacyFeatureMappings]) {
      addAlias(mapping.spec, mapping.src, { exclude: true, exact: true });
    }

    if (workspacePackages.length > 0) {
      for (const meta of workspacePackages) {
        if (meta.category !== 'packages') continue;
        if (processedPackages.has(meta.name)) continue;
        if (!shouldAliasPackage(meta.name, meta.group)) continue;
        if (!meta.srcEntry) continue;

        const baseRelative = toPosixRelative(rootDir, meta.srcEntry);
        addAlias(meta.name, baseRelative, { exclude: true, exact: true });
        processedPackages.add(meta.name);

      }
    }

    const pluginPkgRoot = path.resolve(rootDir, '../plugins');
    if (fs.existsSync(pluginPkgRoot)) {
      const workerCandidates = ['src/worker/index.ts', 'src/worker.ts'];
      const workerFactoryCandidates = ['src/worker/factory/index.ts', 'src/worker-factory/index.ts', 'src/worker-factory.ts'];
      const workerDatabaseCandidates = [
        'src/worker/database/index.ts',
        'src/services/database/index.ts',
        'src/database/index.ts',
        'src/database.ts',
      ];
      const uiCandidates = ['src/ui/index.ts', 'src/ui.ts'];
      const iconCandidates = ['src/icon/index.ts', 'src/icon.ts'];
      const rootCandidates = ['src/index.ts', 'src/index.tsx', 'src/index.mts', 'src/index.mjs', 'src/index.js', 'src/index.cjs'];

      for (const entry of fs.readdirSync(pluginPkgRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (!entry.name.endsWith('-plugin')) continue;

        const pluginName = entry.name;
        const specBase = `@hierarchidb/${pluginName}`;

        if (!shouldUsePluginSource(selection, specBase, pluginName)) continue;

        const rootRel = resolvePluginCandidate(rootCandidates, pluginName);
        if (rootRel) {
          addAlias(specBase, rootRel, { exclude: true });
        }

        const workerRel = resolvePluginCandidate(workerCandidates, pluginName);
        if (workerRel) {
          addAlias(`${specBase}/worker`, workerRel, { exclude: true });
        }

        const workerFactoryRel = resolvePluginCandidate(workerFactoryCandidates, pluginName);
        if (workerFactoryRel) {
          addAlias(`${specBase}/worker-factory`, workerFactoryRel, { exclude: true });
        }

        const workerDbRel = resolvePluginCandidate(workerDatabaseCandidates, pluginName);
        if (workerDbRel) {
          addAlias(`${specBase}/worker/database`, workerDbRel, { exclude: true });
          addAlias(`${specBase}/database`, workerDbRel, { exclude: true });
        }

        const uiRel = resolvePluginCandidate(uiCandidates, pluginName);
        if (uiRel) {
          addAlias(`${specBase}/ui`, uiRel, { exclude: true });
        }

        const iconRel = resolvePluginCandidate(iconCandidates, pluginName);
        if (iconRel) {
          addAlias(`${specBase}/icon`, iconRel, { exclude: true });
        }
      }
    }
  } else {
    addAlias('@hierarchidb/runtime-worker', '../packages/runtime/worker/dist/index.js', { exact: true });
    addAlias('@hierarchidb/runtime-worker/stage-worker', '../packages/runtime/worker/dist/stageWorker.entry.js', {
      exclude: true,
      exact: true,
    });
    addAlias('@hierarchidb/runtime-client', '../packages/runtime/client/dist/index.js', { exact: true });
    addAlias('@hierarchidb/map-adapter', '../packages/features/map-adapter/dist/index.js', { exclude: true, exact: true });
    addAlias('@hierarchidb/tabular-source-xlsx', '../packages/features/tabular-source-xlsx/dist/index.js', { exclude: true, exact: true });
    addAlias('@hierarchidb/ui-shell/ui-i18n', '../packages/ui/i18n/dist/index.js', { exclude: true, exact: true });

    for (const mapping of [...legacyUiMappings, ...legacyFeatureMappings]) {
      addAlias(mapping.spec, mapping.dist, { exclude: true, exact: true });
    }

    const pluginPkgRoot = path.resolve(rootDir, '../plugins');
    if (fs.existsSync(pluginPkgRoot)) {
      const workerEntryCandidates = ['src/worker/index.ts', 'src/worker.ts'];
      const uiCandidates = ['src/ui/index.ts', 'src/ui.ts'];
      const iconCandidates = ['src/icon/index.ts', 'src/icon.ts'];
      const databaseCandidates = ['src/services/database/index.ts', 'src/database/index.ts', 'src/database.ts'];
      const rootCandidates = ['src/index.ts', 'src/index.tsx', 'src/index.mts', 'src/index.mjs', 'src/index.js', 'src/index.cjs'];
      for (const entry of fs.readdirSync(pluginPkgRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (!entry.name.endsWith('-plugin')) continue;

        const pluginName = entry.name;
        const specBase = `@hierarchidb/${pluginName}`;
        const rootDistRel = `../plugins/${pluginName}/dist/index.js`;
        const rootDistAbs = path.resolve(rootDir, rootDistRel);
        if (fs.existsSync(rootDistAbs)) {
          addAlias(specBase, rootDistRel, { exact: true });
        } else {
          const rootSrcRel = resolvePluginCandidate(rootCandidates, pluginName);
          if (rootSrcRel) {
            addAlias(specBase, rootSrcRel);
          }
        }

        const workerDistRel = `../plugins/${pluginName}/dist/worker/index.js`;
        const workerDistAbs = path.resolve(rootDir, workerDistRel);
        if (fs.existsSync(workerDistAbs)) {
          addAlias(`${specBase}/worker`, workerDistRel);
        } else {
          const workerSrcRel = resolvePluginCandidate(workerEntryCandidates, pluginName);
          if (workerSrcRel) {
            addAlias(`${specBase}/worker`, workerSrcRel, { exclude: true });
          }
        }
        const uiDistRel = `../plugins/${pluginName}/dist/ui/index.js`;
        const uiDistAbs = path.resolve(rootDir, uiDistRel);
        if (fs.existsSync(uiDistAbs)) {
          addAlias(`${specBase}/ui`, uiDistRel);
        } else {
          const uiSrcRel = resolvePluginCandidate(uiCandidates, pluginName);
          if (uiSrcRel) {
            addAlias(`${specBase}/ui`, uiSrcRel, { exclude: true });
          }
        }

        const iconDistCandidates = [`../plugins/${pluginName}/dist/icon/index.js`];
        const iconDistRel = iconDistCandidates.find((candidate) => fs.existsSync(path.resolve(rootDir, candidate)));
        if (iconDistRel) {
          addAlias(`${specBase}/icon`, iconDistRel);
        } else {
          const iconSrcRel = resolvePluginCandidate(iconCandidates, pluginName);
          if (iconSrcRel) {
            addAlias(`${specBase}/icon`, iconSrcRel, { exclude: true });
          }
        }

        const databaseDistCandidates = [
          `../plugins/${pluginName}/dist/services/database/index.js`,
          `../plugins/${pluginName}/dist/worker/database/index.js`,
          `../plugins/${pluginName}/dist/database/index.js`,
        ];
        const databaseDistRel = databaseDistCandidates.find((candidate) => fs.existsSync(path.resolve(rootDir, candidate)));
        if (databaseDistRel) {
          addAlias(`${specBase}/database`, databaseDistRel);
        } else {
          const databaseSrcRel = resolvePluginCandidate(databaseCandidates, pluginName);
          if (databaseSrcRel) {
            addAlias(`${specBase}/database`, databaseSrcRel, { exclude: true });
          }
        }
      }
    }
  }

  return {
    aliases: Array.from(aliasMap.values()).sort((a, b) => {
      const aLen = typeof a.find === 'string' ? a.find.length : 0;
      const bLen = typeof b.find === 'string' ? b.find.length : 0;
      return bLen - aLen;
    }),
    optimizeDepsExclude: Array.from(optimizeExclude),
  };
}

const facadePrefixMap = [
  { prefix: '@hierarchidb/', targetPrefix: '@hierarchidb/' },
  { prefix: '@hierarchidb/ui-shell/', targetPrefix: '@hierarchidb/' },
] as const;

function facadeAliasPlugin(): Plugin {
  return {
    name: 'hierarchidb:facade-alias',
    async resolveId(source, importer, options) {
      for (const entry of facadePrefixMap) {
        if (!source.startsWith(entry.prefix)) continue;
        const subpath = source.slice(entry.prefix.length);
        const normalized = `${entry.targetPrefix}${subpath}`;
        const resolved = await this.resolve(normalized, importer, { ...options, skipSelf: true });
        if (resolved) return resolved;
        return normalized;
      }
      return null;
    },
  };
}

function missingSourceMapFallbackPlugin(): Plugin {
  return {
    name: 'hierarchidb:missing-sourcemap-fallback',
    apply: 'serve',
    configureServer(server) {
      const reported = new Set<string>();
      server.middlewares.use((req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';
        if (!url.endsWith('.map')) return next();

        const relativePath = url.startsWith('/') ? url.slice(1) : url;
        const candidates = [
          path.resolve(server.config.root, relativePath),
          path.resolve(__dirname, relativePath),
        ];

        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            return next();
          }
        }

        if (!reported.has(url)) {
          server.config.logger.warn(`sourcemap request ${url} not found; responding with 204`);
          reported.add(url);
        }
        res.statusCode = 204;
        res.end();
      });
    },
  };
}

const pluginManifestWatchPattern = new RegExp(
  `${path.sep}plugins${path.sep}[^${path.sep}]+-plugin${path.sep}(package.json|src${path.sep}plugin-manifest.ts|src${path.sep}extension${path.sep}plugin-manifest.ts)$`,
);

let pluginRegistryGenerationQueue: Promise<unknown> = Promise.resolve();

function enqueuePluginRegistryGeneration(mode: PluginSpecifierMode) {
  pluginRegistryGenerationQueue = pluginRegistryGenerationQueue
    .then(() => generatePluginRegistry({ mode }))
    .catch((error) => {
      console.error('[plugin-registry-generator] Failed to regenerate registry', error);
    });
  return pluginRegistryGenerationQueue;
}

function pluginRegistryGeneratorPlugin({ rootDir, mode }: { rootDir?: string; mode: PluginSpecifierMode }): Plugin {
  const resolvedRoot = rootDir ? path.resolve(rootDir) : path.resolve(__dirname, '..');
  const appPackagePath = path.resolve(resolvedRoot, 'app', 'package.json');

  const shouldTrigger = (file: string): boolean => {
    const normalized = path.resolve(file);
    return normalized === appPackagePath || pluginManifestWatchPattern.test(normalized);
  };

  return {
    name: 'hierarchidb:plugin-registry-generator',
    async configResolved() {
      await enqueuePluginRegistryGeneration(mode);
    },
    configureServer(server) {
      const schedule = (file: string) => {
        if (shouldTrigger(file)) {
          void enqueuePluginRegistryGeneration(mode);
        }
      };
      server.watcher.on('add', schedule);
      server.watcher.on('change', schedule);
    },
    async handleHotUpdate(ctx) {
      if (shouldTrigger(ctx.file)) {
        await enqueuePluginRegistryGeneration(mode);
      }
      return undefined;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Prefer VITE_APP_PREFIX if provided; otherwise default to root '/'
  const appPrefix = (env.VITE_APP_PREFIX || env.VITE_APP_NAME || '').replace(/^\/+|\/+$/g, '');
  const base = appPrefix ? `/${appPrefix}/` : '/';
  const isDev = mode === 'development';
  const enableWorkspaceAliases = mode === 'development' || mode === 'test';

  const ssrExternalDeps = ['@mui/material', '@mui/system', '@mui/utils', 'node-fetch', 'whatwg-url', 'tr46'];

  const repoRoot = path.resolve(__dirname, '..');
  const baseDevAliasConfig = loadDevAliasConfig(repoRoot);
  const effectiveDevAliasConfig = parseDevAliasOverride(
    env.VITE_DEV_ALIAS_OVERRIDE || process.env.VITE_DEV_ALIAS_OVERRIDE,
    baseDevAliasConfig,
  );
  const devAliasSelection: DevAliasSelection = enableWorkspaceAliases
    ? createDevAliasSelection(effectiveDevAliasConfig)
    : EMPTY_DEV_ALIAS_SELECTION;
  const workspacePackages: WorkspacePackageMeta[] = enableWorkspaceAliases
    ? collectWorkspacePackages(repoRoot)
    : [];

  const runtimeAliasConfig = createRuntimeAliasConfig({
    rootDir: __dirname,
    isDev: enableWorkspaceAliases,
    selection: devAliasSelection,
    workspacePackages,
  });

  console.log('[vite.config] TRACE_THIS=', process.env.TRACE_THIS);

  const enableBuildTrace = env.HDB_TRACE_BUILD === '1' || process.env.HDB_TRACE_BUILD === '1';
  const enableThisTrace = process.env.TRACE_THIS === '1';
  const rollupTraceLog = path.resolve(repoRoot, '.vite-rollup-trace.log');
  const thisTraceLog = path.resolve(repoRoot, '.this-trace.log');

  const rollupTracePlugin: Plugin | null = enableBuildTrace
    ? {
        name: 'hierarchidb:rollup-trace',
        buildStart() {
          try {
            fs.writeFileSync(rollupTraceLog, '');
          } catch (error) {
            console.warn('[rollup-trace] failed to initialize log', error);
          }
        },
        load(id) {
          try {
            fs.appendFileSync(rollupTraceLog, `${new Date().toISOString()} load ${id}\n`);
          } catch (error) {
            console.warn('[rollup-trace] append failed (load)', error);
          }
          return null;
        },
        transform(_code, id) {
          try {
            fs.appendFileSync(rollupTraceLog, `${new Date().toISOString()} transform ${id}\n`);
            if (typeof _code === 'string' && _code.trim() === 'this') {
              fs.appendFileSync(rollupTraceLog, `${new Date().toISOString()} transform-content ${id} => 'this'\n`);
            }
          } catch (error) {
            console.warn('[rollup-trace] append failed (transform)', error);
          }
          return null;
        },
      }
    : null;

  const thisTracePlugin: Plugin | null = enableThisTrace
    ? {
        name: 'hierarchidb:this-trace',
        apply: 'build',
        buildStart() {
          console.log('[this-trace] enabled; logging to', thisTraceLog);
          try {
            fs.writeFileSync(thisTraceLog, '');
          } catch (error) {
            console.warn('[this-trace] failed to initialize log', error);
          }
        },
        load(id) {
          try {
            fs.appendFileSync(thisTraceLog, `${new Date().toISOString()} load ${id}\n`);
          } catch (error) {
            console.warn('[this-trace] load log failed', error);
          }
          return null;
        },
        transform(code, id) {
          //const text = typeof code === 'string' ? code : Buffer.isBuffer(code) ? code.toString('utf8') : null;
          const text = code;
          if (text !== null) {
            const trimmed = text.trim();
            if (trimmed === 'this') {
              try {
                fs.appendFileSync(thisTraceLog, `${new Date().toISOString()} HIT transform id=${id}\n`);
              } catch (error) {
                console.warn('[this-trace] transform log failed', error);
              }
            }
            return { code: text, map: null };
          }
          return null;
        },
      }
    : null;

  // Note: Guidance logs are printed by hdb-dev-banner plugin after server starts.

  //  main thread
  const plugins = [
    pluginRegistryGeneratorPlugin({
      rootDir: repoRoot,
      mode: isDev ? 'package' : 'dist-url',
    }),
    createNodeTypeAliasPlugin({
      rootDir: repoRoot,
      shouldAlias: (entry) => isDev && shouldUsePluginSource(devAliasSelection, entry.packageName, entry.nodeType),
    }),
    facadeAliasPlugin(),
    pluginWorkerVirtualModule(),
    /*
    devHealthPlugin({
      // Ignore virtual/server-only or known peer-provided modules to avoid false positives
      ignore: [
        '@emotion/react',
        'react-hook-geolocation',
        'comlink',
        'isbot',
        // Provided as app deps but sometimes hoisted/resolved at root in monorepo
        'react-resizable',
        'react-draggable',
      ],
    }),
     */
    // HierarchiDB plugin package discovery -> virtual modules
    // Generate d.ts only when explicitly enabled (apps usually don't need it)
    ...(env.VITE_APP_DTS === 'true'
      ? [
          dts({
            outDir: isSsrBuild ? 'build/server-types' : 'build/client-types',
            rollupTypes: false,
            insertTypesEntry: false,
            copyDtsFiles: true,
          }),
        ]
      : []),
    faviconPlugin(), // Add favicon plugin to serve favicon at root
    missingSourceMapFallbackPlugin(),
    comlink(), // Add Comlink plugin for Worker support
    // tsconfigPaths is appended after runtime alias configuration.
    // It is re-injected below after dev alias filtering.
  ];

  const enableVisualizer = (env.VITE_APP_ANALYZE || process.env.HDB_ANALYZE || process.env.BUNDLE_ANALYZE || '')
    .toString()
    .toLowerCase() === 'true';
  if (enableVisualizer) {
    const suffix = isSsrBuild ? 'server' : 'client';
    const analysisDir = path.resolve(__dirname, 'build-analysis');
    plugins.push(
      visualizer({
        filename: path.join(analysisDir, `bundle-visualizer-${suffix}.html`),
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
        emitFile: false,
        // ssr: isSsrBuild,
      }),
    );
  }

  // Enable tsconfig path rewrites only when developing or explicitly requested.
  // In production builds the plugin would re-alias workspace packages back to src/,
  // which breaks dist-only plugins (e.g. database/icon subpaths).
  const enableTsconfigPaths =
    isDev ||
    mode === 'test' ||
    env.VITE_TSCONFIG_PATHS === 'true' ||
    process.env.HDB_TSCONFIG_PATHS === '1';

  if (enableTsconfigPaths) {
    plugins.push(
      tsconfigPaths({
        projects: ['./tsconfig.json'],
      }),
    );
  }

  if (thisTracePlugin) {
    plugins.push(thisTracePlugin);
  }

  if (process.env.DEBUG_WORKER_HMR === '1') {
    console.log('[vite.config] main plugin order', plugins.map((p) => p && (p as any).name));
  }

  // beacon values captured in closure
  const buildTime = new Date().toISOString();
  let appVersion = '0.0.0-dev';
  try {
    const pkgPath = path.resolve(__dirname, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    if (pkg?.version) appVersion = pkg.version;
  } catch {
    // no-op: fallback to default version when package.json is not accessible
  }

  const buildBeaconPlugin: Plugin = {
    name: 'hdb-build-beacon',
    configureServer(server: ViteDevServer) {
      const startedAt = new Date().toISOString();
      const beaconHandler = (_req: XMLHttpRequest, res: any) => {
        const payload = {
          appVersion,
          buildTime,
          serverStartedAt: startedAt,
          pid: process.pid,
          cwd: process.cwd(),
        };
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(payload));
      };
      server.middlewares.use('/__hdb_build.json', beaconHandler);
    },
  };

  // Simple dev-time CORS-bypass proxy via query param (?url=...)
  const hdbDevProxyPlugin: Plugin = {
    name: 'hdb-dev-proxy',
    configureServer(server: ViteDevServer) {
      const handler = async (req: any, res: any, next: any) => {
        try {
          // Allow only localhost callers
          const remote = (req.socket?.remoteAddress || '').toString();
          const forwardedHeader = req.headers['x-forwarded-for'];
          const forwarded = (Array.isArray(forwardedHeader) ? forwardedHeader[0] : forwardedHeader || '').split(',')[0].trim();
          const hostHeader = (req.headers['host'] || '').toString();
          const isLocalAddr = (addr: string) => !!addr && (
            addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
          );
          const isLocalHostHeader = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(hostHeader);
          const isLocal = isLocalAddr(remote) || isLocalAddr(forwarded) || isLocalHostHeader;
          if (!isLocal) {
            res.statusCode = 403;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: 'forbidden', message: 'Proxy is restricted to localhost' }));
            return;
          }

          const origin = (req.headers['origin'] || '').toString();
          const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

          // Parse target URL from query
          const u = new URL(req.url ?? '', 'http://localhost');
          const target = u.searchParams.get('url');
          if (!target) {
            res.statusCode = 400;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing url query parameter' }));
            return;
          }
          let targetUrl: URL;
          try {
            targetUrl = new URL(target);
          } catch {
            res.statusCode = 400;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid url' }));
            return;
          }
          if (!/^https?:$/.test(targetUrl.protocol)) {
            res.statusCode = 400;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: 'Only http/https are allowed' }));
            return;
          }

          // Handle CORS preflight early if the proxy endpoint is called cross-origin during dev
          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            if (isLocalOrigin) res.setHeader('access-control-allow-origin', origin);
            res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS');
            res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] || '*');
            res.end();
            return;
          }

          // Collect request body (for POST/PUT/PATCH)
          const getBody = async (): Promise<Buffer> => new Promise((resolve) => {
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
            req.on('end', () => resolve(Buffer.concat(chunks)));
            req.on('error', () => resolve(Buffer.alloc(0)));
          });

          const method = req.method || 'GET';
          const rawBody = method === 'GET' || method === 'HEAD' ? undefined : await getBody();

          // Forward headers, dropping hop-by-hop and origin-specific ones
          const fwdHeaders = new Headers();
          const drop = new Set(['host', 'connection', 'content-length', 'accept-encoding', 'referer', 'origin']);
          for (const [k, v] of Object.entries(req.headers)) {
            if (!v) continue;
            const key = k.toLowerCase();
            if (drop.has(key)) continue;
            // Handle multi-value headers
            if (Array.isArray(v)) {
              for (const vv of v) fwdHeaders.append(key, vv);
            } else {
              fwdHeaders.set(key, String(v));
            }
          }
          if (rawBody && !fwdHeaders.has('content-type') && req.headers['content-type']) {
            fwdHeaders.set('content-type', String(req.headers['content-type']));
          }

          const resp = await fetch(targetUrl, {
            method,
            headers: fwdHeaders,
            // body: rawBody,
            redirect: 'manual',
          });

          // Relay status and headers
          res.statusCode = resp.status;
          resp.headers.forEach((value, key) => {
            // Skip security headers that may conflict in dev context
            if (/^content-security-policy/i.test(key)) return;
            res.setHeader(key, value);
          });
          // Allow browser clients to read headers; restrict to localhost origins
          if (isLocalOrigin) res.setHeader('access-control-allow-origin', origin);
          res.setHeader('access-control-expose-headers', '*');

          // Stream body if possible
          const body = resp.body;
          if (body) {
            const { Readable } = await import('node:stream');
            Readable.fromWeb(body as any).pipe(res);
          } else {
            const buf = Buffer.from(await resp.arrayBuffer());
            res.end(buf);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'Proxy error', message }));
          next?.(err as Error);
        }
      };

      // Mount at both fixed and base-prefixed paths for convenience
      const paths = ['/hierarchidb/proxy', `${base.replace(/\/$/, '')}/proxy`];
      for (const p of Array.from(new Set(paths))) {
        server.middlewares.use(p, handler);
      }
    },
  };

  return {
    base,
    clearScreen: false,
    define: (() => {
      // Inject version and build time for logging
      return {
        __APP_VERSION__: JSON.stringify(appVersion),
        __BUILD_TIME__: JSON.stringify(buildTime),
        // Expose selected non-VITE_ envs for client/runtime packages that check them
        'import.meta.env.HDB_LOCAL_PROXY': JSON.stringify(env.HDB_LOCAL_PROXY || process.env.HDB_LOCAL_PROXY || ''),
      } as Record<string, string>;
    })(),
    plugins: [buildBeaconPlugin, hdbDevProxyPlugin, ...plugins],
    resolve: {
      // Avoid multiple React copies by always resolving to the app's React
      dedupe: [
        'react',
        'react-dom',
        'jotai',
        '@emotion/react',
        '@emotion/styled',
        'provider',
        'provider-dom',
        // Ensure a single instance for plugin dialog runtime across app and plugin-loader
        '@hierarchidb/runtime-ui-plugin-dialog',
      ],
      alias: [
        { find: '~', replacement: path.resolve(__dirname, './src') },
        // Force ESM/modern entrypoints for MUI to avoid SSR CJS 'require is not defined'
        // These aliases are safe across v5/v7 as they point to ESM builds.
        // Do not alias MUI packages to ESM entry files.
        // Aliasing to index.ts breaks subpath imports like '@mui/system/Grid'
        // which would resolve to '.../esm/index.ts/Grid' and fail.
        // Active dev packages: resolve to src for instant HMR
        //...devAliases,
        ...runtimeAliasConfig.aliases,
        // Icons utility (always point to src for now)
        {
          find: '@hierarchidb/ui-shell/ui-icon',
          replacement: path.resolve(
            __dirname,
            isDev ? '../packages/ui/icon/src/index.ts' : '../packages/ui/icon/dist/index.js',
          ),
        },
        {
          find: '@hierarchidb/runtime-worker',
          replacement: path.resolve(
            __dirname,
            isDev ? '../packages/runtime/worker/src/index.ts' : '../packages/runtime/worker/dist/index.js',
          ),
        },
        {
          find: '@hierarchidb/util',
          replacement: path.resolve(
            __dirname,
            isDev ? '../packages/util/src/index.ts' : '../packages/util/dist/index.js',
          ),
        },
        // Unify plugin-dialog runtime to a single module instance to avoid split singletons
        { find: '@hierarchidb/runtime-ui-plugin-dialog', replacement: path.resolve(__dirname, '../packages/plugin-ui-sdk/dist/index.js') },
        // Base plugin is an internal helper library; if it accidentally appears in a virtual import,
        // make it resolvable to its built output to avoid dev server crashes.
        { find: '@hierarchidb/base-plugin', replacement: path.resolve(__dirname, '../packages/plugin-loader/base-plugin/dist/index.ts') },
        // Virtual modules are provided by @hierarchidb/vite-plugin-hierarchidb-plugin-alias.
        { find: 'crypto', replacement: path.resolve(__dirname, './src/virtual/crypto-shim.ts') },
        // Some transitive libs (e.g., loaders.gl worker-utils) reference Node's child_process.
        // Stub it for browser builds to avoid __vite-browser-external resolution errors.
        { find: 'child_process', replacement: path.resolve(__dirname, './src/virtual/child-process-shim.ts') },
        // Legacy provider alias used by some plugin-loader
        { find: 'provider-i18next', replacement: 'react-i18next' },
        // Temporary workspace alias: ensure Vite resolves @hierarchidb/batch used by plugin-loader
        // Rationale: location-plugin bundles it as external; alias points to built dist
        // Temporary aliases removed after dynamic imports hardened
        // Note: do not alias workspace packages; rely on declared deps and workspace linking
      ],
    },
    server: {
      port: 4200,
      open: true,
      host: true,
      fs: {
        // Allow serving files from the monorepo root
        allow: [path.resolve(__dirname, '..')],
      },
      // Dev proxy for BFF endpoints
      proxy: {
        '/auth': {
          target: env.VITE_BFF_BASE_URL || 'http://localhost:8787',
          changeOrigin: true,
          secure: true,
        },
      },
    },
    worker: {
      format: 'es',
      plugins: () => [
        comlink(),
      ],
      rollupOptions: {
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
    build: {
      outDir: 'dist',
      //  production
      sourcemap: mode === 'development',
      // MapLibre GL + deck.gl バンドル（~953 kB）に合わせて閾値を調整。
      chunkSizeWarningLimit: 954,
      rollupOptions: {
        external: [
          // Peer deps referenced by workspace libs (ui-dialog) that should resolve from app
          'react-resizable',
          'react-draggable',
        ],
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name][extname]',
          ...(isSsrBuild
            ? {}
            : {
              manualChunks: {
                'vendor-react': ['react', 'react-dom'],
              },
            }),
        },
        plugins: rollupTracePlugin ? [rollupTracePlugin] : undefined,
        onwarn(warning, warn) {
          if (
            warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
            typeof warning.message === 'string' &&
            warning.message.includes('"use client"')
          ) {
            return;
          }
          warn(warning);
        },
      },
    },
    // Prevent Vite SSR build from externalizing workspace packages,
    // which would otherwise cause runtime failures when loaded in the browser.
    ssr: {
      external: ssrExternalDeps,
      // Keep workspace and Emotion packages bundled; maplibre/MUI are externalized above.
      noExternal: [/^@hierarchidb\//, /^@emotion\//],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'dexie',
        'react-resizable',
        'react-draggable',
        '@mui/material',
        '@mui/icons-material',
        '@emotion/react',
        '@emotion/styled',
      ],
      // Exclude specific packages from pre-bundle so Vite watches sources directly
      exclude: runtimeAliasConfig.optimizeDepsExclude,
      esbuildOptions: {
        target: 'es2020',
      },
    },
  };
});
