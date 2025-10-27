/**
 * Script: gen-plugin-loaders
 * Purpose: Generate the canonical plugin registry artefact consumed by both the app and
 *          runtime worker. The registry is emitted to `packages/plugin-registry/generated/registry.ts`
 *          and other consumers derive runtime data from that single source.
 * Invocation: executed via `pnpm --filter @hierarchidb/tools-build-scripts run gen-plugin-loaders`
 *             (root alias: `pnpm run tools:gen-plugin-loaders`).
 * Output: writes `packages/plugin-registry/generated/registry.ts`. Legacy artefacts
 *         under `app/src/generated/*`, `app/src/plugin-registry/generated/*`,
 *         `packages/runtime/worker/src/generated/*`, and `types/generated/*` are removed.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, '..', '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const require = createRequire(import.meta.url);

let loadPluginManifestFromFile: (manifestPath: string) => any = () => undefined;
let manifestLoaderResolved = false;
try {
  ({ loadPluginManifestFromFile } = await import('@hierarchidb/tools-plugin-manifest-loader'));
  manifestLoaderResolved = true;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn('[generate-plugin-loader] Failed to load manifest loader via workspace import:', message);
  const fallbackDist = path.join(repoRoot, 'packages', 'tools', 'plugin-manifest-loader', 'dist', 'index.js');
  if (await fileExists(fallbackDist)) {
    try {
      ({ loadPluginManifestFromFile } = await import(pathToFileURL(fallbackDist).href));
      manifestLoaderResolved = true;
      console.warn('[generate-plugin-loader] Fallback: loaded manifest loader from local dist build.');
    } catch (fallbackError) {
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.warn('[generate-plugin-loader] Fallback import failed:', fallbackMessage);
    }
  } else {
    console.warn('[generate-plugin-loader] Fallback dist missing at', fallbackDist);
  }
  if (!manifestLoaderResolved) {
    console.warn('[generate-plugin-loader] Continuing without manifest introspection.');
  }
}

const appDir = path.join(repoRoot, 'app');
const appPkgPath = path.join(appDir, 'package.json');
const pluginRegistryPackageDir = path.join(repoRoot, 'packages', 'plugin-registry');
const registryGeneratedDir = path.join(pluginRegistryPackageDir, 'generated');
const registryOutputFile = path.join(registryGeneratedDir, 'registry.ts');
const WORKER_ENTRY_BASENAMES = [
  'src/worker/index.ts',
  'src/worker/index.tsx',
  'src/worker/index.mts',
  'src/worker/index.mjs',
  'src/worker/index.js',
  'src/worker/index.cjs',
];
const UI_ENTRY_BASENAMES = [
  'src/ui/index.ts',
  'src/ui/index.tsx',
  'src/ui/index.mts',
  'src/ui/index.mjs',
  'src/ui/index.js',
  'src/ui/index.cjs',
  'src/ui/facade/index.ts',
  'src/ui/facade/index.tsx',
  'src/ui/facade/index.mts',
  'src/ui/facade/index.mjs',
  'src/ui/facade/index.js',
  'src/ui/facade/index.cjs',
  'src/ui.ts',
  'src/ui.tsx',
  'src/ui.mts',
  'src/ui.mjs',
  'src/ui.js',
  'src/ui.cjs',
];
const DATABASE_ENTRY_BASENAMES = [
  'src/database/index.ts',
  'src/database/index.tsx',
  'src/database/index.mts',
  'src/database/index.mjs',
  'src/database/index.js',
  'src/database/index.cjs',
  'src/services/database/index.ts',
  'src/services/database/index.tsx',
  'src/services/database/index.mts',
  'src/services/database/index.mjs',
  'src/services/database/index.js',
  'src/services/database/index.cjs',
  'src/database.ts',
  'src/database.mts',
  'src/database.mjs',
  'src/database.js',
  'src/database.cjs',
];
const COMMON_ENTRY_BASENAMES = [
  'src/common/index.ts',
  'src/common/index.tsx',
  'src/common/index.mts',
  'src/common/index.mjs',
  'src/common/index.js',
  'src/common/index.cjs',
  'src/common.ts',
  'src/common.mts',
  'src/common.mjs',
  'src/common.js',
  'src/common.cjs',
  'src/shared/index.ts',
  'src/shared/index.tsx',
  'src/shared/index.mts',
  'src/shared/index.mjs',
  'src/shared/index.js',
  'src/shared/index.cjs',
  'src/shared.ts',
  'src/shared.mts',
  'src/shared.mjs',
  'src/shared.js',
  'src/shared.cjs',
];

function deriveNodeType(pkgName: string): string | undefined {
  const match = pkgName.match(/@hierarchidb\/([a-z0-9-]+)-plugin$/);
  return match?.[1];
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function toPascalCase(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^[A-Z][A-Za-z0-9]*$/.test(trimmed)) return trimmed;
  const parts = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('');
}

async function findEntryFile(packageDir: string, candidates: readonly string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const absolute = path.join(packageDir, candidate);
    if (await fileExists(absolute)) {
      return path.relative(repoRoot, absolute).split(path.sep).join('/');
    }
  }
  return null;
}

function normalizeMuiIconName(raw?: string): string | undefined {
  if (!raw) return undefined;
  const lut: Record<string, string> = {
    locationpin: 'LocationOn',
    location: 'LocationOn',
    mapmarker: 'Place',
    basemap: 'Public',
    project: 'AccountTree',
    spreadsheet: 'Assessment',
    resolver: 'Extension',
    styler: 'Palette',
    timeline: 'AccessTime',
  };
  const key = raw.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const mapped = lut[key] || raw;
  const pascal = toPascalCase(mapped);
  if (!pascal) return undefined;
  if (pascal.endsWith('Icon')) {
    const trimmed = pascal.slice(0, -4);
    return trimmed.length > 0 ? trimmed : pascal;
  }
  return pascal;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function writeFileIfChanged(filePath: string, contents: string): Promise<boolean> {
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

async function readPluginPackageJSON(pkgName: string, nodeType: string) {
  try {
    const resolved = require.resolve(`${pkgName}/package.json`);
    const json = JSON.parse(await fs.readFile(resolved, 'utf8'));
    return { json, path: resolved, dir: path.dirname(resolved) };
  } catch {
    const fallback = path.join(repoRoot, 'plugins', `${nodeType}-plugin`, 'package.json');
    if (await fileExists(fallback)) {
      const json = JSON.parse(await fs.readFile(fallback, 'utf8'));
      return { json, path: fallback, dir: path.dirname(fallback) };
    }
  }
  return { json: undefined, path: undefined, dir: undefined };
}

/*
function normalizeDependency(spec: unknown): string | null {
  if (typeof spec !== 'string') return null;
  const trimmed = spec.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^@hierarchidb\/([a-z0-9-]+)-plugin$/i);
  if (match && match.length >= 2 && typeof match[1] === 'string' && match[1].length > 0) {
    return match[1];
  }
  return trimmed;
}
 */

