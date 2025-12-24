/**
 * Script: gen-plugin-registry
 * Purpose: Generate the canonical plugin registry artefact consumed by both the app and
 *          runtime-worker worker. The registry is emitted to `packages/plugin-registry/generated/registry.ts`
 *          and other consumers derive runtime-worker data from that single source.
 * Invocation: executed via `pnpm --filter @hierarchidb/tools-build-scripts run gen-plugin-registry`
 *             (root alias: `pnpm run tools:gen-plugin-registry`).
 * Output: writes `packages/plugin-registry/generated/registry.ts`. Legacy artefacts
 *         under `app/src/generated/*`, `app/src/plugin-registry/generated/*`,
 *         `packages/runtime-worker/worker/src/generated/*`, and `types/generated/*` are removed.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, '..', '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const require = createRequire(import.meta.url);

let loadPluginManifestFromFile: (manifestPath: string) => Promise<any> = async () => undefined;
let manifestLoaderResolved = false;
try {
  ({ loadPluginManifestFromFile } = await import('@hierarchidb/tools-load-plugin-manifest'));
  manifestLoaderResolved = true;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn('[generate-plugin-registry] Failed to load manifest loader via workspace import:', message);
  const fallbackDist = path.join(repoRoot, 'packages', 'tools', 'load-plugin-manifest', 'dist', 'index.js');
  if (await fileExists(fallbackDist)) {
    try {
      ({ loadPluginManifestFromFile } = await import(pathToFileURL(fallbackDist).href));
      manifestLoaderResolved = true;
      console.warn('[generate-plugin-registry] Fallback: loaded manifest loader from local dist build.');
    } catch (fallbackError) {
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.warn('[generate-plugin-registry] Fallback import failed:', fallbackMessage);
    }
  } else {
    console.warn('[generate-plugin-registry] Fallback dist missing at', fallbackDist);
  }
  if (!manifestLoaderResolved) {
    console.warn('[generate-plugin-registry] Continuing without manifest introspection.');
  }
}

const appDir = path.join(repoRoot, 'app');
const appPkgPath = path.join(appDir, 'package.json');
const pluginRegistryPackageDir = path.join(repoRoot, 'packages', 'plugin-registry');
const registryGeneratedDir = path.join(pluginRegistryPackageDir, 'generated');
const registryOutputFile = path.join(registryGeneratedDir, 'registry.ts');
const registryDeclarationsFile = path.join(registryGeneratedDir, 'registry.modules.d.ts');
const registryUiLoadersFile = path.join(registryGeneratedDir, 'ui-loaders.ts');
const registryWorkerLoadersFile = path.join(registryGeneratedDir, 'worker-loaders.ts');
const registryIconLoadersFile = path.join(registryGeneratedDir, 'icon-loaders.ts');
const registryDatabaseLoadersFile = path.join(registryGeneratedDir, 'database-loaders.ts');
const registryPluginDefinitionsFile = path.join(registryGeneratedDir, 'plugin-definitions.ts');
const registryOutputDir = path.dirname(registryOutputFile);
export type PluginSpecifierMode = 'package' | 'dist-url';
let pluginSpecifierMode: PluginSpecifierMode = 'package';
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
  'src/worker/database/index.ts',
  'src/worker/database/index.tsx',
  'src/worker/database/index.mts',
  'src/worker/database/index.mjs',
  'src/worker/database/index.js',
  'src/worker/database/index.cjs',
  'src/worker/database.ts',
  'src/worker/database.mts',
  'src/worker/database.mjs',
  'src/worker/database.js',
  'src/worker/database.cjs',
  'src/database.ts',
  'src/database.mts',
  'src/database.mjs',
  'src/database.js',
  'src/database.cjs',
];
const COMMON_ENTRY_BASENAMES = [
  'src/_obsolate_common/index.ts',
  'src/_obsolate_common/index.tsx',
  'src/_obsolate_common/index.mts',
  'src/_obsolate_common/index.mjs',
  'src/_obsolate_common/index.js',
  'src/_obsolate_common/index.cjs',
  'src/_obsolate_common.ts',
  'src/_obsolate_common.mts',
  'src/_obsolate_common.mjs',
  'src/_obsolate_common.js',
  'src/_obsolate_common.cjs',
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

const ICON_ENTRY_BASENAMES = [
  'src/icon/index.ts',
  'src/icon/index.tsx',
  'src/icon/index.mts',
  'src/icon/index.mjs',
  'src/icon/index.js',
  'src/icon/index.cjs',
  'src/icon.ts',
  'src/icon.tsx',
  'src/icon.mts',
  'src/icon.mjs',
  'src/icon.js',
  'src/icon.cjs',
];

function hasExportPath(paths: string[], target: string): boolean {
  return paths.some((entry) =>
    entry === target || entry === `${target}/index` || entry.startsWith(`${target}/`)
  );
}
const ROOT_DIST_ENTRY_BASENAMES = [
  'dist/index.js',
  'dist/index.mjs',
  'dist/index.cjs',
];
const WORKER_DIST_ENTRY_BASENAMES = [
  'dist/worker/index.js',
  'dist/worker/index.mjs',
  'dist/worker/index.cjs',
  'dist/worker.js',
  'dist/worker.mjs',
  'dist/worker.cjs',
];
const UI_DIST_ENTRY_BASENAMES = [
  'dist/ui/index.js',
  'dist/ui/index.mjs',
  'dist/ui/index.cjs',
  'dist/ui.js',
  'dist/ui.mjs',
  'dist/ui.cjs',
];
const DATABASE_DIST_ENTRY_BASENAMES = [
  'dist/services/database/index.js',
  'dist/services/database/index.mjs',
  'dist/services/database/index.cjs',
  'dist/worker/database/index.js',
  'dist/worker/database/index.mjs',
  'dist/worker/database/index.cjs',
  'dist/database/index.js',
  'dist/database/index.mjs',
  'dist/database/index.cjs',
  'dist/database.js',
  'dist/database.mjs',
  'dist/database.cjs',
];
const COMMON_DIST_ENTRY_BASENAMES = [
  'dist/_obsolate_common/index.js',
  'dist/_obsolate_common/index.mjs',
  'dist/_obsolate_common/index.cjs',
  'dist/shared/index.js',
  'dist/shared/index.mjs',
  'dist/shared/index.cjs',
];
const ICON_DIST_ENTRY_BASENAMES = [
  'dist/icon/index.js',
  'dist/icon/index.mjs',
  'dist/icon/index.cjs',
  'dist/icon.js',
  'dist/icon.mjs',
  'dist/icon.cjs',
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

interface NormalizedDatabasePrewarmEntry {
  export: string;
  specifier?: string;
}

interface DatabasePrewarmTarget {
  exportName: string;
  specifier: string;
}

function normalizeDatabasePrewarmValue(raw: unknown): NormalizedDatabasePrewarmEntry[] {
  const entries: NormalizedDatabasePrewarmEntry[] = [];
  const visit = (value: unknown): void => {
    if (value == null) return;
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        entries.push({ export: trimmed });
      }
      return;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const exportRaw = typeof record.export === 'string'
        ? record.export
        : typeof record.exportName === 'string'
          ? record.exportName
          : typeof record.name === 'string'
            ? record.name
            : null;
      const trimmedExport = exportRaw?.trim();
      if (!trimmedExport) return;
      const specifierRaw = typeof record.specifier === 'string'
        ? record.specifier
        : typeof record.module === 'string'
          ? record.module
          : undefined;
      const trimmedSpecifier = specifierRaw?.trim();
      const entry: NormalizedDatabasePrewarmEntry = { export: trimmedExport };
      if (trimmedSpecifier && trimmedSpecifier.length > 0) {
        entry.specifier = trimmedSpecifier;
      }
      entries.push(entry);
    }
  };
  visit(raw);
  return entries;
}

function buildDatabasePrewarmTargets(
  raw: unknown,
  fallbackSpecifier: string,
): DatabasePrewarmTarget[] {
  const result: DatabasePrewarmTarget[] = [];
  if (!raw) return result;
  const items = Array.isArray(raw) ? raw : [raw];
  for (const item of items) {
    if (!item) continue;
    if (typeof item === 'string') {
      const exportName = item.trim();
      if (!exportName) continue;
      result.push({ exportName, specifier: fallbackSpecifier });
      continue;
    }
    if (typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const exportRaw = typeof record.export === 'string'
        ? record.export
        : typeof record.exportName === 'string'
          ? record.exportName
          : typeof record.name === 'string'
            ? record.name
            : null;
      const exportName = exportRaw?.trim();
      if (!exportName) continue;
      const specifierRaw = typeof record.specifier === 'string'
        ? record.specifier
        : typeof record.module === 'string'
          ? record.module
          : null;
      const specifier = specifierRaw?.trim() || fallbackSpecifier;
      if (!specifier) continue;
      result.push({ exportName, specifier });
    }
  }
  return result;
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
  hasDatabaseModule: boolean;
  hasCommon: boolean;
  exportPaths: string[];
  uiSourceEntry: string | null;
  workerSourceEntry: string | null;
  databaseSourceEntry: string | null;
  commonSourceEntry: string | null;
  rootDistEntry: string | null;
  uiDistEntry: string | null;
  workerDistEntry: string | null;
  databaseDistEntry: string | null;
  commonDistEntry: string | null;
  iconComponent?: {
    specifier: string;
    exportName?: string;
    sourceEntry?: string | null;
    distEntry?: string | null;
  };
  workerPreloadExports: string[];
  databaseModuleSpecifier: string | null;
  databasePrewarmTargets: DatabasePrewarmTarget[];
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

    const componentConfig = manifest.icon.component;
    if (componentConfig && typeof componentConfig === 'object') {
      const specifier = typeof componentConfig.specifier === 'string'
        ? componentConfig.specifier.trim()
        : undefined;
      const exportName = typeof componentConfig.exportName === 'string'
        ? componentConfig.exportName.trim()
        : typeof componentConfig.export === 'string'
          ? componentConfig.export.trim()
          : undefined;
      if (specifier) {
        const component: Record<string, string> = { specifier };
        if (exportName) {
          component.exportName = exportName;
        }
        icon.component = component;
      }
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

  if (manifest.worker && typeof manifest.worker === 'object') {
    const worker: Record<string, any> = {};
    if (Array.isArray(manifest.worker.preload)) {
      const preload = manifest.worker.preload
        .map((value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : null))
        .filter((value: string | null): value is string => value !== null);
      if (preload.length > 0) {
        worker.preload = preload;
      }
    }
    if (Object.keys(worker).length > 0) {
      result.worker = worker;
    }
  }

  if (manifest.database && typeof manifest.database === 'object') {
    const database: Record<string, any> = {};
    addString(database, 'dbName', manifest.database.dbName);
    addString(database, 'tableName', manifest.database.tableName);
    if (typeof manifest.database.version === 'number' && Number.isFinite(manifest.database.version)) {
      database.version = manifest.database.version;
    }
    if (manifest.database.schema && typeof manifest.database.schema === 'object') {
      database.schema = manifest.database.schema;
    }
    const prewarmEntries = normalizeDatabasePrewarmValue(manifest.database.prewarm);
    if (prewarmEntries.length > 0) {
      database.prewarm = prewarmEntries.map((entry) => {
        const normalized: Record<string, string> = { export: entry.export };
        if (entry.specifier) {
          normalized.specifier = entry.specifier;
        }
        return normalized;
      });
    }
    if (Object.keys(database).length > 0) {
      result.database = database;
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

function toRelativeImportPath(entry: string): string {
  const absolute = path.join(repoRoot, entry);
  let relative = path.relative(registryOutputDir, absolute).split(path.sep).join('/');
  if (!relative.startsWith('.')) {
    relative = `./${relative}`;
  }
  return relative;
}

function createDistSpecifierExpression(distEntry: string | null | undefined, fallbackSpecifier: string): string {
  if (!distEntry) {
    return JSON.stringify(fallbackSpecifier);
  }
  const relativePath = toRelativeImportPath(distEntry);
  return `new URL(${JSON.stringify(relativePath)}, import.meta.url).href`;
}

function inferDistEntryForSpecifier(summary: ManifestSummary, specifier: string): string | null {
  if (!specifier || !specifier.startsWith(summary.packageName)) {
    return null;
  }
  const suffix = specifier.slice(summary.packageName.length);
  switch (suffix) {
    case '':
    case '/':
      return summary.rootDistEntry;
    case '/worker':
      return summary.workerDistEntry;
    case '/ui':
      return summary.uiDistEntry;
    case '/database':
      return summary.databaseDistEntry;
    case '/_obsolate_common':
      return summary.commonDistEntry;
    case '/icon':
      return summary.iconComponent?.distEntry ?? null;
    default:
      return null;
  }
}

function resolveSpecifierExpression(_summary: ManifestSummary, fallbackSpecifier: string, distEntry?: string | null): string {
  if (pluginSpecifierMode === 'dist-url') {
    return createDistSpecifierExpression(distEntry ?? null, fallbackSpecifier);
  }
  return JSON.stringify(fallbackSpecifier);
}

function resolveTargetSpecifier(summary: ManifestSummary, specifier: string): string {
  if (pluginSpecifierMode === 'dist-url') {
    const distEntry = inferDistEntryForSpecifier(summary, specifier);
    if (distEntry) {
      return createDistSpecifierExpression(distEntry, specifier);
    }
  }
  return JSON.stringify(specifier);
}

function formatModuleInfo(specifierExpr: string, options: { source?: string | null; exportName?: string } = {}): string {
  const lines: string[] = ['{', `        specifier: ${specifierExpr},`];
  if (options.source) {
    lines.push(`        source: ${JSON.stringify(options.source)},`);
  }
  if (options.exportName) {
    lines.push(`        exportName: ${JSON.stringify(options.exportName)},`);
  }
  lines.push('      }');
  return lines.join('\n');
}

function hasWorkerModule(summary: ManifestSummary): boolean {
  if (!summary.hasWorker) return false;
  if (summary.workerSourceEntry) return true;
  return pluginSpecifierMode === 'dist-url' && Boolean(summary.workerDistEntry);
}

function formatModulesLiteral(summary: ManifestSummary): string {
  const entries: string[] = [];
  const rootSpecifier = resolveSpecifierExpression(summary, summary.packageName, summary.rootDistEntry);
  entries.push(`    root: ${formatModuleInfo(rootSpecifier)}`);

  if (summary.hasUI && (summary.uiSourceEntry || summary.uiDistEntry)) {
    const specExpr = resolveSpecifierExpression(summary, `${summary.packageName}/ui`, summary.uiDistEntry);
    entries.push(`    ui: ${formatModuleInfo(specExpr, { source: summary.uiSourceEntry })}`);
  }

  if (hasWorkerModule(summary)) {
    const specExpr = resolveSpecifierExpression(summary, `${summary.packageName}/worker`, summary.workerDistEntry);
    entries.push(`    worker: ${formatModuleInfo(specExpr, { source: summary.workerSourceEntry })}`);
  }

  if (summary.hasDatabaseModule && (summary.databaseSourceEntry || summary.databaseDistEntry)) {
    const specExpr = resolveSpecifierExpression(summary, `${summary.packageName}/database`, summary.databaseDistEntry);
    entries.push(`    database: ${formatModuleInfo(specExpr, { source: summary.databaseSourceEntry })}`);
  }

  if (summary.commonSourceEntry || summary.commonDistEntry) {
    const specExpr = resolveSpecifierExpression(summary, `${summary.packageName}/common`, summary.commonDistEntry);
    entries.push(`    common: ${formatModuleInfo(specExpr, { source: summary.commonSourceEntry })}`);
  }

  if (summary.iconComponent) {
    const icon = summary.iconComponent;
    const iconSpecExpr = resolveSpecifierExpression(summary, icon.specifier, icon.distEntry ?? null);
    entries.push(`    icon: ${formatModuleInfo(iconSpecExpr, { source: icon.sourceEntry, exportName: icon.exportName })}`);
  }

  return entries.length > 0
    ? `{\n${entries.join(',\n')}\n  }`
    : '{}';
}

function generateRegistrySource(summaries: ManifestSummary[]): string {
  const entries = summaries
    .map((summary) => {
      const version = summary.manifest.version ?? summary.packageVersion;
      const dependenciesJSON = indentJSON(summary.dependencies, 6);
      const manifestJSON = indentJSON(summary.manifest ?? null, 6);
      const modulesLiteral = formatModulesLiteral(summary);

      return `  {
    nodeType: ${JSON.stringify(summary.nodeType)},
    packageName: ${JSON.stringify(summary.packageName)},
    version: ${JSON.stringify(version)},
    dependencies: ${dependenciesJSON},
    exports: ${JSON.stringify(summary.exportPaths)},
    manifest: ${manifestJSON},
    modules: ${modulesLiteral}
  },`;
    })
    .join('\n');

  return `/* auto-generated by tools-build-scripts */
