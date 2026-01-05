import * as fs from 'node:fs';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { comlink } from 'vite-plugin-comlink';
import { faviconPlugin } from './vite-plugins/vite-plugin-favicon.js';
import { createIso3166Plugin } from '@hierarchidb/gen-iso3166-2/plugin';
import { createNodeTypeAliasPlugin } from './vite-plugins/vite-plugin-hierarchidb-plugin-alias/src/index.js';
import { pluginWorkerVirtualModule } from './vite-plugins/vite-plugin-plugin-worker-virtual.js';
import {
  generatePluginRegistry,
  type PluginSpecifierMode,
} from '../packages/tools/build-scripts/src/gen-plugin-registry.js';
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

const appRoot = __dirname;
const srcRoot = path.join(appRoot, 'src');
const repoRoot = path.resolve(appRoot, '..');
const buildExternalIds = new Set<string>(['@maplibre/vt-pbf']);
const resolveDedupe = [
  'react',
  'react-dom',
  'jotai',
  '@emotion/react',
  '@emotion/styled',
  'provider',
  'provider-dom',
  '@hierarchidb/runtime-worker-ui-plugin-dialog',
];

const facadePrefixMap = [
  { prefix: '@hierarchidb/', targetPrefix: '@hierarchidb/' },
  { prefix: '@hierarchidb/ui-plugin-shell/', targetPrefix: '@hierarchidb/' },
] as const;

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
  const optimizeExclude = new Set<string>(['@hierarchidb/ui-worker-client', '@hierarchidb/ui-worker-provider']);

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
    { spec: '@hierarchidb/_obsolate_common-api', src: '../packages/_obsolate_common/api/src/index.ts', dist: '../packages/_obsolate_common/api/dist/index.js' },
    { spec: '@hierarchidb/_obsolate_common-auth', src: '../packages/_obsolate_common/auth/src/index.ts', dist: '../packages/_obsolate_common/auth/dist/index.js' },
    { spec: '@hierarchidb/_obsolate_common-types', src: '../packages/_obsolate_common/types/src/index.ts', dist: '../packages/_obsolate_common/types/dist/index.js' },
    { spec: '@hierarchidb/download', src: '../packages/features/download/src/index.ts', dist: '../packages/features/download/dist/index.js' },
    { spec: '@hierarchidb/chunk-store', src: '../packages/features/chunk-store/src/index.ts', dist: '../packages/features/chunk-store/dist/index.js' },
    { spec: '@hierarchidb/auth-recovery', src: '../packages/features/auth-recovery/src/index.ts', dist: '../packages/features/auth-recovery/dist/index.js' },
    { spec: '@hierarchidb/util', src: '../packages/util/src/index.ts', dist: '../packages/util/dist/index.js' },
    { spec: '@hierarchidb/ui-worker-client', src: '../packages/ui/worker-client/src/index.ts', dist: '../packages/ui/worker-client/dist/index.js' },
    { spec: '@hierarchidb/ui-worker-provider', src: '../packages/ui/worker-provider/src/index.ts', dist: '../packages/ui/worker-provider/dist/index.js' },
    { spec: '@hierarchidb/runtime-worker-worker', src: '../packages/runtime-worker/worker/src/index.ts', dist: '../packages/runtime-worker/worker/src/index.ts' },
    { spec: '@hierarchidb/map-adapter', src: '../packages/features/map-adapter/src/index.ts', dist: '../packages/features/map-adapter/dist/index.js' },
    { spec: '@hierarchidb/plugin-presentation', src: '../packages/plugin-presentation/src/index.ts', dist: '../packages/plugin-presentation/dist/index.js' },
    { spec: '@hierarchidb/plugin-registry', src: '../packages/plugin-registry/generated/registry.ts', dist: '../packages/plugin-registry/dist/registry.js' },
    { spec: '@hierarchidb/plugin-registry/derivations', src: '../packages/plugin-registry/src/derivations.ts', dist: '../packages/plugin-registry/dist/derivations.js' },
    { spec: '@hierarchidb/plugin-registry/types', src: '../packages/plugin-registry/src/batch-types.ts', dist: '../packages/plugin-registry/dist/types.d.ts' },
    { spec: '@hierarchidb/plugin-registry/ui-loaders', src: '../packages/plugin-registry/generated/ui-loaders.ts', dist: '../packages/plugin-registry/dist/ui-loaders.js' },
    { spec: '@hierarchidb/plugin-registry/worker-loaders', src: '../packages/plugin-registry/generated/worker-loaders.ts', dist: '../packages/plugin-registry/dist/worker-loaders.js' },
    { spec: '@hierarchidb/plugin-registry/icon-loaders', src: '../packages/plugin-registry/generated/icon-loaders.ts', dist: '../packages/plugin-registry/dist/icon-loaders.js' },
    { spec: '@hierarchidb/plugin-registry/database-loaders', src: '../packages/plugin-registry/generated/database-loaders.ts', dist: '../packages/plugin-registry/dist/database-loaders.js' },
    { spec: '@hierarchidb/plugin-registry/plugin-definitions', src: '../packages/plugin-registry/generated/plugin-definitions.ts', dist: '../packages/plugin-registry/dist/plugin-definitions.js' },
    { spec: '@hierarchidb/plugin-ui-sdk', src: '../packages/plugin-ui-sdk/src/index.ts', dist: '../packages/plugin-ui-sdk/dist/index.js' },
    { spec: '@hierarchidb/basemap-plugin', src: '../plugins/basemap-plugin/src/index.ts', dist: '../plugins/basemap-plugin/dist/index.js' },
    { spec: '@hierarchidb/basemap-plugin/worker', src: '../plugins/basemap-plugin/src/worker/index.ts', dist: '../plugins/basemap-plugin/dist/worker/index.js' },
    { spec: '@hierarchidb/basemap-plugin/ui', src: '../plugins/basemap-plugin/src/ui/index.ts', dist: '../plugins/basemap-plugin/dist/ui/index.js' },
    { spec: '@hierarchidb/basemap-plugin/icon', src: '../plugins/basemap-plugin/src/icon/index.ts', dist: '../plugins/basemap-plugin/dist/icon/index.js' },
    { spec: '@hierarchidb/basemap-plugin/database', src: '../plugins/basemap-plugin/src/services/database/index.ts', dist: '../plugins/basemap-plugin/dist/services/database/index.js' },
    { spec: '@hierarchidb/folder-plugin', src: '../plugins/folder-plugin/src/index.ts', dist: '../plugins/folder-plugin/dist/index.js' },
    { spec: '@hierarchidb/location-plugin', src: '../plugins/location-plugin/src/index.ts', dist: '../plugins/location-plugin/dist/index.js' },
    { spec: '@hierarchidb/linker-plugin', src: '../plugins/linker-plugin/src/index.ts', dist: '../plugins/linker-plugin/dist/index.js' },
    { spec: '@hierarchidb/resolver-plugin', src: '../plugins/resolver-plugin/src/index.ts', dist: '../plugins/resolver-plugin/dist/index.js' },
    { spec: '@hierarchidb/resolver-plugin/database', src: '../plugins/resolver-plugin/src/worker/database/index.ts', dist: '../plugins/resolver-plugin/dist/worker/database/index.js' },
    { spec: '@hierarchidb/route-plugin', src: '../plugins/route-plugin/src/index.ts', dist: '../plugins/route-plugin/dist/index.js' },
    { spec: '@hierarchidb/route-plugin/database', src: '../plugins/route-plugin/src/services/database/index.ts', dist: '../plugins/route-plugin/dist/services/database/index.js' },
    { spec: '@hierarchidb/shape-plugin', src: '../plugins/shape-plugin/src/index.ts', dist: '../plugins/shape-plugin/dist/index.js' },
    { spec: '@hierarchidb/spreadsheet-plugin', src: '../plugins/spreadsheet-plugin/src/index.ts', dist: '../plugins/spreadsheet-plugin/dist/index.js' },
    { spec: '@hierarchidb/styler-plugin', src: '../plugins/styler-plugin/src/index.ts', dist: '../plugins/styler-plugin/dist/index.js' },
    { spec: '@hierarchidb/location-plugin', src: '../plugins/location-plugin/src/index.ts', dist: '../plugins/location-plugin/dist/index.js' },
    { spec: '@hierarchidb/location-plugin/database', src: '../plugins/location-plugin/src/database/index.ts', dist: '../plugins/location-plugin/dist/database/index.js' },
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
    registerDevPackage('@hierarchidb/runtime-worker-worker', '../packages/runtime-worker/worker/src/index.ts', {
      group: 'runtime-worker',
      exclude: true,
    });
    addAlias('@hierarchidb/runtime-worker-worker/stage-worker', '../packages/runtime-worker/worker/src/stageWorker.entry.ts', {
      exclude: true,
      exact: true,
    });
    addAlias('@hierarchidb/shape-plugin/shape-stage-worker', '../plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.entry.ts', {
      exclude: true,
    });
    registerDevPackage('@hierarchidb/ui-worker-client', '../packages/ui/worker-client/src/index.ts', {
      group: 'runtime-worker',
      exclude: true,
    });
    registerDevPackage('@hierarchidb/ui-worker-provider', '../packages/ui/worker-provider/src/index.ts', {
      group: 'runtime-worker',
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
    registerDevPackage('@hierarchidb/ui-plugin-shell/ui-i18n', '../packages/ui/i18n/src/index.ts', {
      group: 'ui',
      exclude: true,
    });
    registerDevPackage('@hierarchidb/ui-plugin-shell/ui-icon', '../packages/ui/icon/src/index.ts', {
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
          addAlias(`${specBase}/worker`, workerRel, { exclude: true, exact: true });
        }

        const workerFactoryRel = resolvePluginCandidate(workerFactoryCandidates, pluginName);
        if (workerFactoryRel) {
          addAlias(`${specBase}/worker/factory`, workerFactoryRel, { exclude: true, exact: true });
        }

        const workerDbRel = resolvePluginCandidate(workerDatabaseCandidates, pluginName);
        if (workerDbRel) {
          addAlias(`${specBase}/database`, workerDbRel, { exclude: true, exact: true });
        }

        const uiRel = resolvePluginCandidate(uiCandidates, pluginName);
        if (uiRel) {
          addAlias(`${specBase}/ui`, uiRel, { exclude: true, exact: true });
        }

        const iconRel = resolvePluginCandidate(iconCandidates, pluginName);
        if (iconRel) {
          addAlias(`${specBase}/icon`, iconRel, { exclude: true, exact: true });
        }
      }
    }
  } else {
    // Prefer src aliases in production to keep plugin resolution consistent.
    // runtime-worker uses dist to avoid facade re-export cycles during preview.
    addAlias('@hierarchidb/runtime-worker', '../packages/runtime-worker/dist/index.js', { exclude: true, exact: true });
    addAlias('@hierarchidb/runtime-worker/stage-worker', '../packages/runtime-worker/dist/stageWorker.entry.js', {
      exclude: true,
      exact: true,
    });
    addAlias('@hierarchidb/runtime-worker-worker', '../packages/runtime-worker/worker/src/index.ts', { exact: true });
    addAlias('@hierarchidb/runtime-worker-worker/stage-worker', '../packages/runtime-worker/worker/src/stageWorker.entry.ts', {
      exclude: true,
      exact: true,
    });
    addAlias('@hierarchidb/shape-plugin/shape-stage-worker', '../plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.entry.ts', {
      exclude: true,
    });
    addAlias('@hierarchidb/ui-worker-client', '../packages/ui/worker-client/src/index.ts', { exact: true });
    addAlias('@hierarchidb/ui-worker-provider', '../packages/ui/worker-provider/src/index.ts', { exact: true });
    addAlias('@hierarchidb/map-adapter', '../packages/features/map-adapter/src/index.ts', { exclude: true, exact: true });
    addAlias('@hierarchidb/tabular-source-xlsx', '../packages/features/tabular-source-xlsx/src/index.ts', { exclude: true, exact: true });
    addAlias('@hierarchidb/ui-plugin-shell/ui-i18n', '../packages/ui/i18n/src/index.ts', { exclude: true, exact: true });

    for (const mapping of [...legacyUiMappings, ...legacyFeatureMappings]) {
      addAlias(mapping.spec, mapping.src, { exclude: true, exact: true });
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
        const rootSrcRel = resolvePluginCandidate(rootCandidates, pluginName);
        if (rootSrcRel) {
          addAlias(specBase, rootSrcRel, { exclude: true, exact: true });
        }

        const workerSrcRel = resolvePluginCandidate(workerEntryCandidates, pluginName);
        if (workerSrcRel) {
          addAlias(`${specBase}/worker`, workerSrcRel, { exclude: true, exact: true });
        }

        const uiSrcRel = resolvePluginCandidate(uiCandidates, pluginName);
        if (uiSrcRel) {
          addAlias(`${specBase}/ui`, uiSrcRel, { exclude: true, exact: true });
        }

        const iconSrcRel = resolvePluginCandidate(iconCandidates, pluginName);
        if (iconSrcRel) {
          addAlias(`${specBase}/icon`, iconSrcRel, { exclude: true, exact: true });
        }

        const databaseSrcRel = resolvePluginCandidate(databaseCandidates, pluginName);
        if (databaseSrcRel) {
          addAlias(`${specBase}/database`, databaseSrcRel, { exclude: true, exact: true });
        }
      }
    }
  }

  const aliases = Array.from(aliasMap.values());
  return {
    aliases,
    optimizeDepsExclude: Array.from(optimizeExclude),
  };
}

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
  const resolvedRoot = rootDir ? path.resolve(rootDir) : path.resolve(appRoot, '..');
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, appRoot, '');
  const appName = (env.VITE_APP_NAME || '').replace(/^\/+|\/+$/g, '');
  const isDev = mode === 'development';
  const base = isDev ? '/' : appName ? `/${appName}/` : '/';
  const enableWorkspaceAliases = mode === 'development' || mode === 'test';
  const requestedPluginSpecMode = (env.HDB_PLUGIN_SPEC_MODE || process.env.HDB_PLUGIN_SPEC_MODE || '').toLowerCase();
  if (requestedPluginSpecMode && requestedPluginSpecMode !== 'package') {
    throw new Error(`[plugin-registry] HDB_PLUGIN_SPEC_MODE must be "package" for this build (got "${requestedPluginSpecMode}").`);
  }
  const bisectFlags = new Set(
    (env.HDB_MIN_BISECT || process.env.HDB_MIN_BISECT || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const bisectExternalBare = bisectFlags.has('B');
  const pluginRegistryMode: PluginSpecifierMode = 'package';
  const enableTsconfigPaths =
    isDev ||
    mode === 'test' ||
    env.VITE_TSCONFIG_PATHS === 'true' ||
    process.env.HDB_TSCONFIG_PATHS === '1';
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
    rootDir: appRoot,
    isDev: enableWorkspaceAliases,
    selection: devAliasSelection,
    workspacePackages,
  });
  const resolveExternal = (id: string): boolean => {
    if (buildExternalIds.has(id)) return true;
    if (bisectExternalBare) return false;
    return id.startsWith('@hierarchidb/');
  };
  const buildTime = new Date().toISOString();
  let appVersion = '0.0.0-dev';
  try {
    const pkgPath = path.resolve(appRoot, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    if (pkg?.version) appVersion = pkg.version;
  } catch {
    // no-op: fallback to default version when package.json is not accessible
  }

  return {
    root: appRoot,
    appType: 'spa',
    base,
    clearScreen: false,
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __BUILD_TIME__: JSON.stringify(buildTime),
      'import.meta.env.HDB_LOCAL_PROXY': JSON.stringify(env.HDB_LOCAL_PROXY || process.env.HDB_LOCAL_PROXY || ''),
    },
    resolve: {
      dedupe: resolveDedupe,
      alias: [
        { find: '~', replacement: srcRoot },
        ...runtimeAliasConfig.aliases,
        {
          find: '@hierarchidb/ui-plugin-shell/ui-icon',
          replacement: path.resolve(
            appRoot,
            isDev ? '../packages/ui/icon/src/index.ts' : '../packages/ui/icon/dist/index.js',
          ),
        },
        {
          find: '@hierarchidb/runtime-worker-worker',
          replacement: path.resolve(
            appRoot,
            isDev ? '../packages/runtime-worker/worker/src/index.ts' : '../packages/runtime-worker/worker/dist/index.js',
          ),
        },
        {
          find: '@hierarchidb/util',
          replacement: path.resolve(
            appRoot,
            isDev ? '../packages/util/src/index.ts' : '../packages/util/dist/index.js',
          ),
        },
        { find: '@hierarchidb/runtime-worker-ui-plugin-dialog', replacement: path.resolve(appRoot, '../packages/plugin-ui-sdk/dist/index.js') },
        { find: '@hierarchidb/base-plugin', replacement: path.resolve(appRoot, '../packages/plugin-loader/base-plugin/dist/index.ts') },
        { find: 'provider-i18next', replacement: 'react-i18next' },
      ],
    },
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development' || env.HDB_PREVIEW_SOURCEMAP === '1',
      manifest: true,
      chunkSizeWarningLimit: 954,
      rollupOptions: {
        input: path.resolve(appRoot, 'index.html'),
        external: resolveExternal,
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name][extname]',
          manualChunks(id: string) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
              return 'vendor-react';
            }
            return undefined;
          },
        },
      },
    },
    worker: {
      format: 'es',
      plugins: () => [
        comlink(),
      ],
      rollupOptions: {
        external: resolveExternal,
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
    plugins: [
      pluginRegistryGeneratorPlugin({
        rootDir: repoRoot,
        mode: pluginRegistryMode,
      }),
      facadeAliasPlugin(),
      createIso3166Plugin({
        outputDir: 'public',
        outputFile: 'iso3166-2-level1.csv',
        failureFile: 'iso3166-2-level1.failures.csv',
      }),
      createNodeTypeAliasPlugin({
        rootDir: repoRoot,
        shouldAlias: () => false,
      }),
      pluginWorkerVirtualModule(),
      faviconPlugin(),
      comlink(),
      ...(enableTsconfigPaths
        ? [
            tsconfigPaths({
              projects: [path.join(appRoot, 'tsconfig.json')],
            }),
          ]
        : []),
    ],
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
      exclude: runtimeAliasConfig.optimizeDepsExclude,
      rolldownOptions: {},
    },
  };
});
