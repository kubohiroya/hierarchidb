/**
 * Script: gen-plugin-loaders
 * Purpose: Generate static worker/UI plugin loader shims and plugin-registry metadata
 *          so the app and registry packages have up-to-date imports.
 * Invocation: executed via `pnpm --filter @hierarchidb/tools-dev-scripts run gen-plugin-loaders`
 *             (root alias: `pnpm run tools:gen-plugin-loaders`).
 * Output: overwrites `app/src/generated/{worker-loader.ts, ui-loader.ts}` and updates
 *         `app/src/plugin-registry/generated` artefacts.
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
const outDir = path.join(appDir, 'src', 'generated');
const outWorkerFile = path.join(outDir, 'worker-loader.ts');
const outUiFile = path.join(outDir, 'ui-loader.ts');
const outMuiIconFile = path.join(outDir, 'mui-icon-loader.ts');
const appPluginRegistryDir = path.join(repoRoot, 'app', 'src', 'plugin-registry');
const registryGeneratedDir = path.join(appPluginRegistryDir, 'generated');
const registryIndexFile = path.join(registryGeneratedDir, 'index.ts');
const ambientModulesFile = path.join(repoRoot, 'types', 'generated', 'plugin-modules.d.ts');
const runtimeWorkerAmbientFile = path.join(repoRoot, 'types', 'generated', 'runtime-worker.d.ts');
const runtimeWorkerMetadataFile = path.join(
  repoRoot,
  'packages',
  'runtime/worker',
  'src',
  'generated',
  'plugin-metadata.ts',
);

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

function toArrayLiteral(values: string[]): string {
  if (!values || values.length === 0) {
    return '[]';
  }
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

function formatPluginDefinitions(summaries: ManifestSummary[]): string {
  return summaries
    .map((summary) => {
      const nodeType = summary.nodeType;
      const name = summary.manifest.name ?? summary.packageName;
      const displayName = summary.manifest.displayName ?? capitalize(nodeType);
      const version = summary.manifest.version ?? summary.packageVersion;
      const priority =
        typeof summary.manifest.priority === 'number' && Number.isFinite(summary.manifest.priority)
          ? summary.manifest.priority
          : 0;
      return `  {\n    nodeType: ${JSON.stringify(nodeType)},\n    name: ${JSON.stringify(name)},\n    packageName: ${JSON.stringify(summary.packageName)},\n    version: ${JSON.stringify(version)},\n    displayName: ${JSON.stringify(displayName)},\n    priority: ${priority},\n    dependencies: ${toArrayLiteral(summary.dependencies)}\n  },`;
    })
    .join('\n');
}

function formatPluginRegistryEntries(summaries: ManifestSummary[]): string {
  return summaries
    .map((summary) => {
      const version = summary.manifest.version ?? summary.packageVersion;
      const manifestJSON = JSON.stringify(summary.manifest ?? null);
      return `  {\n    nodeType: ${JSON.stringify(summary.nodeType)},\n    packageName: ${JSON.stringify(summary.packageName)},\n    version: ${JSON.stringify(version)},\n    hasUI: ${summary.hasUI},\n    hasWorker: ${summary.hasWorker},\n    hasDatabase: ${summary.hasDatabase},\n    hasCommon: ${summary.hasCommon},\n    dependencies: ${toArrayLiteral(summary.dependencies)},\n    manifest: ${manifestJSON}\n  },`;
    })
    .join('\n');
}

function formatUiMapEntries(summaries: ManifestSummary[]): string {
  return summaries
    .filter((summary) => summary.hasUI)
    .map((summary) => `  ${JSON.stringify(summary.nodeType)}: () => import('${summary.packageName}/ui'),`)
    .join('\n');
}

function formatWorkerMapEntries(summaries: ManifestSummary[]): string {
  return summaries
    .filter((summary) => summary.hasWorker)
    .map(
      (summary) =>
        `  ${JSON.stringify(summary.nodeType)}: () => import('${summary.packageName}/worker') as Promise<typeof import('${summary.packageName}/worker')>,`,
    )
    .join('\n');
}

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

async function loadAppPackage() {
  const raw = await fs.readFile(appPkgPath, 'utf8');
  return JSON.parse(raw);
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
    const hasUI = await fileExists(path.join(pkgDir, 'src', 'ui'));
    const hasWorker = await fileExists(path.join(pkgDir, 'src', 'worker'));
    const hasCommon = await fileExists(path.join(pkgDir, 'src', 'common'));
    const hasDatabase =
      (await fileExists(path.join(pkgDir, 'src', 'database')))
      || (await fileExists(path.join(pkgDir, 'src', 'common', 'database')))
      || (await fileExists(path.join(pkgDir, 'src', 'worker', 'database')));

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
    });

  }

  return manifests;
}

function generateWorkerLoader(summaries: ManifestSummary[]): string {
  const registrations = summaries
    .filter((summary) => summary.hasWorker)
    .map((summary) => {
      const nodeType = summary.nodeType;
      const pkgName = summary.packageName;
      if (!nodeType || !pkgName) return null;
      return `  { nodeType: '${nodeType}', loader: () => import('${pkgName}/worker') as Promise<typeof import('${pkgName}/worker')> },`;
    })
    .filter(Boolean)
    .join('\n');

  return `/* auto-generated by tools-dev-scripts */
export const workerPluginLoaders = [
${registrations}
];
`;
}

function generateUiLoader(summaries: ManifestSummary[]): string {
  const registrations = summaries
    .filter((summary) => summary.hasUI)
    .map((summary) => {
      const nodeType = summary.nodeType;
      const pkgName = summary.packageName;
      if (!nodeType || !pkgName) return null;
      return `  { nodeType: '${nodeType}', loader: () => import('${pkgName}/ui') },`;
    })
    .filter(Boolean)
    .join('\n');

  return `/* auto-generated by tools-dev-scripts */