/// <reference path="./registry.modules.d.ts" />
import type { PluginRegistryEntry } from '../src/types.ts';

export const pluginRegistry: PluginRegistryEntry[] = [
${entries}
];
`;
}

function generatePluginDefinitionsSource(): string {
  return `/* auto-generated by tools-build-scripts */
import { pluginRegistry } from './registry.ts';
import { derivePluginDefinitions } from '../src/derivations.ts';
import type { PluginDefinition } from '../src/types.ts';

export const pluginDefinitions: PluginDefinition[] = derivePluginDefinitions(pluginRegistry);
`;
}

function generateUiLoadersSource(summaries: ManifestSummary[]): string {
  const entries = summaries
    .map((summary) => {
      if (!summary.hasUI || (!summary.uiSourceEntry && !summary.uiDistEntry)) {
        return null;
      }
      const specExpr = resolveSpecifierExpression(summary, `${summary.packageName}/ui`, summary.uiDistEntry);
      return `  ${JSON.stringify(summary.nodeType)}: async () => import(${specExpr}),`;
    })
    .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    .join('\n');

  const loaderBody = entries.length > 0 ? `{\n${entries}\n}` : '{}';

  const mapEntries = summaries
    .map((summary) => {
      if (!summary.hasUI || (!summary.uiSourceEntry && !summary.uiDistEntry)) {
        return null;
      }
      const specExpr = resolveSpecifierExpression(summary, `${summary.packageName}/ui`, summary.uiDistEntry);
      return `  ${JSON.stringify(summary.nodeType)}: ${specExpr},`;
    })
    .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    .join('\n');
  const mapBody = mapEntries.length > 0 ? `{\n${mapEntries}\n}` : '{}';
  return `/* auto-generated by tools-build-scripts */
