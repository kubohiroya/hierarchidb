import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { ManifestSummary, PluginSpecifierMode } from './types.ts';
import {
  buildDatabasePrewarmTargets,
  capitalize,
  deriveNodeType,
  normalizeMuiIconName,
  sanitizeDependencies,
  sanitizeManifest,
} from './manifest-utils.ts';
import { loadPluginManifestFromFile } from './manifest-loader.ts';
import { fileExists, loadAppPackage, loadJsonIfExists, readPluginPackageJSON } from './fs-utils.ts';
import { repoRoot } from './paths.ts';
import {
  COMMON_DIST_ENTRY_BASENAMES,
  COMMON_ENTRY_BASENAMES,
  DATABASE_DIST_ENTRY_BASENAMES,
  DATABASE_ENTRY_BASENAMES,
  ICON_DIST_ENTRY_BASENAMES,
  ICON_ENTRY_BASENAMES,
  ROOT_DIST_ENTRY_BASENAMES,
  UI_DIST_ENTRY_BASENAMES,
  UI_ENTRY_BASENAMES,
  WORKER_DIST_ENTRY_BASENAMES,
  WORKER_ENTRY_BASENAMES,
} from './entries.ts';
import { findEntryFile, hasExportPath } from './entry-resolver.ts';

function extractPluginDeps(pkg: Record<string, any> | null | undefined): string[] {
  if (!pkg || typeof pkg !== 'object') return [];
  const sections: Array<'dependencies' | 'devDependencies' | 'optionalDependencies'> = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
  ];
  const names = new Set<string>();
  for (const section of sections) {
    const record = pkg[section];
    if (!record || typeof record !== 'object') continue;
    for (const name of Object.keys(record)) {
      if (/-plugin$/.test(name)) {
        names.add(name);
      }
    }
  }
  return Array.from(names);
}