export const uiPluginLoaders = [
${registrations}
];
`;
}

function generateMuiIconLoader(summaries: ManifestSummary[]): string {
  const iconImports = summaries
    .map((summary) => {
      const iconName = normalizeMuiIconName(summary.manifest.icon?.muiIconName ?? summary.manifest.icon?.mui);
      if (!iconName) return null;
      const nodeType = summary.nodeType;
      if (!nodeType) return null;
      return `  '${nodeType}': () => import('@mui/icons-material/${iconName}')`;
    })
    .filter(Boolean)
    .join(',\n');

  return `/* auto-generated by tools-dev-scripts */
export const muiIconLoaders: Record<string, () => Promise<unknown>> = {
${iconImports}
};
`;
}

function generateRegistryIndex(summaries: ManifestSummary[]): string {
  const definitions = formatPluginDefinitions(summaries);
  const registryEntries = formatPluginRegistryEntries(summaries);
  const uiMapEntries = formatUiMapEntries(summaries);
  const workerMapEntries = formatWorkerMapEntries(summaries);
  return `/* auto-generated by tools-dev-scripts */
export const pluginDefinitions = [
${definitions}
];

export const pluginRegistry = [
${registryEntries}
];

export const pluginMapUI = {
${uiMapEntries}
};

export const pluginMapWorker = {
${workerMapEntries}
};
`;
}

function generateAmbientModuleDeclarations(summaries: ManifestSummary[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const summary of summaries) {
    const exports = summary.exportPaths.length > 0 ? summary.exportPaths : [''];
    for (const exportPath of exports) {
      const moduleName = exportPath ? `${summary.packageName}/${exportPath}` : summary.packageName;
      if (!seen.has(moduleName)) {
        seen.add(moduleName);
        lines.push(`declare module '${moduleName}';`);
      }
    }
  }

  return `// AUTO-GENERATED FILE. DO NOT EDIT.\n// Generated by scripts/generate-plugin-loader.mjs\n${lines.join('\n')}\n`;
}

function generateRuntimeWorkerAmbientDeclarations(summaries: ManifestSummary[]): string {
  const lines: string[] = [];
  for (const summary of summaries) {
    if (summary.exportPaths.includes('worker')) {
      lines.push(`export * from '${summary.packageName}/worker';`);
    }
  }

  return `// AUTO-GENERATED FILE. DO NOT EDIT.\n// Generated by scripts/generate-plugin-loader.mjs\n${lines.join('\n')}\n`;
}

function generateRuntimeWorkerMetadata(summaries: ManifestSummary[]): string {
  const registryEntries = formatPluginRegistryEntries(summaries);
  const workerMapEntries = formatWorkerMapEntries(summaries);

  return `/* auto-generated by tools-dev-scripts */
export interface PluginIconConfig {
  muiIconName?: string;
  mui?: string;
  emoji?: string;
  color?: string;
}

export type PluginCategoryConfig =
  | string
  | null
  | {
      menuGroup?: string;
      createOrder?: number;
      treeId?: string;
    };

export interface PluginManifest {
  id?: string;
  name?: string;
  displayName?: string;
  nodeType?: string;
  version?: string;
  description?: string;
  priority?: number;
  extends?: string;
  dependencies?: string[];
  icon?: PluginIconConfig;
  category?: PluginCategoryConfig;
  schema?: Record<string, unknown>;
  capabilities?: Record<string, boolean | undefined>;
}

export interface PluginRegistryEntry {
  nodeType: string;
  packageName: string;
  version: string;
  hasUI: boolean;
  hasWorker: boolean;
  hasDatabase: boolean;
  hasCommon: boolean;
  dependencies: string[];
  manifest: PluginManifest | null;
}

export const pluginRegistry: PluginRegistryEntry[] = [
${registryEntries}
];

export const pluginMapWorker: Record<string, () => Promise<unknown>> = {
${workerMapEntries}
};
`;
}

async function writeRegistrations(): Promise<void> {
  const summaries = await collectManifests();
  const workerLoader = generateWorkerLoader(summaries);
  const uiLoader = generateUiLoader(summaries);
  const muiIconLoader = generateMuiIconLoader(summaries);
  const registryIndex = generateRegistryIndex(summaries);
  const ambientDeclarations = generateAmbientModuleDeclarations(summaries);
  const runtimeWorkerAmbient = generateRuntimeWorkerAmbientDeclarations(summaries);
  const runtimeMetadata = generateRuntimeWorkerMetadata(summaries);

  const workerChanged = await writeFileIfChanged(outWorkerFile, workerLoader);
  const uiChanged = await writeFileIfChanged(outUiFile, uiLoader);
  const muiChanged = await writeFileIfChanged(outMuiIconFile, muiIconLoader);
  const registryChanged = await writeFileIfChanged(registryIndexFile, registryIndex);
  const ambientChanged = await writeFileIfChanged(ambientModulesFile, ambientDeclarations);
  const runtimeWorkerAmbientChanged = await writeFileIfChanged(runtimeWorkerAmbientFile, runtimeWorkerAmbient);
  const runtimeMetadataChanged = await writeFileIfChanged(runtimeWorkerMetadataFile, runtimeMetadata);

  console.log('[generate-plugin-loader] updated files', {
    worker: workerChanged,
    ui: uiChanged,
    mui: muiChanged,
    registry: registryChanged,
    ambient: ambientChanged,
    runtimeWorkerAmbient: runtimeWorkerAmbientChanged,
    runtimeMetadata: runtimeMetadataChanged,
  });
}

await writeRegistrations();
