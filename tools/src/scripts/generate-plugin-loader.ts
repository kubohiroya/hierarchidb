/**
 * Script: generate-plugin-loader
 * Purpose: Generate static worker/UI plugin loader shims and plugin-registry metadata
 *          so the app and registry packages have up-to-date imports.
 * Invocation: executed via `pnpm --dir tools run generate-plugin-loader` (and aliased from root scripts).
 * Output: overwrites `app/src/generated/{worker-loader.ts, ui-loader.ts}` and updates
 *         `packages/plugin-registry/src/generated` artifacts.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd(), '..');
const require = createRequire(import.meta.url);
const manifestLoaderPath = pathToFileURL(path.join(repoRoot, 'tools', 'plugin-manifest-loader.js')).href;
let loadPluginManifestFromFile: (manifestPath: string) => any = () => undefined;
try {
  ({ loadPluginManifestFromFile } = await import(manifestLoaderPath));
} catch (error) {
  console.warn('[generate-plugin-loader] Failed to load manifest loader:', error?.message ?? error);
  console.warn('[generate-plugin-loader] Continuing without manifest introspection.');
}
const appDir = path.join(repoRoot, 'app');
const appPkgPath = path.join(appDir, 'package.json');
const outDir = path.join(appDir, 'src', 'generated');
const outWorkerFile = path.join(outDir, 'worker-loader.ts');
const outUiFile = path.join(outDir, 'ui-loader.ts');
const registrySrcDir = path.join(repoRoot, 'packages', 'plugin-registry', 'src');
const registryGeneratedDir = path.join(registrySrcDir, 'generated');
const registryIndexFile = path.join(registryGeneratedDir, 'index.ts');
const runtimeWorkerTypesFile = path.join(registryGeneratedDir, 'runtime-worker.d.ts');

function deriveNodeType(pkgName: string): string | undefined {
  const match = pkgName.match(/@hierarchidb\/([a-z0-9-]+)-plugin$/);
  return match?.[1];
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
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

function normalizeDependency(spec: unknown): string | null {
  if (typeof spec !== 'string') return null;
  const trimmed = spec.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^@hierarchidb\/([a-z0-9-]+)-plugin$/i);
  return match ? match[1] : trimmed;
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
          required: Boolean(field.required),
        }))
        .filter((field: { name: string; type: string }) => field.name.trim().length > 0 && field.type.trim().length > 0);
    }
    if (Object.keys(schema).length > 0) {
      result.schema = schema;
    }
  }

  if (manifest.capabilities && typeof manifest.capabilities === 'object') {
    result.capabilities = manifest.capabilities;
  }
  if (manifest.database && typeof manifest.database === 'object') {
    result.database = manifest.database;
  }
  if (manifest.ui && typeof manifest.ui === 'object') {
    result.ui = manifest.ui;
  }
  if (manifest.api && typeof manifest.api === 'object') {
    result.api = manifest.api;
  }
  if (manifest.validation && typeof manifest.validation === 'object') {
    result.validation = manifest.validation;
  }
  if (manifest.extra && typeof manifest.extra === 'object') {
    result.extra = manifest.extra;
  }
  if (manifest.entityHints && typeof manifest.entityHints === 'object') {
    result.entityHints = manifest.entityHints;
  }

  return result;
}

async function loadPluginManifest(pluginDir: string | undefined) {
  if (!pluginDir) return null;
  const manifestPath = path.join(pluginDir, 'plugin-manifest.json');
  if (!(await fileExists(manifestPath))) return null;
  try {
    const manifest = loadPluginManifestFromFile(manifestPath);
    if (!manifest) return null;
    return sanitizeManifest(manifest);
  } catch (error) {
    console.warn('[generate-plugin-loader] Failed to parse manifest %s: %o', manifestPath, error);
    return null;
  }
}

async function readWorkspacePackages() {
  const appPkg = JSON.parse(await fs.readFile(appPkgPath, 'utf8'));
  const dependencies = Object.assign({}, appPkg.dependencies, appPkg.devDependencies);
  const pluginEntries = Object.entries(dependencies).filter(([name]) => /@hierarchidb\/([a-z0-9-]+)-plugin$/i.test(name));
  const packages: Array<{ pkgName: string; manifest: any; manifestMeta: { packageDescription?: string }; pkgJson: any }> = [];

  for (const [pkgName] of pluginEntries) {
    const nodeType = deriveNodeType(pkgName);
    if (!nodeType) continue;
    const { json: pkgJson, dir } = await readPluginPackageJSON(pkgName, nodeType);
    if (!pkgJson || !dir) continue;
    const manifest = await loadPluginManifest(dir);
    packages.push({ pkgName, manifest, manifestMeta: { packageDescription: pkgJson.description }, pkgJson });
  }

  return packages;
}

function createLoaderEntries(packages: Array<{ pkgName: string; manifest: any }>) {
  const workerEntries: string[] = [];
  const uiEntries: string[] = [];
  const registryEntries: string[] = [];

  for (const { pkgName, manifest } of packages) {
    const nodeType = deriveNodeType(pkgName);
    if (!nodeType) continue;
    const className = `${capitalize(nodeType)}Plugin`;

    workerEntries.push(`import { register${className}Worker } from '${pkgName}/worker';
register${className}Worker();`);
    uiEntries.push(`import { register${className}UI } from '${pkgName}';
register${className}UI();`);

    registryEntries.push(`  {
    nodeType: '${nodeType}',
    packageName: '${pkgName}',
    version: '${manifest?.version ?? '0.0.0'}',
    hasUI: true,
    hasWorker: true,
    hasDatabase: ${Boolean(manifest?.database)},
    hasCommon: true,
    dependencies: ${JSON.stringify((manifest?.dependencies || []).map(normalizeDependency).filter(Boolean))},
    manifest: ${JSON.stringify(manifest ?? null)},
  },`);
  }

  return { workerEntries, uiEntries, registryEntries };
}

async function buildRuntimeWorkerTypes(packages: Array<{ pkgName: string }>) {
  const lines = packages.map(({ pkgName }) => `export * from '${pkgName}/worker';`);
  return lines.length ? `${lines.join('\n')}
` : '';
}

async function main() {
  const packages = await readWorkspacePackages();
  const { workerEntries, uiEntries, registryEntries } = createLoaderEntries(packages);
  const runtimeTypesContent = await buildRuntimeWorkerTypes(packages);

  const workerContent = `${workerEntries.join('\n\n')}
`;
  const uiContent = `${uiEntries.join('\n\n')}
`;
  const registryIndexContent = `export const pluginRegistry = [
${registryEntries.join('\n')}
];
`;

  const writes: Array<{ file: string; changed: boolean }> = [];
  writes.push({ file: outWorkerFile, changed: await writeFileIfChanged(outWorkerFile, workerContent) });
  writes.push({ file: outUiFile, changed: await writeFileIfChanged(outUiFile, uiContent) });
  writes.push({ file: registryIndexFile, changed: await writeFileIfChanged(registryIndexFile, registryIndexContent) });
  if (runtimeTypesContent) {
    writes.push({ file: runtimeWorkerTypesFile, changed: await writeFileIfChanged(runtimeWorkerTypesFile, runtimeTypesContent) });
  }

  for (const entry of writes) {
    const status = entry.changed ? 'updated' : 'unchanged';
    console.log(`[generate-plugin-loader] ${status}: ${path.relative(repoRoot, entry.file)}`);
  }
}

await main();