async function collectPluginPackages(): Promise<string[]> {
  const appPkg = await loadAppPackage();
  const pluginNames = new Set<string>(extractPluginDeps(appPkg));

  if (pluginNames.size === 0) {
    const featureCorePkgPath = path.join(repoRoot, 'packages', 'feature-core', 'package.json');
    const featureCorePkg = await loadJsonIfExists(featureCorePkgPath);
    for (const name of extractPluginDeps(featureCorePkg)) {
      pluginNames.add(name);
    }
  }

  if (pluginNames.size === 0) {
    const pluginsDir = path.join(repoRoot, 'plugins');
    try {
      const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!/-plugin$/.test(entry.name)) continue;
        const pkgPath = path.join(pluginsDir, entry.name, 'package.json');
        const pluginPkg = await loadJsonIfExists(pkgPath);
        if (pluginPkg && typeof pluginPkg.name === 'string' && /-plugin$/.test(pluginPkg.name)) {
          pluginNames.add(pluginPkg.name);
        } else {
          pluginNames.add(`@hierarchidb/${entry.name}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[generate-plugin-registry] Failed to enumerate plugins directory:', message);
    }
  }

  return Array.from(pluginNames).sort();
}

export async function collectManifests(mode: PluginSpecifierMode): Promise<ManifestSummary[]> {
  const pluginPackages = await collectPluginPackages();
  const manifests: ManifestSummary[] = [];

  for (const pkgName of pluginPackages) {
    const nodeType = deriveNodeType(pkgName);
    if (!nodeType) continue;

    const { json: pluginPkg, path: pkgPath, dir: pkgDir } = await readPluginPackageJSON(pkgName, nodeType);
    if (!pluginPkg || !pkgDir || !pkgPath) {
      continue;
    }

    const manifestCandidates = [
      path.join(pkgDir, 'src', 'extension', 'plugin-manifest.ts'),
      path.join(pkgDir, 'src', 'plugin-manifest.ts'),
    ];
    let manifestPath: string | undefined;
    for (const candidate of manifestCandidates) {
      if (await fileExists(candidate)) {
        manifestPath = candidate;
        break;
      }
    }
    if (!manifestPath) {
      continue;
    }

    const manifest = await loadPluginManifestFromFile(manifestPath);
    const sanitizedManifest = sanitizeManifest(manifest, { packageDescription: pluginPkg.description });
    if (!sanitizedManifest) continue;

    const packageVersion = typeof pluginPkg.version === 'string' ? pluginPkg.version : '0.0.0';
    const dependencies = sanitizeDependencies(pluginPkg);
    const exportPathSet = new Set<string>();
    const pkgExports = pluginPkg.exports ?? {};
    if (typeof pkgExports === 'string') {
      exportPathSet.add('');
    } else if (Array.isArray(pkgExports)) {
      exportPathSet.add('');
    } else if (pkgExports && typeof pkgExports === 'object') {
      for (const key of Object.keys(pkgExports)) {
        if (key === '.') {
          exportPathSet.add('');
        } else if (key.startsWith('./')) {
          const cleaned = key.slice(2);
          exportPathSet.add(cleaned);
        }
      }
    } else {
      exportPathSet.add('');
    }

    const rootDistEntry = await findEntryFile(pkgDir, ROOT_DIST_ENTRY_BASENAMES);
    const workerSourceEntry = await findEntryFile(pkgDir, WORKER_ENTRY_BASENAMES);
    const workerDistEntry = await findEntryFile(pkgDir, WORKER_DIST_ENTRY_BASENAMES);
    const uiSourceEntry = await findEntryFile(pkgDir, UI_ENTRY_BASENAMES);
    const uiDistEntry = await findEntryFile(pkgDir, UI_DIST_ENTRY_BASENAMES);
    const databaseSourceEntry = await findEntryFile(pkgDir, DATABASE_ENTRY_BASENAMES);
    const databaseDistEntry = await findEntryFile(pkgDir, DATABASE_DIST_ENTRY_BASENAMES);
    const commonSourceEntry = await findEntryFile(pkgDir, COMMON_ENTRY_BASENAMES);
    const commonDistEntry = await findEntryFile(pkgDir, COMMON_DIST_ENTRY_BASENAMES);
    const iconSourceEntry = await findEntryFile(pkgDir, ICON_ENTRY_BASENAMES);
    const iconDistEntry = await findEntryFile(pkgDir, ICON_DIST_ENTRY_BASENAMES);

    const hasWorkerEntry = mode === 'dist-url'
      ? Boolean(workerSourceEntry || workerDistEntry)
      : Boolean(workerSourceEntry);
    const hasUiEntry = mode === 'dist-url'
      ? Boolean(uiSourceEntry || uiDistEntry)
      : Boolean(uiSourceEntry);
    const hasDatabaseEntry = mode === 'dist-url'
      ? Boolean(databaseSourceEntry || databaseDistEntry)
      : Boolean(databaseSourceEntry);
    const hasIconEntry = mode === 'dist-url'
      ? Boolean(iconSourceEntry || iconDistEntry)
      : Boolean(iconSourceEntry);
    const hasCommon = Boolean(commonSourceEntry);

    const iconComponentConfig = sanitizedManifest.icon?.component;
    const iconComponent = iconComponentConfig && hasIconEntry && typeof iconComponentConfig === 'object'
      && typeof iconComponentConfig.specifier === 'string'
        ? {
            specifier: iconComponentConfig.specifier,
            exportName: typeof iconComponentConfig.exportName === 'string'
              ? iconComponentConfig.exportName
              : undefined,
            sourceEntry: iconSourceEntry,
            distEntry: iconDistEntry,
          }
        : undefined;

    const defaultDatabaseSpecifier = databaseSourceEntry
      ? `${pkgName}/database`
      : pkgName;

    const databasePrewarmTargets = buildDatabasePrewarmTargets(
      sanitizedManifest.database?.prewarm,
      defaultDatabaseSpecifier,
    );

    const databaseModuleSpecifier = defaultDatabaseSpecifier;

    sanitizedManifest.dependencies = dependencies;
    sanitizedManifest.packageName = pkgName;
    sanitizedManifest.nodeType = sanitizedManifest.nodeType ?? nodeType;
    sanitizedManifest.displayName = sanitizedManifest.displayName ?? capitalize(nodeType);
    sanitizedManifest.name = sanitizedManifest.name ?? pluginPkg.name ?? pkgName;
    sanitizedManifest.version = sanitizedManifest.version ?? packageVersion;
    sanitizedManifest.icon = sanitizedManifest.icon ?? {};
    const normalizedMuiIcon = normalizeMuiIconName(
      sanitizedManifest.icon.muiIconName ?? sanitizedManifest.icon.mui,
    );
    if (normalizedMuiIcon) {
      sanitizedManifest.icon.muiIconName = normalizedMuiIcon;
    } else {
      delete sanitizedManifest.icon.muiIconName;
    }
    if (!iconComponent && sanitizedManifest.icon && typeof sanitizedManifest.icon === 'object') {
      delete sanitizedManifest.icon.component;
    }

    const hasExportedUi = hasUiEntry && hasExportPath(Array.from(exportPathSet), 'ui');
    const hasExportedWorker = hasWorkerEntry && hasExportPath(Array.from(exportPathSet), 'worker');
    const hasExportedDatabase =
      hasDatabaseEntry &&
      (hasExportPath(Array.from(exportPathSet), 'database') ||
        hasExportPath(Array.from(exportPathSet), 'worker/database'));

    const filteredExportPaths = Array.from(exportPathSet).filter((value) => {
      const cleaned = value.replace(/^\.?\//, '');
      if (cleaned.length === 0) return true;
      if (cleaned === 'ui' || cleaned.startsWith('ui/')) return hasExportedUi;
      if (cleaned === 'worker' || cleaned.startsWith('worker/')) return hasExportedWorker;
      if (
        cleaned === 'database' ||
        cleaned.startsWith('database/') ||
        cleaned === 'worker/database' ||
        cleaned.startsWith('worker/database/')
      ) {
        return hasExportedDatabase;
      }
      if (cleaned === 'icon' || cleaned.startsWith('icon/')) return Boolean(iconComponent);
      return true;
    });

    if (!hasExportedWorker) {
      delete sanitizedManifest.worker;
    }
    if (!hasExportedDatabase) {
      delete sanitizedManifest.database;
    }

    const workerPreloadExports = hasExportedWorker && Array.isArray(sanitizedManifest.worker?.preload)
      ? sanitizedManifest.worker.preload.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    manifests.push({
      manifest: sanitizedManifest,
      nodeType: sanitizedManifest.nodeType,
      packageName: pkgName,
      packageVersion,
      dependencies,
      hasUI: hasExportedUi,
      hasWorker: hasExportedWorker,
      hasDatabaseModule: hasExportedDatabase,
      hasCommon,
      exportPaths: filteredExportPaths,
      uiSourceEntry,
      workerSourceEntry,
      databaseSourceEntry,
      commonSourceEntry,
      rootDistEntry,
      uiDistEntry,
      workerDistEntry,
      databaseDistEntry,
      commonDistEntry,
      iconComponent,
      workerPreloadExports,
      databaseModuleSpecifier,
      databasePrewarmTargets,
    });
  }

  return manifests;
}