/// <reference path="./registry.modules.d.ts" />

export const pluginUiLoaders: Record<string, () => Promise<unknown>> = ${loaderBody};
export const pluginUiModuleMap: Record<string, string> = ${mapBody};
`;
}

function generateWorkerLoadersSource(summaries: ManifestSummary[]): string {
  const loaderEntries = summaries
    .map((summary) => {
      if (!hasWorkerModule(summary)) {
        return null;
      }
      const specExpr = resolveSpecifierExpression(summary, `${summary.packageName}/worker`, summary.workerDistEntry);
      return `  ${JSON.stringify(summary.nodeType)}: async () => import(${specExpr}),`;
    })
    .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    .join('\n');

  const preloadEntries = summaries
    .map((summary) => {
      if (!hasWorkerModule(summary) || !summary.workerPreloadExports || summary.workerPreloadExports.length === 0) {
        return null;
      }
      const exportsJSON = JSON.stringify(summary.workerPreloadExports);
      return `  ${JSON.stringify(summary.nodeType)}: ${exportsJSON},`;
    })
    .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    .join('\n');

  const loaderBody = loaderEntries.length > 0 ? `{\n${loaderEntries}\n}` : '{}';
  const preloadBody = preloadEntries.length > 0 ? `{\n${preloadEntries}\n}` : '{}';

  return `/* auto-generated by tools-build-scripts */
