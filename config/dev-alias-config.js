import fs from 'node:fs';
import path from 'node:path';

const CONFIG_FILENAME = 'config/dev-aliases.json';
const PACKAGE_SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.turbo',
  '.git',
  '.cache',
  'coverage',
  'storybook-static',
  'playwright-report',
]);

const SRC_ENTRY_CANDIDATES = [
  'src/preconnect.ts',
  'src/index.tsx',
  'src/index.ts',
  'src/index.mts',
  'src/index.mjs',
  'src/index.js',
  'src/main.ts',
  'src/main.tsx',
  'src/main.js',
];

const DIST_ENTRY_CANDIDATES = [
  'dist/index.js',
  'dist/index.mjs',
  'dist/index.cjs',
  'dist/index.mts',
  'dist/index.mtsx',
];

const PACKAGE_ROOTS = [
  { relative: 'packages', category: 'packages' },
  { relative: 'plugins', category: 'plugins' },
];

const EMPTY_SELECTION_OBJECT = {
  packages: new Set(),
  groups: new Set(),
  plugins: new Set(),
  allPackages: false,
  allPlugins: false,
};

/**
 * @template T
 * @param {string} filePath
 * @returns {T | null}
 */
function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {string[]=} values
 * @returns {string[]}
 */
function normalizeList(values) {
  if (!values) return [];
  const normalized = [];
  for (const value of values) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) continue;
    if (!normalized.includes(trimmed)) normalized.push(trimmed);
  }
  return normalized;
}

/**
 * @param {string} repoRoot
 * @returns {import('./dev-alias-config.js').DevAliasConfigFile}
 */
export function loadDevAliasConfig(repoRoot) {
  const configPath = path.resolve(repoRoot, CONFIG_FILENAME);
  const loaded = readJsonFile(configPath);
  if (loaded) return loaded;
  return { packages: [], groups: [], plugins: [] };
}

/**
 * @param {string|undefined} overrideRaw
 * @param {import('./dev-alias-config.js').DevAliasConfigFile} base
 * @returns {import('./dev-alias-config.js').DevAliasConfigFile}
 */
export function parseDevAliasOverride(overrideRaw, base) {
  if (!overrideRaw) {
    return {
      packages: normalizeList(base.packages),
      groups: normalizeList(base.groups),
      plugins: normalizeList(base.plugins),
    };
  }

  const overrides = {};
  for (const segment of overrideRaw.split(';')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const [keyRaw, valueRaw] = trimmed.split('=');
    if (!valueRaw) continue;
    const key = keyRaw.trim();
    const values = normalizeList(valueRaw.split(',').map((part) => part.trim()));
    if (key === 'packages') overrides.packages = values;
    else if (key === 'groups') overrides.groups = values;
    else if (key === 'plugins') overrides.plugins = values;
  }

  return {
    packages: overrides.packages ?? normalizeList(base.packages),
    groups: overrides.groups ?? normalizeList(base.groups),
    plugins: overrides.plugins ?? normalizeList(base.plugins),
  };
}

/**
 * @param {import('./dev-alias-config.js').DevAliasConfigFile} config
 * @returns {import('./dev-alias-config.js').DevAliasSelection}
 */
export function createDevAliasSelection(config) {
  const selection = {
    packages: new Set(),
    groups: new Set(),
    plugins: new Set(),
    allPackages: false,
    allPlugins: false,
  };

  for (const pkg of normalizeList(config.packages)) {
    if (pkg === '*') selection.allPackages = true;
    else selection.packages.add(pkg);
  }

  for (const group of normalizeList(config.groups)) {
    selection.groups.add(group);
  }

  for (const plugin of normalizeList(config.plugins)) {
    if (plugin === '*') selection.allPlugins = true;
    else selection.plugins.add(plugin);
  }

  return selection;
}

/**
 * @returns {import('./dev-alias-config.js').DevAliasSelection}
 */
export function cloneEmptySelection() {
  return {
    packages: new Set(EMPTY_SELECTION_OBJECT.packages),
    groups: new Set(EMPTY_SELECTION_OBJECT.groups),
    plugins: new Set(EMPTY_SELECTION_OBJECT.plugins),
    allPackages: EMPTY_SELECTION_OBJECT.allPackages,
    allPlugins: EMPTY_SELECTION_OBJECT.allPlugins,
  };
}

export const EMPTY_DEV_ALIAS_SELECTION = cloneEmptySelection();

/**
 * @param {import('./dev-alias-config.js').DevAliasSelection} selection
 * @param {string} specifier
 * @param {string=} group
 */
