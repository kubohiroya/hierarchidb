#!/usr/bin/env node
/**
 * rename-plugin-worker-exports.mjs
 *
 * Canonical plugin worker exports become `@hierarchidb/<plugin>/worker`.
 * Legacy paths (`worker-factory`, `worker-deprecated`) are removed.
 *
 * Run with: node scripts/codemods/rename-plugin-worker-exports.mjs
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globby } from 'globby';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const pluginsDir = path.join(repoRoot, 'plugins');

function asRecord(value) {
  return value && typeof value === 'object' ? value : {};
}

function jsonEquals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function uniqueStrings(arr) {
  return Array.from(new Set(arr));
}

function replaceFactorySegments(value) {
  if (typeof value === 'string') {
    return value
      .replace(/worker-factory/g, 'worker')
      .replace(/worker-deprecated/g, 'worker');
  }
  if (Array.isArray(value)) {
    return value.map((entry) => replaceFactorySegments(entry));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = replaceFactorySegments(entry);
    }
    return out;
  }
  return value;
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function updatePackageJson(pluginName) {
  const pkgPath = path.join(pluginsDir, pluginName, 'package.json');
  let raw;
  try {
    raw = await fs.readFile(pkgPath, 'utf8');
  } catch {
    return;
  }
  const pkg = JSON.parse(raw);
  const exportsField = asRecord(pkg.exports);
  const factoryExport = exportsField['./worker-factory'];
  const workerExport = exportsField['./worker'];
  const canonicalExport = factoryExport !== undefined ? factoryExport : workerExport;
  if (canonicalExport === undefined) {
    console.warn(`[skip] ${pluginName}: no ./worker or ./worker-factory export found`);
    return;
  }

  const newExports = {};
  if (exportsField['.'] !== undefined) {
    newExports['.'] = exportsField['.'];
  }
  newExports['./worker'] = replaceFactorySegments(canonicalExport);
  for (const [key, value] of Object.entries(exportsField)) {
    if (['.', './worker', './worker-factory', './worker-deprecated'].includes(key)) {
      continue;
    }
    newExports[key] = value;
  }
  pkg.exports = newExports;

  const typesVersions = asRecord(pkg.typesVersions);
  if (Object.keys(typesVersions).length > 0) {
    const starVersions = asRecord(typesVersions['*']);
    const newStar = {};
    for (const [key, value] of Object.entries(starVersions)) {
      if (key === 'worker' || key === 'worker-factory' || key === 'worker-deprecated') {
        continue;
      }
      newStar[key] = value;
    }
    const workerEntry =
      starVersions['worker-factory'] !== undefined
        ? starVersions['worker-factory']
        : starVersions['worker'];
    if (workerEntry !== undefined) {
      newStar['worker'] = replaceFactorySegments(workerEntry);
    }
    typesVersions['*'] = newStar;
    pkg.typesVersions = typesVersions;
  }

  if (!jsonEquals(JSON.parse(raw), pkg)) {
    await writeJson(pkgPath, pkg);
  }
}

async function updateTsupConfig(pluginName) {
  const configPath = path.join(pluginsDir, pluginName, 'tsup.config.ts');
  let content;
  try {
    content = await fs.readFile(configPath, 'utf8');
  } catch {
    return;
  }

  const workerFactoryEntryPattern =
    /\n\s*['"]worker-factory\/index['"]:\s*['"][^'"]+['"],?/g;
  const workerDeprecatedEntryPattern =
    /\n\s*['"]worker-deprecated\/index['"]:\s*['"][^'"]+['"],?/g;
  const workerEntryPattern =
    /(['"]worker\/index['"]:\s*)(['"])src\/worker\/index\.ts(\2)(,?)/g;

  let updated = content.replace(workerFactoryEntryPattern, '');
  updated = updated.replace(workerDeprecatedEntryPattern, '');
  updated = updated.replace(
    workerEntryPattern,
    (_match, prefix, quote, _closingQuote, trailingComma) =>
      `${prefix}${quote}src/worker/factory/index.ts${quote}${trailingComma}`,
  );
  updated = updated.replace(
    /,([ \t]*)['"]worker\/index/g,
    (_match, whitespace) => `,\n${whitespace}'worker/index`,
  );

  if (updated !== content) {
    await fs.writeFile(configPath, updated, 'utf8');
  }
}

async function updateTsconfigBase() {
  const tsconfigPath = path.join(repoRoot, 'tsconfig.base.json');
  let raw;
  try {
    raw = await fs.readFile(tsconfigPath, 'utf8');
  } catch {
    return;
  }
  const config = JSON.parse(raw);
  const compilerOptions = asRecord(config.compilerOptions);
  const paths = asRecord(compilerOptions.paths);
  const legacyKey = '@hierarchidb/*-plugin/worker-factory';
  const deprecatedKey = '@hierarchidb/*-plugin/worker-deprecated';
  const existingLegacyPaths = paths[legacyKey];

  const newPaths = {};
  let updated = false;
  for (const [key, value] of Object.entries(paths)) {
    if (key === legacyKey) {
      const canonicalPaths = uniqueStrings(
        (value || []).map((entry) =>
          typeof entry === 'string'
            ? entry.replace('/src/worker-factory/', '/src/worker/factory/')
            : entry,
        ),
      );
      newPaths['@hierarchidb/*-plugin/worker'] = canonicalPaths;
      updated = true;
      continue;
    }
    if (key === deprecatedKey) {
      updated = true;
      continue;
    }
    newPaths[key] = value;
  }

  if (!existingLegacyPaths && paths['@hierarchidb/*-plugin/worker']) {
    newPaths['@hierarchidb/*-plugin/worker'] = paths['@hierarchidb/*-plugin/worker'];
  }

  if (updated) {
    compilerOptions.paths = newPaths;
    config.compilerOptions = compilerOptions;
    await writeJson(tsconfigPath, config);
  }
}

async function updateWorkerFactoryDeclarations() {
  const declPath = path.join(repoRoot, 'app', 'src', 'types', 'worker-factories.d.ts');
  let content;
  try {
    content = await fs.readFile(declPath, 'utf8');
  } catch {
    return;
  }
  const updated = content.replace(
    /@hierarchidb\/([a-z0-9-]+-plugin)\/worker-factory/g,
    '@hierarchidb/$1/worker',
  );
  if (updated !== content) {
    await fs.writeFile(declPath, updated, 'utf8');
  }
}

async function updateGeneratePluginLoader() {
  // generate-plugin-loader.mjs is refactored separately; no-op here.
}

async function updatePluginSpecifierReferences() {
  const files = await globby(
    [
      'app/**/*.{ts,tsx,js,jsx,mjs,cjs,d.ts,json,md,mdx}',
      'packages/**/*.{ts,tsx,js,jsx,mjs,cjs,d.ts,json,md,mdx}',
      'plugins/**/*.{ts,tsx,js,jsx,mjs,cjs,d.ts,json,md,mdx}',
      'docs/**/*.{md,mdx}',
      'scripts/**/*.{ts,tsx,js,jsx,mjs,cjs}',
    ],
    {
      cwd: repoRoot,
      absolute: true,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.turbo/**',
        '**/.next/**',
        '**/storybook-static/**',
        '**/coverage/**',
        '**/reports/**',
        '**/patches/**',
        '**/package.json',
        'pnpm-lock.yaml',
        'package-lock.json',
        'yarn.lock',
        'scripts/generate-plugin-loader.mjs',
      ],
    },
  );

  const pluginSpecifierPattern = /@hierarchidb\/([a-z0-9-]+-plugin)\/worker-factory/g;
  const pluginIndexPattern = /([a-z0-9-]+-plugin)\/worker-factory\/index/g;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const next = content
      .replace(pluginSpecifierPattern, '@hierarchidb/$1/worker')
      .replace(pluginIndexPattern, '$1/worker/index');
    if (next !== content) {
      await fs.writeFile(file, next, 'utf8');
    }
  }
}

async function main() {
  const pluginEntries = await fs.readdir(pluginsDir, { withFileTypes: true });
  const pluginNames = pluginEntries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('-plugin'))
    .map((entry) => entry.name)
    .sort();

  for (const pluginName of pluginNames) {
    await updatePackageJson(pluginName);
    await updateTsupConfig(pluginName);
  }

  await updateTsconfigBase();
  await updateWorkerFactoryDeclarations();
  await updateGeneratePluginLoader();
  await updatePluginSpecifierReferences();

  console.log(
    `Renamed plugin worker exports for ${pluginNames.length} plugins. ` +
      'Run pnpm generate-plugin-loader, lint/typecheck/tests to verify.',
  );
}

main().catch((error) => {
  console.error('[rename-plugin-worker-exports] Failed:', error);
  process.exit(1);
});