function filterValidDependencies(values: Array<string | null>): string[] {
  return values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

interface ManifestSummary {
  manifest: Record<string, any>;
  nodeType: string;
  packageName: string;
  packageVersion: string;
  dependencies: string[];
  hasUI: boolean;
  hasWorker: boolean;
  hasDatabase: boolean;
  hasCommon: boolean;
  exportPaths: string[];
  uiSourceEntry: string | null;
  workerSourceEntry: string | null;
  databaseSourceEntry: string | null;
  commonSourceEntry: string | null;
}
/*
function indentMultiline(value: string, indent: number, skipFirst = false): string {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }
  const lines = value.split('\n');
  if (lines.length === 1) {
    return value;
  }
  const indentation = ' '.repeat(indent);
  return lines
    .map((line, index) => (skipFirst && index === 0 ? line : `${indentation}${line}`))
    .join('\n');
}
 */

function sanitizeManifest(
  manifest: any,
  { packageDescription }: { packageDescription?: string } = {},
) {
  if (!manifest || typeof manifest !== 'object') return null;
  const result: Record<string, any> = {};

  const addString = (target: Record<string, any>, key: string, value: unknown) => {
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

  if (!result.description && typeof packageDescription === 'string' && packageDescription.trim().length > 0) {
    result.description = packageDescription.trim();
  }

  if (typeof manifest.priority === 'number' && Number.isFinite(manifest.priority)) {
    result.priority = manifest.priority;
  }

  if (Array.isArray(manifest.dependencies)) {
    result.dependencies = manifest.dependencies.map(String);
  }

  if (manifest.icon && typeof manifest.icon === 'object') {
    const icon: Record<string, any> = {};
    addString(icon, 'muiIconName', manifest.icon.muiIconName);
    addString(icon, 'mui', manifest.icon.mui);
    addString(icon, 'emoji', manifest.icon.emoji);
    addString(icon, 'color', manifest.icon.color);
    if (!icon.muiIconName && icon.mui) {
      icon.muiIconName = icon.mui;
    }
    if (Object.keys(icon).length > 0) {
      result.icon = icon;
    }
  }

  if (typeof manifest.category === 'string') {
    result.category = manifest.category;
  } else if (manifest.category && typeof manifest.category === 'object') {
    const category: Record<string, any> = {};
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
    const schema: Record<string, any> = {};
    addString(schema, 'inherits', manifest.schema.inherits);
    if (Array.isArray(manifest.schema.fields)) {
      schema.fields = manifest.schema.fields
        .filter((field: any) => field && typeof field === 'object')
        .map((field: any) => ({
          name: String(field.name ?? ''),
          type: String(field.type ?? ''),
          required: Boolean(field.required ?? false),
        }));
    }
    if (Object.keys(schema).length > 0) {
      result.schema = schema;
    }
  }

  return result;
}

function sanitizeDependencies(pkgJson: any): string[] {
  if (!pkgJson || typeof pkgJson !== 'object') return [];
  const deps = pkgJson.dependencies ?? {};
  const peerDeps = pkgJson.peerDependencies ?? {};
  return filterValidDependencies([...Object.keys(deps), ...Object.keys(peerDeps)]);
}

function indentJSON(value: unknown, indent: number): string {
  const json = JSON.stringify(value, null, 2);
  if (!json.includes('\n')) return json;
  const indentation = ' '.repeat(indent);
  return json.replace(/\n/g, `\n${indentation}`);
}

function generateRegistrySource(summaries: ManifestSummary[]): string {
  const entries = summaries
    .map((summary) => {
      const version = summary.manifest.version ?? summary.packageVersion;
      const modules: Record<string, { specifier: string; source?: string }> = {
        root: { specifier: summary.packageName },
      };

      if (summary.uiSourceEntry) {
        modules.ui = {
          specifier: `${summary.packageName}/ui`,
          source: summary.uiSourceEntry,
        };
      }

      if (summary.workerSourceEntry) {
        modules.worker = {
          specifier: `${summary.packageName}/worker`,
          source: summary.workerSourceEntry,
        };
      }

      if (summary.databaseSourceEntry) {
        modules.database = {
          specifier: `${summary.packageName}/database`,
          source: summary.databaseSourceEntry,
        };
      }

      if (summary.commonSourceEntry) {
        modules.common = {
          specifier: `${summary.packageName}/common`,
          source: summary.commonSourceEntry,
        };
      }

      const dependenciesJSON = indentJSON(summary.dependencies, 6);
      const manifestJSON = indentJSON(summary.manifest ?? null, 6);
      const modulesJSON = indentJSON(modules, 6);

      return `  {
    nodeType: ${JSON.stringify(summary.nodeType)},
    packageName: ${JSON.stringify(summary.packageName)},
    version: ${JSON.stringify(version)},
    dependencies: ${dependenciesJSON},
    manifest: ${manifestJSON},
    modules: ${modulesJSON}
  },`;
    })
    .join('\n');

  return `/* auto-generated by tools-build-scripts */
import type { PluginRegistryEntry } from '../src/types.ts';

export const pluginRegistry: PluginRegistryEntry[] = [
${entries}
];
`;
}

async function loadAppPackage() {
  const raw = await fs.readFile(appPkgPath, 'utf8');
  return JSON.parse(raw);
}

async function removeLegacyArtifacts(): Promise<void> {
  const legacyPaths = [
    path.join(appDir, 'src', 'generated'),
    path.join(appDir, 'src', 'plugin-registry', 'generated'),
    path.join(repoRoot, 'packages', 'runtime/worker', 'src', 'generated'),
    path.join(repoRoot, 'types', 'generated'),
  ];

  await Promise.all(
    legacyPaths.map(async (legacyPath) => {
      try {
        await fs.rm(legacyPath, { recursive: true, force: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[generate-plugin-loader] failed to remove legacy artefact', legacyPath, message);
      }
    }),
  );
}

async function collectPluginPackages() {
  const pkg = await loadAppPackage();
  const pluginDeps = Object.keys(pkg.dependencies ?? {}).filter((name) => /-plugin$/.test(name));
  return pluginDeps;
}

async function collectManifests(): Promise<ManifestSummary[]> {
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

    const manifest = loadPluginManifestFromFile(manifestPath);
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
    const workerSourceEntry = await findEntryFile(pkgDir, WORKER_ENTRY_BASENAMES);
    const uiSourceEntry = await findEntryFile(pkgDir, UI_ENTRY_BASENAMES);
    const databaseSourceEntry = await findEntryFile(pkgDir, DATABASE_ENTRY_BASENAMES);
    const commonSourceEntry = await findEntryFile(pkgDir, COMMON_ENTRY_BASENAMES);

    const hasWorker = !!workerSourceEntry;
    const hasUI = !!uiSourceEntry;
    const hasDatabase = !!databaseSourceEntry;
    const hasCommon = !!commonSourceEntry;

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

    manifests.push({
      manifest: sanitizedManifest,
      nodeType: sanitizedManifest.nodeType,
      packageName: pkgName,
      packageVersion,
      dependencies,
      hasUI,
      hasWorker,
      hasDatabase,
      hasCommon,
      exportPaths: Array.from(exportPathSet),
      uiSourceEntry,
      workerSourceEntry,
      databaseSourceEntry,
      commonSourceEntry,
    });

  }

  return manifests;
}

async function writeRegistrations(): Promise<void> {
  const summaries = await collectManifests();
  const registrySource = generateRegistrySource(summaries);
  await fs.mkdir(registryGeneratedDir, { recursive: true });
  const registryChanged = await writeFileIfChanged(registryOutputFile, registrySource);
  await removeLegacyArtifacts();

  console.log('[generate-plugin-loader] updated files', {
    registry: registryChanged,
  });
}

await writeRegistrations();