export function shouldUseSource(selection, specifier, group) {
  if (selection.allPackages) return true;
  if (selection.packages.has(specifier)) return true;
  if (group && selection.groups.has(group)) return true;
  return false;
}

/**
 * @param {import('./dev-alias-config.js').DevAliasSelection} selection
 * @param {string} packageName
 * @param {string=} nodeType
 */
export function shouldUsePluginSource(selection, packageName, nodeType) {
  if (selection.allPlugins) return true;
  if (selection.plugins.has(packageName)) return true;
  if (selection.groups.has('plugins')) return true;
  if (nodeType && selection.groups.has(`plugin:${nodeType}`)) return true;
  return false;
}

/**
 * @param {string} from
 * @param {string} to
 */
export function toPosixRelative(from, to) {
  return path.relative(from, to).split(path.sep).join('/');
}

/**
 * @param {string} baseDir
 * @param {readonly string[]} candidates
 * @returns {string|null}
 */
function resolveFirstExisting(baseDir, candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const absolute = path.resolve(baseDir, candidate);
    if (fs.existsSync(absolute)) return absolute;
  }
  return null;
}

/**
 * @param {Record<string, any>|undefined} exportsField
 * @returns {string[]}
 */
function extractExportEntries(exportsField) {
  const entries = [];
  if (!exportsField) return entries;
  const root = exportsField['.'] ?? exportsField;
  if (typeof root === 'string') entries.push(root);
  else if (root && typeof root === 'object') {
    for (const key of ['import', 'default', 'require', 'module']) {
      if (typeof root[key] === 'string') entries.push(root[key]);
    }
  }
  return entries;
}

/**
 * @param {string} repoRoot
 * @param {string} relativeBase
 * @param {'packages'|'plugins'} category
 * @returns {import('./dev-alias-config.js').WorkspacePackageMeta[]}
 */
function traverseForPackages(repoRoot, relativeBase, category) {
  const baseDir = path.resolve(repoRoot, relativeBase);
  if (!fs.existsSync(baseDir)) return [];

  const results = [];
  const queue = [{ relative: '', absolute: baseDir }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    for (const entry of fs.readdirSync(current.absolute, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (PACKAGE_SKIP_DIRS.has(entry.name)) continue;

      const relativeDir = path.join(relativeBase, current.relative, entry.name);
      const absoluteDir = path.join(current.absolute, entry.name);
      const packageJsonPath = path.join(absoluteDir, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        const pkg = readJsonFile(packageJsonPath) ?? {};
        const name = typeof pkg.name === 'string' ? pkg.name : entry.name;
        const srcDir = fs.existsSync(path.join(absoluteDir, 'src')) ? path.join(absoluteDir, 'src') : null;
        const srcEntry = srcDir ? resolveFirstExisting(absoluteDir, SRC_ENTRY_CANDIDATES) : null;

        const exportEntries = extractExportEntries(pkg.exports);
        const distCandidates = [
          ...(typeof pkg.module === 'string' ? [pkg.module] : []),
          ...(typeof pkg.main === 'string' ? [pkg.main] : []),
          ...exportEntries,
          ...DIST_ENTRY_CANDIDATES,
        ];
        const distEntry = resolveFirstExisting(absoluteDir, distCandidates);
        const distDir = fs.existsSync(path.join(absoluteDir, 'dist')) ? path.join(absoluteDir, 'dist') : null;
        const typesEntry = typeof pkg.types === 'string'
          ? path.resolve(absoluteDir, pkg.types)
          : typeof pkg.typings === 'string'
            ? path.resolve(absoluteDir, pkg.typings)
            : null;

        const relativeParts = relativeDir.split(path.sep).filter(Boolean);
        const group = category === 'packages'
          ? relativeParts.slice(1, 2)[0] ?? ''
          : 'plugins';

        results.push({
          name,
          dir: absoluteDir,
          relativeDir,
          category,
          group,
          srcEntry,
          srcDir,
          distEntry,
          distDir,
          typesEntry,
        });
        continue;
      }

      queue.push({
        relative: path.join(current.relative, entry.name),
        absolute: absoluteDir,
      });
    }
  }

  return results;
}

/**
 * @param {string} repoRoot
 * @returns {import('./dev-alias-config.js').WorkspacePackageMeta[]}
 */
export function collectWorkspacePackages(repoRoot) {
  const packages = [];
  for (const def of PACKAGE_ROOTS) {
    packages.push(...traverseForPackages(repoRoot, def.relative, def.category));
  }
  return packages;
}
