import { defineConfig, loadEnv } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import tsconfigPaths from 'vite-tsconfig-paths';
import dts from 'vite-plugin-dts';
import * as fs from 'node:fs';
import * as path from 'path';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { faviconPlugin } from './vite-plugins/vite-plugin-favicon.js';
import { comlink } from 'vite-plugin-comlink';
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
import { createIso3166Plugin } from '@hierarchidb/gen-iso3166-2/plugin';
import type { DevAliasSelection, WorkspacePackageMeta } from '../config/dev-alias-config.js';
import { generatePluginRegistry } from '../packages/tools/build-scripts/src/gen-plugin-registry.ts';
import type { PluginSpecifierMode } from '../packages/tools/build-scripts/src/plugin-registry/types.ts';

if (!process.listenerCount('uncaughtException')) {
  process.on('uncaughtException', (error) => {
    console.error('[vite.config] uncaught exception', error?.message);
    const errObj = error as Partial<{ url?: unknown; code?: unknown; stack?: unknown }>;
    if (errObj && typeof errObj.url === 'string') {
      console.error('[vite.config] error url:', errObj.url);
    }
    if (errObj && typeof errObj.code === 'string') {
      console.error('[vite.config] error code:', errObj.code);
    }
    if (errObj && typeof errObj.stack === 'string') {
      console.error('[vite.config] stack:', errObj.stack);
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
  const optimizeExclude = new Set<string>(['@hierarchidb/ui-worker-client', '@hierarchidb/ui-worker-provider']);

  const legacyUiMappings = [
    { spec: '@hierarchidb/components', src: '../packages/components/src/index.ts', dist: '../packages/components/dist/index.js' },
    { spec: '@hierarchidb/plugin-ui-host', src: '../packages/plugin-ui-host/src/index.ts', dist: '../packages/plugin-ui-host/dist/index.js' },
    { spec: '@hierarchidb/ui-auth', src: '../packages/ui/auth/src/index.ts', dist: '../packages/ui/auth/dist/index.js' },
    { spec: '@hierarchidb/ui-dialog', src: '../packages/ui/dialog/src/index.ts', dist: '../packages/ui/dialog/dist/index.js' },
    { spec: '@hierarchidb/ui-icon', src: '../packages/components/src/index.ts', dist: '../packages/components/dist/index.js' },
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
    { spec: '@hierarchidb/ui-file', src: '../packages/ui/file/src/index.ts', dist: '../packages/ui/file/dist/index.js' },
    { spec: '@hierarchidb/ui-usermenu', src: '../packages/ui/usermenu/src/index.ts', dist: '../packages/ui/usermenu/dist/index.js' },
    { spec: '@hierarchidb/ui-plugin-basic-info', src: '../packages/ui/plugin-basic-info/src/index.ts', dist: '../packages/ui/plugin-basic-info/dist/index.js' },
  ] as const;

  const legacyFeatureMappings = [
    { spec: '@hierarchidb/_obsolate_common-api', src: '../packages/_obsolate_common/api/src/index.ts', dist: '../packages/_obsolate_common/api/dist/index.js' },
    { spec: '@hierarchidb/_obsolate_common-auth', src: '../packages/_obsolate_common/auth/src/index.ts', dist: '../packages/_obsolate_common/auth/dist/index.js' },
    { spec: '@hierarchidb/_obsolate_common-types', src: '../packages/_obsolate_common/types/src/index.ts', dist: '../packages/_obsolate_common/types/dist/index.js' },
    { spec: '@hierarchidb/auth', src: '../packages/auth/src/index.ts', dist: '../packages/auth/dist/index.js' },
    { spec: '@hierarchidb/download', src: '../packages/download/src/index.ts', dist: '../packages/download/dist/index.js' },
    { spec: '@hierarchidb/chunk-store', src: '../packages/chunk-store/src/index.ts', dist: '../packages/chunk-store/dist/index.js' },
    { spec: '@hierarchidb/util', src: '../packages/util/src/index.ts', dist: '../packages/util/dist/index.js' },
    { spec: '@hierarchidb/vt-orchestrator', src: '../packages/vt-orchestrator/src/index.ts', dist: '../packages/vt-orchestrator/dist/index.js' },
    { spec: '@hierarchidb/ui-worker-client', src: '../packages/ui/worker-client/src/index.ts', dist: '../packages/ui/worker-client/dist/index.js' },
    { spec: '@hierarchidb/ui-worker-provider', src: '../packages/ui/worker-provider/src/index.ts', dist: '../packages/ui/worker-provider/dist/index.js' },
    { spec: '@hierarchidb/runtime-worker-worker', src: '../packages/runtime-worker/worker/src/index.ts', dist: '../packages/runtime-worker/worker/src/index.ts' },
    { spec: '@hierarchidb/map-adapter', src: '../packages/map-adapter/src/index.ts', dist: '../packages/map-adapter/dist/index.js' },
    { spec: '@hierarchidb/gis-sdk', src: '../packages/gis-sdk/src/index.ts', dist: '../packages/gis-sdk/dist/index.js' },
    { spec: '@hierarchidb/plugin-presentation', src: '../packages/plugin-presentation/src/index.ts', dist: '../packages/plugin-presentation/dist/index.js' },
    { spec: '@hierarchidb/plugin-registry', src: '../packages/plugin-registry/generated/registry.ts', dist: '../packages/plugin-registry/dist/registry.js' },
    { spec: '@hierarchidb/plugin-registry/derivations', src: '../packages/plugin-registry/src/derivations.ts', dist: '../packages/plugin-registry/dist/derivations.js' },
    { spec: '@hierarchidb/plugin-registry/types', src: '../packages/plugin-registry/src/build-types.ts', dist: '../packages/plugin-registry/dist/types.d.ts' },
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
    { spec: '@hierarchidb/location-plugin/common', src: '../plugins/location-plugin/src/common/index.ts', dist: '../plugins/location-plugin/dist/common/index.js' },
    { spec: '@hierarchidb/linker-plugin', src: '../plugins/linker-plugin/src/index.ts', dist: '../plugins/linker-plugin/dist/index.js' },
    { spec: '@hierarchidb/resolver-plugin', src: '../plugins/resolver-plugin/src/index.ts', dist: '../plugins/resolver-plugin/dist/index.js' },
    { spec: '@hierarchidb/route-plugin/common', src: '../plugins/route-plugin/src/common/index.ts', dist: '../plugins/route-plugin/dist/common/index.js' },
    { spec: '@hierarchidb/route-plugin/common/entities/RouteLineString.ts', src: '../plugins/route-plugin/src/common/entities/RouteLineString.ts', dist: '../plugins/route-plugin/dist/common/entities/RouteLineString.js' },
    { spec: '@hierarchidb/route-plugin/services/RouteGenerator.js', src: '../plugins/route-plugin/src/services/RouteGenerator.ts', dist: '../plugins/route-plugin/dist/services/RouteGenerator.js' },
    { spec: '@hierarchidb/route-plugin/services/engines/SearouteEngine.js', src: '../plugins/route-plugin/src/services/engines/SearouteEngine.ts', dist: '../plugins/route-plugin/dist/services/engines/SearouteEngine.js' },
    { spec: '@hierarchidb/shape-plugin/common', src: '../plugins/shape-plugin/src/common/index.ts', dist: '../plugins/shape-plugin/dist/common/index.js' },
    { spec: '@hierarchidb/spreadsheet-plugin', src: '../plugins/spreadsheet-plugin/src/index.ts', dist: '../plugins/spreadsheet-plugin/dist/index.js' },
    { spec: '@hierarchidb/styler-plugin', src: '../plugins/styler-plugin/src/index.ts', dist: '../plugins/styler-plugin/dist/index.js' },
    { spec: '@hierarchidb/tabular-source-xlsx', src: '../packages/tabular-source-xlsx/src/index.ts', dist: '../packages/tabular-source-xlsx/dist/index.js' },
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
    addAlias('@hierarchidb/runtime-worker/yaml-storage-activation', '../packages/runtime-worker/src/yaml-storage-activation/index.ts', {
      exclude: true,
      exact: true,
    });
    addAlias('@hierarchidb/runtime-worker/yaml-storage-production', '../packages/runtime-worker/src/yaml-storage-production/index.ts', {
      exclude: true,
      exact: true,
    });
    registerDevPackage('@hierarchidb/runtime-worker-worker', '../packages/runtime-worker/worker/src/index.ts', {
      group: 'runtime-worker',
      exclude: true,
    });
    addAlias('@hierarchidb/runtime-worker-worker/stage-worker', '../packages/runtime-worker/worker/src/stageWorker.entry.ts', {
      exclude: true,
      exact: true,
    });
    addAlias('@hierarchidb/shape-plugin/shape-stage-worker', '../plugins/shape-plugin/src/services/build/workers/shapeStageWorker.entry.ts', {
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
    registerDevPackage('@hierarchidb/map-adapter', '../packages/map-adapter/src/index.ts', {
      group: 'features',
      exclude: true,
    });
    registerDevPackage('@hierarchidb/tabular-source-xlsx', '../packages/tabular-source-xlsx/src/index.ts', {
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
    // Productionも原則srcを参照する（ビルド済みdistへのエイリアスは依存解決順や存在に依存し脆弱）
    // runtime-worker は preview/worker stage で循環的な facade re-export を避けるため dist を優先する。
    addAlias('@hierarchidb/runtime-worker', '../packages/runtime-worker/dist/index.js', { exclude: true, exact: true });
    addAlias('@hierarchidb/runtime-worker/yaml-storage-activation', '../packages/runtime-worker/dist/yaml-storage-activation/index.js', { exclude: true, exact: true });
    addAlias('@hierarchidb/runtime-worker/yaml-storage-production', '../packages/runtime-worker/dist/yaml-storage-production/index.js', { exclude: true, exact: true });
    addAlias('@hierarchidb/runtime-worker/stage-worker', '../packages/runtime-worker/dist/stageWorker.entry.js', {
      exclude: true,
      exact: true,
    });
    addAlias('@hierarchidb/runtime-worker-worker', '../packages/runtime-worker/worker/src/index.ts', { exact: true });
    addAlias('@hierarchidb/runtime-worker-worker/stage-worker', '../packages/runtime-worker/worker/src/stageWorker.entry.ts', {
      exclude: true,
      exact: true,
    });
    addAlias('@hierarchidb/shape-plugin/shape-stage-worker', '../plugins/shape-plugin/src/services/build/workers/shapeStageWorker.entry.ts', {
      exclude: true,
      exact: true,
    });
    addAlias('@hierarchidb/ui-worker-client', '../packages/ui/worker-client/src/index.ts', { exact: true });
    addAlias('@hierarchidb/ui-worker-provider', '../packages/ui/worker-provider/src/index.ts', { exact: true });
    addAlias('@hierarchidb/map-adapter', '../packages/map-adapter/src/index.ts', { exclude: true, exact: true });
    addAlias('@hierarchidb/tabular-source-xlsx', '../packages/tabular-source-xlsx/src/index.ts', { exclude: true, exact: true });
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
  { prefix: '@hierarchidb/ui-plugin-shell/', targetPrefix: '@hierarchidb/' },
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

function pluginTildeRootAliasPlugin(): Plugin {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.json'];

  return {
    name: 'hierarchidb:plugin-tilde-root-alias',
    enforce: 'pre',
    resolveId(source, importer) {
      if (typeof source !== 'string' || !source.startsWith('~/')) return null;
      if (typeof importer !== 'string' || importer.length === 0) return null;
      const importerUrl: string = importer;
      const questionIndex = importerUrl.indexOf('?');
      const normalizedImporter = (
        questionIndex >= 0 ? importerUrl.slice(0, questionIndex) : importerUrl
      ).replace(/\\/g, '/');
      const importerWithoutFsPrefix = normalizedImporter.startsWith('/@fs/')
        ? normalizedImporter.slice(5)
        : normalizedImporter;
      const importerDir = path.posix.dirname(importerWithoutFsPrefix);
      let pluginRoot: string | null = null;
      let pluginSrcRoot: string | null = null;
      let cursor = importerDir;

      while (cursor && cursor !== path.posix.dirname(cursor)) {
        const packageJsonPath = path.join(cursor, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const raw = fs.readFileSync(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(raw);
            const packageName = typeof packageJson?.name === 'string' ? packageJson.name : '';
            const isWorkspacePackage = packageName.startsWith('@hierarchidb/');
            const hasPluginName = /plugin/i.test(packageName);
            const isAppPackage = packageName === '@hierarchidb/app';
            const isPluginPackage =
              packageJson &&
              typeof packageJson === 'object' &&
              !!((packageJson as { hierarchidb?: { plugin?: unknown } }).hierarchidb?.plugin || packageJson?.nodeType);
            if (isWorkspacePackage || isPluginPackage || isAppPackage || hasPluginName) {
              pluginRoot = cursor;
              const candidateSrcRoot = path.join(cursor, 'src');
              pluginSrcRoot = fs.existsSync(candidateSrcRoot) ? candidateSrcRoot : cursor;
              break;
            }
          } catch {
            // Ignore malformed package.json and continue searching parent directories.
          }
        }

        if (cursor.endsWith('/plugins')) {
          break;
        }

        const parent = path.posix.dirname(cursor);
        if (parent === cursor) break;
        cursor = parent;
      }

      if (!pluginRoot) {
        const packagesMatch = importerWithoutFsPrefix.match(/(.*\/packages\/[^/]+)(?:\/|$)/);
        const pluginsMatch = importerWithoutFsPrefix.match(/(.*\/plugins\/[^/]+)(?:\/|$)/);
        const match = packagesMatch || pluginsMatch;
        if (match?.[1]) {
          pluginRoot = match[1];
          const candidateSrcRoot = path.join(pluginRoot, 'src');
          pluginSrcRoot = fs.existsSync(candidateSrcRoot) ? candidateSrcRoot : pluginRoot;
        }
      }

      if (!pluginRoot) {
        const appRoot = path.resolve(__dirname);
        const withinAppPath =
          importerWithoutFsPrefix.includes(`${path.sep}app${path.sep}`)
          || importerWithoutFsPrefix.endsWith(`${path.sep}app`)
          || importerWithoutFsPrefix.includes('/app/');
        if (withinAppPath && fs.existsSync(appRoot)) {
          const appSrcRoot = path.join(appRoot, 'src');
          if (fs.existsSync(appSrcRoot)) {
            pluginRoot = appRoot;
            pluginSrcRoot = appSrcRoot;
          }
        }
      }

      if (!pluginRoot) return null;

      const withoutPrefix = source.slice(2).replace(/^\/+/, '');
      const normalizedWithoutPrefix =
        withoutPrefix === 'src'
          ? ''
          : withoutPrefix.replace(/^src\//, '');
      const searchRoots = [pluginSrcRoot, pluginRoot].filter(Boolean) as string[];
      if (!searchRoots.length) return null;

      const candidateCandidates: string[] = [];
      for (const baseRoot of searchRoots) {
        const candidatePath = path.resolve(baseRoot, normalizedWithoutPrefix);
        const explicitExt = path.extname(candidatePath);
        const explicitExtSupported = extensions.includes(explicitExt);
        const withoutExtPath =
          explicitExt && explicitExtSupported
            ? candidatePath.slice(0, -explicitExt.length)
            : candidatePath;

        if (explicitExtSupported) {
          candidateCandidates.push(candidatePath);
          for (const fallbackExt of ['.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.mts', '.cts']) {
            if (fallbackExt === explicitExt) continue;
            candidateCandidates.push(`${withoutExtPath}${fallbackExt}`);
          }
        } else {
          for (const ext of extensions) {
            candidateCandidates.push(`${candidatePath}${ext}`);
          }
        }

        candidateCandidates.push(`${withoutExtPath}/index.ts`);
        candidateCandidates.push(`${withoutExtPath}/index.tsx`);
        candidateCandidates.push(`${withoutExtPath}/index.js`);
        candidateCandidates.push(`${withoutExtPath}/index.mjs`);
        candidateCandidates.push(`${withoutExtPath}/index.cjs`);
        candidateCandidates.push(`${withoutExtPath}/index.mts`);
        candidateCandidates.push(`${withoutExtPath}/index.cts`);
        candidateCandidates.push(`${withoutExtPath}/index.json`);
      }

      for (const candidate of candidateCandidates) {
        const normalizedCandidate = candidate.replace(/\\/g, '/');
        const exists = fs.existsSync(normalizedCandidate);
        if (!exists) continue;
        if (process.env.DEBUG_PLUGIN_TILDE_ROOT_ALIAS === '1') {
          console.log(
            '[plugin-tilde-root-alias] resolved',
            source,
            '=>',
            normalizedCandidate,
            'from',
            importer,
            'candidate=',
            normalizedCandidate,
          );
        }
        return normalizedCandidate;
      }

      if (process.env.DEBUG_PLUGIN_TILDE_ROOT_ALIAS === '1') {
        console.log(
          '[plugin-tilde-root-alias] unresolved',
          source,
          'candidates=',
          candidateCandidates.join(' | '),
          'pluginRoot=',
          pluginRoot,
          'importer=',
          importer,
        );
      }

      return null;
    },
    async load(id) {
      if (process.env.DEBUG_PLUGIN_TILDE_ROOT_ALIAS === '1' && id.includes('/plugins/shape-plugin/src/common/types/metadata.ts')) {
        console.log('[plugin-tilde-root-alias] load metadata', id);
      }

      if (
        process.env.DEBUG_PLUGIN_TILDE_ROOT_ALIAS === '1'
        && id.includes('/plugins/shape-plugin/src/services/datasources/CountryAvailabilityResolver.ts')
      ) {
        console.log('[plugin-tilde-root-alias] load resolver', id);
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
        const url = req.url ? req.url.split('?', 2)[0] ?? '' : '';
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

function specialPrefixRewritePlugin(base: string): Plugin {
  const normalizedBase = base.startsWith('/') ? base : `/${base}`;
  const baseWithSlash = normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`;
  const prefixes = ['@fs/', '@id/'];

  return {
    name: 'hierarchidb:special-prefix-rewrite',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const currentUrl = req.url || req.originalUrl || '';
        if (!currentUrl) return next();
        for (const prefix of prefixes) {
          const match = `${baseWithSlash}${prefix}`;
          if (baseWithSlash !== '/' && currentUrl.startsWith(match)) {
            req.url = `/${prefix}${currentUrl.slice(match.length)}`;
            break;
          }
        }
        next();
      });
    },
  };
}

function buildIndexHtmlTracePlugin(stage: 'pre' | 'post'): Plugin {
  const label = `hierarchidb:index-html-trace:${stage}`;
  const moduleScriptPattern = /<script\b[^>]*type=["']module["'][^>]*>/i;
  const scriptTagPattern = /<script\b[^>]*>/gi;
  const toSnippet = (value: string): string => value.replace(/\s+/g, ' ').trim().slice(0, 160);
  return {
    name: label,
    apply: 'build',
    enforce: stage,
    transformIndexHtml(html, ctx) {
      const hasModuleScript = moduleScriptPattern.test(html);
      const hasEntryClient = html.includes('entry.client.tsx');
      const ctxPath = ctx?.path ?? 'unknown';
      const ctxFilename = (ctx as { filename?: string } | undefined)?.filename ?? 'unknown';
      let diskHasModuleScript: boolean | null = null;
      let diskHasEntryClient: boolean | null = null;
      const scriptTags = html.match(scriptTagPattern) ?? [];
      let diskScriptTags: string[] | null = null;
      let sameAsDisk: boolean | null = null;
      if (ctxFilename !== 'unknown') {
        try {
          const diskHtml = readFileSync(ctxFilename, 'utf8');
          diskHasModuleScript = moduleScriptPattern.test(diskHtml);
          diskHasEntryClient = diskHtml.includes('entry.client.tsx');
          diskScriptTags = diskHtml.match(scriptTagPattern) ?? [];
          sameAsDisk = diskHtml === html;
        } catch (error) {
          console.warn(`[${label}] failed to read ${ctxFilename}:`, error);
        }
      }
      console.log(
        `[${label}] path=${ctxPath} filename=${ctxFilename} length=${html.length} moduleScript=${hasModuleScript} entryClient=${hasEntryClient} diskModuleScript=${diskHasModuleScript} diskEntryClient=${diskHasEntryClient} scriptTags=${scriptTags.length} diskScriptTags=${diskScriptTags?.length ?? 'unknown'} sameAsDisk=${sameAsDisk} snippet="${toSnippet(html)}"`
      );
      return html;
    },
  };
}

function buildIndexHtmlHookTracePlugin(): Plugin {
  return {
    name: 'hierarchidb:index-html-hook-trace',
    apply: 'build',
    configResolved(config) {
      const rows = config.plugins
        .map((plugin, index) => {
          if (!plugin?.transformIndexHtml) return null;
          const hook = plugin.transformIndexHtml;
          const hookEnforce =
            typeof hook === 'object' && hook && 'enforce' in hook && hook.enforce
              ? hook.enforce
              : undefined;
          const pluginEnforce = plugin.enforce;
          const order = hookEnforce ?? pluginEnforce ?? 'normal';
          return `${index}:${plugin.name}:${order}`;
        })
        .filter(Boolean)
        .join(', ');
      console.log(`[hierarchidb:index-html-hook-trace] ${rows || 'none'}`);
    },
  };
}

function buildIndexResolveTracePlugin(): Plugin {
  return {
    name: 'hierarchidb:index-resolve-trace',
    apply: 'build',
    resolveId(id, importer) {
      const isEntryClient = id.includes('entry.client');
      const fromIndexHtml = typeof importer === 'string' && importer.endsWith('index.html');
      if (isEntryClient || fromIndexHtml) {
        console.log(`[hierarchidb:index-resolve-trace] id=${id} importer=${importer ?? 'null'}`);
      }
      return null;
    },
  };
}

function buildConfigTracePlugin(): Plugin {
  return {
    name: 'hierarchidb:stage-config-trace',
    apply: 'build',
    configResolved(config) {
      const input = config.build?.rollupOptions?.input ?? null;
      const lib = config.build?.lib ?? null;
      console.log(
        `[hierarchidb:build-config-trace] root=${config.root} outDir=${config.build?.outDir} rollupInput=${JSON.stringify(input)} lib=${JSON.stringify(lib)}`
      );
    },
  };
}

function buildIndexBundleTracePlugin(): Plugin {
  const moduleScriptPattern = /<script\b[^>]*type=["']module["'][^>]*>/i;
  const scriptTagPattern = /<script\b[^>]*>/gi;
  let resolvedRoot = '';
  let resolvedOutDir = '';
  return {
    name: 'hierarchidb:index-html-bundle-trace',
    apply: 'build',
    configResolved(config) {
      resolvedRoot = config.root;
      resolvedOutDir = config.build?.outDir ?? 'dist';
    },
    generateBundle(_options, bundle) {
      const envName =
        (this as { environment?: { name?: string; config?: { consumer?: string } } }).environment?.name ?? 'unknown';
      const envConsumer =
        (this as { environment?: { config?: { consumer?: string } } }).environment?.config?.consumer ?? 'unknown';
      const asset = bundle['index.html'];
      const indexBundleItem = bundle['assets/index.js'];
      if (indexBundleItem) {
        const itemType = indexBundleItem.type;
        const entryFlag =
          indexBundleItem.type === 'chunk' ? indexBundleItem.isEntry : 'n/a';
        const facade =
          indexBundleItem.type === 'chunk'
            ? indexBundleItem.facadeModuleId ?? 'null'
            : 'n/a';
        console.log(
          `[hierarchidb:index-html-bundle-trace] env=${envName}/${envConsumer} assets/index.js type=${itemType} entry=${entryFlag} facade=${facade}`,
        );
      }
      const indexLike = Object.values(bundle)
        .filter((item) => item.fileName.startsWith('assets/index'))
        .map((item) => {
          if (item.type === 'chunk') {
            return `${item.fileName}:chunk:entry=${item.isEntry}:facade=${item.facadeModuleId ?? 'null'}`;
          }
          return `${item.fileName}:asset`;
        })
        .slice(0, 10)
        .join(', ');
      if (indexLike) {
        console.log(
          `[hierarchidb:index-html-bundle-trace] env=${envName}/${envConsumer} index-like=${indexLike}`,
        );
      }
      const entryClientChunk = Object.values(bundle).find(
        (item) =>
          item.type === 'chunk' &&
          typeof item.facadeModuleId === 'string' &&
          item.facadeModuleId.includes('entry.client'),
      );
      if (entryClientChunk && entryClientChunk.type === 'chunk') {
        console.log(
          `[hierarchidb:index-html-bundle-trace] env=${envName}/${envConsumer} entry-client file=${entryClientChunk.fileName} entry=${entryClientChunk.isEntry}`,
        );
      } else {
        console.log(
          `[hierarchidb:index-html-bundle-trace] env=${envName}/${envConsumer} entry-client not found`,
        );
      }
      if (!asset || asset.type !== 'asset' || typeof asset.source !== 'string') {
        const keys = Object.keys(bundle).slice(0, 6).join(', ');
        const allChunks = Object.values(bundle).filter((chunk) => chunk.type === 'chunk');
        const entryChunks = allChunks.filter(
          (chunk) => chunk.type === 'chunk' && chunk.isEntry,
        );
        const entryCount = entryChunks.length;
        const chunkSample = allChunks
          .slice(0, 6)
          .map((chunk) => `${chunk.fileName}:entry=${chunk.isEntry}`)
          .join(', ');
        const entrySummary = entryChunks
          .map((chunk) => `${chunk.fileName}:${chunk.facadeModuleId ?? 'null'}`)
          .slice(0, 6)
          .join(', ');
        console.warn(
          `[hierarchidb:index-html-bundle-trace] env=${envName}/${envConsumer} index.html not found in bundle keys=${keys} entryCount=${entryCount} entryChunks=${entrySummary || 'none'} chunkSample=${chunkSample || 'none'}`,
        );
        return;
      }
      const html = asset.source;
      const hasModuleScript = moduleScriptPattern.test(html);
      const scriptCount = html.match(scriptTagPattern)?.length ?? 0;
      console.log(
        `[hierarchidb:index-html-bundle-trace] length=${html.length} moduleScript=${hasModuleScript} scriptTags=${scriptCount}`
      );
    },
    closeBundle() {
      if (!resolvedRoot) return;
      const outputIndex = path.resolve(resolvedRoot, resolvedOutDir, 'index.html');
      try {
        const html = readFileSync(outputIndex, 'utf8');
        const hasModuleScript = moduleScriptPattern.test(html);
        const scriptCount = html.match(scriptTagPattern)?.length ?? 0;
        console.log(
          `[hierarchidb:index-html-bundle-trace] wrote=${outputIndex} length=${html.length} moduleScript=${hasModuleScript} scriptTags=${scriptCount}`
        );
      } catch (error) {
        console.warn(`[hierarchidb:index-html-bundle-trace] failed to read ${outputIndex}:`, error);
      }
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
      let watcherReady = false;
      server.watcher.on('ready', () => {
        watcherReady = true;
      });

      server.watcher.on('add', (file) => {
        // Ignore chokidar's initial scan flood to avoid redundant startup regenerations.
        if (!watcherReady) return;
        if (shouldTrigger(file)) {
          void enqueuePluginRegistryGeneration(mode);
        }
      });
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
export default defineConfig(({ mode, command, isSsrBuild }) => {
  const env = loadEnv(mode, __dirname, '');
  // Use VITE_APP_NAME as the only base selector; default to root '/'
  const appName = (env.VITE_APP_NAME || '').replace(/^\/+|\/+$/g, '');
  const isDev = mode === 'development';
  const base = isDev ? '/' : appName ? `/${appName}/` : '/';
  const enableWorkspaceAliases = mode === 'development' || mode === 'test' || mode === 'production';
  const requestedPluginSpecMode = (env.HDB_PLUGIN_SPEC_MODE || process.env.HDB_PLUGIN_SPEC_MODE || '').toLowerCase();
  if (requestedPluginSpecMode && requestedPluginSpecMode !== 'package') {
    throw new Error(`[plugin-registry] HDB_PLUGIN_SPEC_MODE must be "package" for this build (got "${requestedPluginSpecMode}").`);
  }
  const pluginRegistryMode: PluginSpecifierMode = 'package';

  const repoRoot = path.resolve(__dirname, '..');
  const configuredSourceSha = env.HDB_SOURCE_SHA || process.env.HDB_SOURCE_SHA || '';
  const databasePrefix = env.VITE_APP_PREFIX;
  if (
    typeof databasePrefix !== 'string'
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(databasePrefix)
  ) {
    throw new Error('[yaml-storage-preflight] VITE_APP_PREFIX must be an exact database prefix');
  }
  const correctiveRecoveryMode = Object.hasOwn(
    process.env,
    'VITE_YAML_STORAGE_CORRECTIVE_RECOVERY_MODE',
  )
    ? process.env.VITE_YAML_STORAGE_CORRECTIVE_RECOVERY_MODE
    : env.VITE_YAML_STORAGE_CORRECTIVE_RECOVERY_MODE;
  const correctiveRecoveryFingerprint = Object.hasOwn(
    process.env,
    'VITE_YAML_STORAGE_CORRECTIVE_RECOVERY_FINGERPRINT',
  )
    ? process.env.VITE_YAML_STORAGE_CORRECTIVE_RECOVERY_FINGERPRINT
    : env.VITE_YAML_STORAGE_CORRECTIVE_RECOVERY_FINGERPRINT;
  if (correctiveRecoveryMode !== 'disabled' && correctiveRecoveryMode !== 'incident-1388-v1') {
    throw new Error(
      '[yaml-storage-corrective-recovery] mode must be exact disabled or incident-1388-v1',
    );
  }
  if (
    (correctiveRecoveryMode === 'disabled' && correctiveRecoveryFingerprint !== undefined)
    || (correctiveRecoveryMode === 'incident-1388-v1'
      && (typeof correctiveRecoveryFingerprint !== 'string'
        || !/^[0-9a-f]{64}$/u.test(correctiveRecoveryFingerprint)))
  ) {
    throw new Error('[yaml-storage-corrective-recovery] fingerprint configuration is invalid');
  }
  let sourceSha = configuredSourceSha;
  if (sourceSha.length === 0) {
    try {
      sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repoRoot,
        encoding: 'utf8',
      }).trim();
    } catch {
      throw new Error('[origin-coordinator] exact source SHA is unavailable');
    }
  }
  if (!/^[0-9a-f]{40}$/u.test(sourceSha)) {
    throw new Error('[origin-coordinator] HDB_SOURCE_SHA must be an exact lowercase commit SHA');
  }
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
    specialPrefixRewritePlugin(base),
    ...(command === 'serve'
      ? [
        pluginRegistryGeneratorPlugin({
          rootDir: repoRoot,
          mode: pluginRegistryMode,
        }),
      ]
      : []),
    createIso3166Plugin({
      outputDir: 'public',
      outputFile: 'iso3166-2-level1.csv',
      failureFile: 'iso3166-2-level1.failures.csv',
    }),
    createNodeTypeAliasPlugin({
      rootDir: repoRoot,
      shouldAlias: (entry) => isDev && shouldUsePluginSource(devAliasSelection, entry.packageName, entry.nodeType),
    }),
    pluginTildeRootAliasPlugin(),
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
          outDir: isSsrBuild ? 'stage/server-types' : 'stage/client-types',
          rollupTypes: false,
          insertTypesEntry: false,
          copyDtsFiles: true,
        }),
      ]
      : []),
    faviconPlugin(), // Add favicon plugin to serve favicon at root
    missingSourceMapFallbackPlugin(),
    comlink(), // Add Comlink plugin for Worker support
    ...(env.HDB_TRACE_INDEX_HTML === '1' || process.env.HDB_TRACE_INDEX_HTML === '1'
      ? [
        buildIndexHtmlHookTracePlugin(),
        buildConfigTracePlugin(),
        buildIndexBundleTracePlugin(),
        buildIndexHtmlTracePlugin('pre'),
        buildIndexHtmlTracePlugin('post'),
        buildIndexResolveTracePlugin(),
      ]
      : []),
    // tsconfigPaths is appended after runtime-worker alias configuration.
    // It is re-injected below after dev alias filtering.
  ];

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
    console.log(
      '[vite.config] main plugin order',
      plugins.map((p) => (p && typeof p === 'object' && 'name' in p ? (p as Plugin).name : undefined))
    );
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
    name: 'hdb-stage-beacon',
    configureServer(server: ViteDevServer) {
      const startedAt = new Date().toISOString();
      const beaconHandler = (_req: IncomingMessage, res: ServerResponse) => {
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
      const handler = async (
        req: IncomingMessage,
        res: ServerResponse,
        next: (err?: Error) => void
      ) => {
        try {
          // Allow only localhost callers
          const remote = (req.socket?.remoteAddress || '').toString();
          const forwardedHeader = req.headers['x-forwarded-for'];
          const forwarded = (Array.isArray(forwardedHeader) ? forwardedHeader[0] : forwardedHeader || '')?.split(',')[0]?.trim();
          const hostHeader = (req.headers['host'] || '').toString();
          const isLocalAddr = (addr: string) => !!addr && (
            addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
          );
          const isLocalHostHeader = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(hostHeader);
          const isLocal = isLocalAddr(remote) || (forwarded && isLocalAddr(forwarded)) || isLocalHostHeader;
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
            // Cast to Node's ReadableStream type to satisfy Readable.fromWeb typing.
            const nodeBody = body as import('node:stream/web').ReadableStream;
            Readable.fromWeb(nodeBody).pipe(res);
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
    root: __dirname,
    appType: 'spa',
    base,
    clearScreen: false,
    define: (() => {
      // Inject version and stage time for logging
      return {
        __APP_VERSION__: JSON.stringify(appVersion),
        __BUILD_TIME__: JSON.stringify(buildTime),
        __SOURCE_SHA__: JSON.stringify(sourceSha),
        __HDB_DATABASE_PREFIX__: JSON.stringify(databasePrefix),
        __HDB_YAML_STORAGE_CORRECTIVE_RECOVERY_MODE__: JSON.stringify(correctiveRecoveryMode),
        __HDB_YAML_STORAGE_CORRECTIVE_RECOVERY_FINGERPRINT__: JSON.stringify(
          correctiveRecoveryFingerprint ?? null,
        ),
        // Expose selected non-VITE_ envs for client/runtime-worker packages that check them
        'import.meta.env.HDB_LOCAL_PROXY': JSON.stringify(env.HDB_LOCAL_PROXY || process.env.HDB_LOCAL_PROXY || ''),
      } as Record<string, string>;
    })(),
    plugins: [
      buildBeaconPlugin,
      hdbDevProxyPlugin,
      // Inject window.__HDB_APP_BASE__ before any module scripts run so that
      // the i18n package can compute the correct locale load path even during
      // module-level initialisation (before initializeBrowserGlobals executes).
      {
        name: 'inject-hdb-app-base',
        transformIndexHtml: {
          order: 'pre' as const,
          handler: () => [
            {
              tag: 'script',
              attrs: { type: 'text/javascript' },
              injectTo: 'head-prepend' as const,
              children: `window.__HDB_APP_BASE__ = ${JSON.stringify(base)};`,
            },
          ],
        },
      } as Plugin,
      ...plugins,
    ],
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
        // Ensure a single instance for plugin dialog runtime-worker across app and plugin-loader
        '@hierarchidb/runtime-worker-ui-plugin-dialog',
      ],
      alias: [
        { find: '~~', replacement: path.resolve(__dirname, './src') },
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
          find: '@hierarchidb/ui-plugin-shell/ui-icon',
          replacement: path.resolve(
            __dirname,
            isDev ? '../packages/ui/icon/src/index.ts' : '../packages/ui/icon/dist/index.js',
          ),
        },
        {
          find: '@hierarchidb/runtime-worker-worker',
          replacement: path.resolve(
            __dirname,
            isDev ? '../packages/runtime-worker/worker/src/index.ts' : '../packages/runtime-worker/worker/dist/index.js',
          ),
        },
        {
          find: '@hierarchidb/util',
          replacement: path.resolve(
            __dirname,
            isDev ? '../packages/util/src/index.ts' : '../packages/util/dist/index.js',
          ),
        },
        // Unify plugin-dialog runtime-worker to a single module instance to avoid split singletons
        { find: '@hierarchidb/runtime-worker-ui-plugin-dialog', replacement: path.resolve(__dirname, '../packages/plugin-ui-sdk/dist/index.js') },
        // Base plugin is an internal helper library; if it accidentally appears in a virtual import,
        // make it resolvable to its built output to avoid dev server crashes.
        { find: '@hierarchidb/base-plugin', replacement: path.resolve(__dirname, '../packages/plugin-loader/base-plugin/dist/index.ts') },
        // Virtual modules are provided by @hierarchidb/vite-plugin-hierarchidb-plugin-alias.
        // Legacy provider alias used by some plugin-loader
        { find: 'provider-i18next', replacement: 'react-i18next' },
        // Temporary workspace alias: ensure Vite resolves @hierarchidb/build used by plugin-loader
        // Rationale: location-plugin bundles it as external; alias points to built dist
        // Temporary aliases removed after dynamic imports hardened
        // Note: do not alias workspace packages; rely on declared deps and workspace linking
      ],
    },
    server: {
      port: 4200,
      strictPort: true,
      open: true,
      host: true,
      headers: {
        'Service-Worker-Allowed': '/',
      },
      fs: {
        // Allow serving files from the monorepo root
        allow: [path.resolve(__dirname, '..')],
      },
      // Dev proxy for BFF endpoints
      proxy: {
        '/auth': (() => {
          // Support BFF endpoints that may already live under a base path (e.g. /api/auth)
          const rawBffUrl =
            env.VITE_BFF_BASE_URL || 'https://hierarchidb-bff.kubohiroya.workers.dev';
          let bffUrl: URL;
          try {
            bffUrl = new URL(rawBffUrl);
          } catch {
            bffUrl = new URL('http://localhost:8787/api/auth');
          }
          const origin = `${bffUrl.protocol}//${bffUrl.host}`;
          const basePath = bffUrl.pathname.replace(/\/$/, '');

          return {
            target: origin,
            changeOrigin: true,
            secure: true,
            rewrite: (path) => {
              const stripped = path.replace(/^\/auth/, '');
              const upstreamBase = basePath || '/auth';
              return `${upstreamBase}${stripped}`;
            },
            // Avoid proxying SPA callback to BFF to prevent redirect loop
            bypass: (req) => {
              if (req.url?.startsWith('/auth/callback')) {
                return req.url;
              }
              return undefined;
            },
          };
        })(),
      },
    },
    worker: {
      format: 'es',
      plugins: () => [
        pluginTildeRootAliasPlugin(),
        comlink(),
      ],
      rollupOptions: {
        output: {
          entryFileNames: '[name].js',
          manualChunks(id: string) {
            const moduleId = id.split('?', 1)[0]?.replaceAll('\\', '/');
            if (moduleId?.endsWith('/app/src/worker-runtime/workerBootstrapUtils.ts')) {
              return 'worker-runtime-shared';
            }
            return undefined;
          },
        },
      },
    },
    build: {
      outDir: 'dist',
      //  production
      sourcemap: mode === 'development' || env.HDB_PREVIEW_SOURCEMAP === '1',
      manifest: true,
      // MapLibre GL + deck.gl バンドル（~953 kB）に合わせて閾値を調整。
      chunkSizeWarningLimit: 954,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'index.html'),
          'yaml-storage-preflight': path.resolve(__dirname, 'yaml-storage-preflight.html'),
          'hdb-origin-coordinator': path.resolve(
            __dirname,
            'src/origin-coordinator/originCoordinator.worker.ts',
          ),
        },
        output: {
          entryFileNames: (chunkInfo) =>
            chunkInfo.name === 'hdb-origin-coordinator'
              ? 'hdb-origin-coordinator.js'
              : 'assets/[name].js',
          chunkFileNames: (chunkInfo) =>
            chunkInfo.name === 'originCoordinatorValidatorUtils'
              ? 'assets/originCoordinatorValidatorUtils-BBabyZU5.js'
              : 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name][extname]',
          ...(isSsrBuild
            ? {}
            : {
              manualChunks(id: string) {
                if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
                  return 'vendor-react';
                }
                return undefined;
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
    optimizeDeps: {
      // Crawl app + workspace sources up front so dependency discovery does not happen
      // incrementally during the first browser session.
      entries: [
        'index.html',
        'yaml-storage-preflight.html',
        'src/**/*.{ts,tsx}',
      ],
      // ---------------------------------------------------------------
      // IMPORTANT: Keep this list in sync with actual imports.
      // When adding a new third-party import to the codebase, also add
      // it here to prevent Vite dev-server reload loops.
      // See AGENTS.md "Vite optimizeDeps" rule.
      // ---------------------------------------------------------------
      include: [
        // --- React core ---
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-dom/client',

        // --- Emotion ---
        '@emotion/react',
        '@emotion/react/jsx-dev-runtime',
        '@emotion/styled',

        // --- State management ---
        'jotai',
        'jotai/vanilla',
        'jotai/vanilla/store',
        'jotai/utils',
        'jotai-family',

        // --- Routing ---
        '@tanstack/react-router',

        // --- Tables / virtualisation ---
        '@tanstack/react-table',
        '@tanstack/react-virtual',
        'react-virtuoso',
        'react-window',

        // --- UI libraries ---
        'react-resizable',
        'react-draggable',
        'react-joyride',
        'react-gravatar',
        'react-hook-geolocation',
        'notistack',
        'allotment',

        // --- Auth ---
        'react-oidc-context',
        'oidc-client-ts',
        '@react-oauth/google',

        // --- MUI core ---
        '@mui/material',
        '@mui/material/Chip',
        '@mui/material/CssBaseline',
        '@mui/material/Grid',
        '@mui/material/Menu',
        '@mui/material/Popover',
        '@mui/material/Select',
        '@mui/material/SpeedDialIcon',
        '@mui/material/StepIcon',
        '@mui/material/SvgIcon',
        '@mui/material/Tooltip',
        '@mui/material/styles',
        '@mui/material/OverridableComponent',

        // --- MUI icons (keep alphabetical) ---
        '@mui/icons-material',
        '@mui/icons-material/AccessTime',
        '@mui/icons-material/AccountTree',
        '@mui/icons-material/Approval',
        '@mui/icons-material/ArrowDownward',
        '@mui/icons-material/ArrowDropDown',
        '@mui/icons-material/ArrowLeft',
        '@mui/icons-material/ArrowRight',
        '@mui/icons-material/ArrowUpward',
        '@mui/icons-material/Assessment',
        '@mui/icons-material/Attachment',
        '@mui/icons-material/AutoFixHigh',
        '@mui/icons-material/Autorenew',
        '@mui/icons-material/BarChart',
        '@mui/icons-material/Bookmarks',
        '@mui/icons-material/Check',
        '@mui/icons-material/CheckCircle',
        '@mui/icons-material/CheckCircleOutline',
        '@mui/icons-material/ChevronLeft',
        '@mui/icons-material/ChevronRight',
        '@mui/icons-material/Clear',
        '@mui/icons-material/Close',
        '@mui/icons-material/CloudDownload',
        '@mui/icons-material/CloudOff',
        '@mui/icons-material/Construction',
        '@mui/icons-material/ContentCopy',
        '@mui/icons-material/Contrast',
        '@mui/icons-material/Delete',
        '@mui/icons-material/Download',
        '@mui/icons-material/DragIndicator',
        '@mui/icons-material/Engineering',
        '@mui/icons-material/ErrorOutline',
        '@mui/icons-material/ExpandMore',
        '@mui/icons-material/Extension',
        '@mui/icons-material/FilterAlt',
        '@mui/icons-material/FilterAltOff',
        '@mui/icons-material/FilterListOff',
        '@mui/icons-material/FitScreenSharp',
        '@mui/icons-material/Folder',
        '@mui/icons-material/FolderOpen',
        '@mui/icons-material/Hexagon',
        '@mui/icons-material/Info',
        '@mui/icons-material/InsertDriveFile',
        '@mui/icons-material/Key',
        '@mui/icons-material/KeyboardArrowDown',
        '@mui/icons-material/KeyboardArrowUp',
        '@mui/icons-material/Layers',
        '@mui/icons-material/LocationOn',
        '@mui/icons-material/Login',
        '@mui/icons-material/Map',
        '@mui/icons-material/MoreVert',
        '@mui/icons-material/OpenInFull',
        '@mui/icons-material/OpenInNew',
        '@mui/icons-material/OpenInNewOff',
        '@mui/icons-material/Palette',
        '@mui/icons-material/Pause',
        '@mui/icons-material/PauseCircle',
        '@mui/icons-material/PhonelinkErase',
        '@mui/icons-material/PlayArrow',
        '@mui/icons-material/PlaylistRemove',
        '@mui/icons-material/Preview',
        '@mui/icons-material/Public',
        '@mui/icons-material/RadioButtonUnchecked',
        '@mui/icons-material/Refresh',
        '@mui/icons-material/Replay',
        '@mui/icons-material/RestartAlt',
        '@mui/icons-material/Route',
        '@mui/icons-material/Search',
        '@mui/icons-material/Settings',
        '@mui/icons-material/SkipNext',
        '@mui/icons-material/TableChart',
        '@mui/icons-material/TaskAlt',
        '@mui/icons-material/Timelapse',
        '@mui/icons-material/Tune',
        '@mui/icons-material/Visibility',

        // --- MUI date pickers ---
        '@mui/x-date-pickers',
        '@mui/x-date-pickers/AdapterDateFns',

        // --- Map / GIS ---
        '@vis.gl/react-maplibre',
        'maplibre-gl',
        '@maplibre/vt-pbf',
        'deck.gl',
        '@deck.gl/core',
        '@deck.gl/geo-layers',
        '@deck.gl/layers',
        '@deck.gl/mapbox',
        'leaflet',
        '@watergis/maplibre-gl-export',
        'flatgeobuf',
        'geojson-vt',
        'pbf',
        '@mapbox/vector-tile',

        // --- Turf (GIS helpers) ---
        '@turf/area',
        '@turf/bbox',
        '@turf/bbox-clip',
        '@turf/bbox-polygon',
        '@turf/boolean-contains',
        '@turf/boolean-intersects',
        '@turf/boolean-point-in-polygon',
        '@turf/boolean-valid',
        '@turf/clean-coords',
        '@turf/helpers',
        '@turf/simplify',
        '@turf/unkink-polygon',

        // --- Topology / shape ---
        'topojson-client',
        'topojson-server',
        'topojson-simplify',
        'shpjs',

        // --- Data / IO ---
        'dexie',
        'xlsx',
        'xlsx/xlsx.mjs',
        'jszip',
        'uuid',
        'typescript-lru-cache',
        'date-fns/locale',

        // --- DI ---
        'inversify',

        // --- Auth / crypto ---
        'jose',

        // --- i18n ---
        'i18next',
        'i18next-browser-languagedetector',
        'i18next-http-backend',

        // --- Reactive ---
        'rxjs',

        // --- Workers ---
        'comlink',

        // --- JSON Schema Form (rjsf) ---
        '@rjsf/core',
        '@rjsf/mui',
        '@rjsf/utils',
        '@rjsf/validator-ajv8',
        'ajv',

        // --- YAML ---
        'yaml',

        // --- MUI icon for yaml-plugin ---
        '@mui/icons-material/Description',
      ],
      // Exclude specific packages from pre-bundle so Vite watches sources directly
      exclude: runtimeAliasConfig.optimizeDepsExclude,
      rolldownOptions: {},
    },
  };
});