/// <reference path="./registry.modules.d.ts" />

export const pluginWorkerLoaders: Record<string, () => Promise<unknown>> = ${loaderBody};
export const pluginWorkerPreloads: Record<string, string[]> = ${preloadBody};
`;
}

function generateIconLoadersSource(summaries: ManifestSummary[]): string {
  const iconLoaderEntries = summaries
    .map((summary) => {
      const component = summary.iconComponent;
      if (!component) return null;
      const lines: string[] = [];
      lines.push(`  ${JSON.stringify(summary.nodeType)}: async () => {`);
      lines.push(`    const mod = await import('${component.specifier}');`);
      if (component.exportName) {
        lines.push(`    const componentExport = (mod as Record<string, unknown>)[${JSON.stringify(component.exportName)}];`);
        lines.push(`    if (!componentExport) { throw new Error('Plugin icon component export not found for ${summary.nodeType}'); }`);
        lines.push('    return componentExport;');
      } else {
        lines.push('    const resolved = (mod as { default?: unknown }).default ?? mod;');
        lines.push(`    if (!resolved) { throw new Error('Plugin icon component default export not found for ${summary.nodeType}'); }`);
        lines.push('    return resolved;');
      }
      lines.push('  },');
      return lines.join('\n');
    })
    .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    .join('\n');

  const loaderBody = iconLoaderEntries.length > 0 ? `{\n${iconLoaderEntries}\n}` : '{}';
  return `/* auto-generated by tools-build-scripts */
/// <reference path="./registry.modules.d.ts" />

export const pluginIconLoaders: Record<string, () => Promise<unknown>> = ${loaderBody};
`;
}

function generateDatabaseLoadersSource(summaries: ManifestSummary[]): string {
  const databaseLoaderEntries = summaries
    .map((summary) => {
      const moduleSpecifier = summary.databaseModuleSpecifier;
      const hasLoader =
        summary.hasDatabaseModule && typeof moduleSpecifier === 'string' && moduleSpecifier.length > 0;
      const hasPrewarm =
        summary.hasDatabaseModule && summary.databasePrewarmTargets.length > 0;
      if (!hasLoader && !hasPrewarm) {
        return null;
      }
      const lines: string[] = [];
      lines.push(`  ${JSON.stringify(summary.nodeType)}: {`);
      if (hasLoader) {
        const moduleSpecifierExpr = resolveSpecifierExpression(summary, moduleSpecifier, summary.databaseDistEntry);
        lines.push(`    moduleSpecifier: ${moduleSpecifierExpr},`);
        lines.push('    async loader() {');
        lines.push(`      const mod = await import(${moduleSpecifierExpr});`);
        lines.push('      return mod;');
        lines.push('    },');
      }
      if (hasPrewarm) {
        lines.push('    prewarm: [');
        for (const target of summary.databasePrewarmTargets) {
          const targetSpecifierExpr = resolveTargetSpecifier(summary, target.specifier);
          lines.push('      {');
          lines.push(`        specifier: ${targetSpecifierExpr},`);
          lines.push(`        exportName: ${JSON.stringify(target.exportName)},`);
          lines.push('        async load() {');
          lines.push(`          const mod = await import(${targetSpecifierExpr});`);
          lines.push('          return mod;');
          lines.push('        },');
          lines.push('      },');
        }
        lines.push('    ],');
      }
      lines.push('  },');
      return lines.join('\n');
    })
    .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    .join('\n');

  const loaderBody = databaseLoaderEntries.length > 0
    ? `{\n${databaseLoaderEntries}\n}`
    : '{}';
  return `/* auto-generated by tools-build-scripts */
/// <reference path="./registry.modules.d.ts" />

export const pluginDatabaseLoaders: Record<string, { moduleSpecifier?: string; loader?: () => Promise<unknown>; prewarm?: { specifier?: string; exportName: string; load: () => Promise<unknown> }[] }> = ${loaderBody};
`;
}

function validateEntryPaths(summaries: ManifestSummary[], mode: PluginSpecifierMode): void {
  const issues: string[] = [];

  for (const summary of summaries) {
    const exportPaths = summary.exportPaths;
    const uiExported = hasExportPath(exportPaths, 'ui');
    const workerExported = hasExportPath(exportPaths, 'worker');
    const databaseExported =
      hasExportPath(exportPaths, 'database') || hasExportPath(exportPaths, 'worker/database');

    const hasUiEntry = Boolean(summary.uiSourceEntry || summary.uiDistEntry);
    const hasWorkerEntry = Boolean(summary.workerSourceEntry || summary.workerDistEntry);
    const hasDatabaseEntry = Boolean(summary.databaseSourceEntry || summary.databaseDistEntry);

    if (uiExported && !hasUiEntry) {
      issues.push(`${summary.nodeType}: export "ui" declared but entry file not found.`);
    }
    if (workerExported && !hasWorkerEntry) {
      issues.push(`${summary.nodeType}: export "worker" declared but entry file not found.`);
    }
    if (databaseExported && !hasDatabaseEntry) {
      issues.push(`${summary.nodeType}: export "database" declared but entry file not found.`);
    }

    if (mode === 'package') {
      if (hasUiEntry && !uiExported) {
        issues.push(`${summary.nodeType}: UI entry exists but package export "ui" is missing.`);
      }
      if (hasWorkerEntry && !workerExported) {
        issues.push(`${summary.nodeType}: worker entry exists but package export "worker" is missing.`);
      }
      if (hasDatabaseEntry && !databaseExported) {
        issues.push(`${summary.nodeType}: database entry exists but package export "database" is missing.`);
      }

      const iconSpecifier = summary.iconComponent?.specifier ?? '';
      if (iconSpecifier.startsWith(summary.packageName) && !hasExportPath(exportPaths, 'icon')) {
        issues.push(`${summary.nodeType}: icon specifier points into package but export "icon" is missing.`);
      }
    }
  }

  if (issues.length > 0) {
    console.warn('[generate-plugin-registry] Entry path validation warnings:\n- ' + issues.join('\n- '));
  }
}

function generateModuleDeclarationSource(summaries: ManifestSummary[]): string {
  const seen = new Set<string>();
  const lines: string[] = ['/* auto-generated by tools-build-scripts */', ''];

  const isValidIdentifier = (value: string): boolean => /^[$A-Z_][0-9A-Z_$]*$/i.test(value);

  for (const summary of summaries) {
    const icon = summary.iconComponent;
    if (icon && !seen.has(icon.specifier)) {
      seen.add(icon.specifier);
      lines.push(`declare module '${icon.specifier}' {`);
      if (icon.exportName && isValidIdentifier(icon.exportName)) {
        lines.push(`  export const ${icon.exportName}: unknown;`);
        lines.push(`  export default ${icon.exportName};`);
      } else {
        lines.push('  const PluginIconComponent: unknown;');
        lines.push('  export default PluginIconComponent;');
      }
      lines.push('}');
      lines.push('');
    }

    const databaseSpecifier = summary.databaseModuleSpecifier;
    if (databaseSpecifier) {
      const scopeTrimmed = databaseSpecifier.replace(/^@[^/]+\//, '');
      const hasSubpath = scopeTrimmed.includes('/');
      if (hasSubpath && !seen.has(databaseSpecifier)) {
        seen.add(databaseSpecifier);
        lines.push(`declare module '${databaseSpecifier}' {`);
        for (const target of summary.databasePrewarmTargets) {
          if (target.exportName && isValidIdentifier(target.exportName)) {
            lines.push(`  export const ${target.exportName}: unknown;`);
          }
        }
        lines.push('  const mod: Record<string, unknown>;');
        lines.push('  export default mod;');
        lines.push('}');
        lines.push('');
      }
    }
  }

  if (lines.length <= 2) {
    return '';
  }

  return `${lines.join('\n')}`.trimEnd() + '\n';
}

async function loadAppPackage() {
  const raw = await fs.readFile(appPkgPath, 'utf8');
  return JSON.parse(raw);
}

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

async function loadJsonIfExists(filePath: string): Promise<Record<string, any> | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function removeLegacyArtifacts(): Promise<void> {
  const legacyPaths = [
    path.join(appDir, 'src', 'generated'),
    path.join(appDir, 'src', 'plugin-registry', 'generated'),
    path.join(repoRoot, 'packages', 'runtime-worker/worker', 'src', 'generated'),
    path.join(repoRoot, 'types', 'generated'),
  ];

  await Promise.all(
    legacyPaths.map(async (legacyPath) => {
      try {
        await fs.rm(legacyPath, { recursive: true, force: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[generate-plugin-registry] failed to remove legacy artefact', legacyPath, message);
      }
    }),
  );
}

async function collectPluginPackages() {
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

    const hasWorkerEntry = pluginSpecifierMode === 'dist-url'
      ? Boolean(workerSourceEntry || workerDistEntry)
      : Boolean(workerSourceEntry);
    const hasUiEntry = pluginSpecifierMode === 'dist-url'
      ? Boolean(uiSourceEntry || uiDistEntry)
      : Boolean(uiSourceEntry);
    const hasDatabaseEntry = pluginSpecifierMode === 'dist-url'
      ? Boolean(databaseSourceEntry || databaseDistEntry)
      : Boolean(databaseSourceEntry);
    const hasIconEntry = pluginSpecifierMode === 'dist-url'
      ? Boolean(iconSourceEntry || iconDistEntry)
      : Boolean(iconSourceEntry);
    const hasCommon = !!commonSourceEntry;

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

export type GeneratePluginRegistryOptions = {
  mode?: PluginSpecifierMode;
};

export async function generatePluginRegistry(options: GeneratePluginRegistryOptions = {}): Promise<void> {
  const requestedMode = (options.mode ?? (process.env.HDB_PLUGIN_SPEC_MODE as PluginSpecifierMode | undefined) ?? 'package')
    .toLowerCase() as PluginSpecifierMode;
  pluginSpecifierMode = requestedMode;
  const summaries = await collectManifests();
  validateEntryPaths(summaries, pluginSpecifierMode);
  const registrySource = generateRegistrySource(summaries);
  const declarationSource = generateModuleDeclarationSource(summaries);
  const uiLoadersSource = generateUiLoadersSource(summaries);
  const workerLoadersSource = generateWorkerLoadersSource(summaries);
  const iconLoadersSource = generateIconLoadersSource(summaries);
  const databaseLoadersSource = generateDatabaseLoadersSource(summaries);
  const pluginDefinitionsSource = generatePluginDefinitionsSource();
  await fs.mkdir(registryGeneratedDir, { recursive: true });
  const registryChanged = await writeFileIfChanged(registryOutputFile, registrySource);
  const declarationsChanged = await writeFileIfChanged(registryDeclarationsFile, declarationSource);
  const uiLoadersChanged = await writeFileIfChanged(registryUiLoadersFile, uiLoadersSource);
  const workerLoadersChanged = await writeFileIfChanged(registryWorkerLoadersFile, workerLoadersSource);
  const iconLoadersChanged = await writeFileIfChanged(registryIconLoadersFile, iconLoadersSource);
  const databaseLoadersChanged = await writeFileIfChanged(registryDatabaseLoadersFile, databaseLoadersSource);
  const pluginDefinitionsChanged = await writeFileIfChanged(
    registryPluginDefinitionsFile,
    pluginDefinitionsSource
  );
  await removeLegacyArtifacts();

  console.log('[generate-plugin-registry] updated files', {
    registry: registryChanged,
    declarations: declarationsChanged,
    uiLoaders: uiLoadersChanged,
    workerLoaders: workerLoadersChanged,
    iconLoaders: iconLoadersChanged,
    databaseLoaders: databaseLoadersChanged,
    pluginDefinitions: pluginDefinitionsChanged,
  });

}

if (import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href) {
  await generatePluginRegistry();
}
