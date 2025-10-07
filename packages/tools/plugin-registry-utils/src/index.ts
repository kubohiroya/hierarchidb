import fs from 'node:fs';
import path from 'node:path';
import type { Alias, AliasOptions, Plugin } from 'vite';

export type NodeTypePluginSubpath =
  | 'root'
  | 'services'
  | 'database'
  | 'shared'
  | 'ui'
  | 'worker'
  | 'worker-factory';

export interface NodeTypePluginSubpathInfo {
  readonly type: NodeTypePluginSubpath;
  readonly exportKey: string;
  readonly hasExport: boolean;
  readonly srcPath: string | null;
}

export interface NodeTypePluginInfo {
  readonly nodeType: string;
  readonly packageName: string;
  readonly packageDir: string;
  readonly subpaths: Record<NodeTypePluginSubpath, NodeTypePluginSubpathInfo>;
}

export interface DiscoverNodeTypePluginsOptions {
  readonly rootDir: string;
}

export interface NodeTypePluginAliasEntry {
  readonly find: string;
  readonly replacement: string;
  readonly subpath: NodeTypePluginSubpath;
  readonly packageName: string;
  readonly nodeType: string;
}

interface SubpathConfig {
  readonly type: NodeTypePluginSubpath;
  readonly exportKey: string;
  readonly aliasSuffix: string;
  readonly priority: number;
  readonly requireExport: boolean;
  readonly candidateBases: readonly string[];
}

const CANDIDATE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js'] as const;

const SUBPATH_CONFIGS: readonly SubpathConfig[] = [
  {
    type: 'services',
    exportKey: './services',
    aliasSuffix: '/services',
    priority: 10,
    requireExport: true,
    candidateBases: ['src/services/index'],
  },
  {
    type: 'database',
    exportKey: './database',
    aliasSuffix: '/database',
    priority: 20,
    requireExport: true,
    candidateBases: ['src/database/index'],
  },
  {
    type: 'shared',
    exportKey: './shared',
    aliasSuffix: '/shared',
    priority: 30,
    requireExport: true,
    candidateBases: ['src/shared/index'],
  },
  {
    type: 'ui',
    exportKey: './ui',
    aliasSuffix: '/ui',
    priority: 40,
    requireExport: true,
    candidateBases: ['src/ui/index', 'src/ui/facade/index', 'src/ui/facade'],
  },
  {
    type: 'worker',
    exportKey: './worker',
    aliasSuffix: '/worker',
    priority: 50,
    requireExport: true,
    candidateBases: ['src/worker/index'],
  },
  {
    type: 'worker-factory',
    exportKey: './worker-factory',
    aliasSuffix: '/worker-factory',
    priority: 55,
    requireExport: true,
    candidateBases: ['src/worker-factory/index'],
  },
  {
    type: 'root',
    exportKey: '.',
    aliasSuffix: '',
    priority: 60,
    requireExport: false,
    candidateBases: ['src/index'],
  },
] as const;

const NODE_TYPE_DIR_NAME = path.join('packages', 'plugins');

interface PackageJsonShape {
  name?: string;
  exports?: Record<string, unknown> | string;
  hierarchidb?: { plugin?: { nodeType?: string } };
}

const SERVICE_SUBPATH_ORDER: readonly NodeTypePluginSubpath[] = ['services', 'database', 'shared', 'root'];

function makeCandidateFiles(base: string): string[] {
  return CANDIDATE_EXTENSIONS.map((ext) => `${base}${ext}`);
}

function findFirstExistingFile(pkgDir: string, candidateBases: readonly string[]): string | null {
  for (const base of candidateBases) {
    for (const candidate of makeCandidateFiles(base)) {
      const absolute = path.resolve(pkgDir, candidate);
      if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
        return absolute;
      }
    }
  }
  return null;
}

function hasSubpathExport(exportsField: PackageJsonShape['exports'], exportKey: string): boolean {
  if (!exportsField) return false;
  if (typeof exportsField === 'string') {
    return exportKey === '.';
  }
  if (typeof exportsField === 'object') {
    return Object.prototype.hasOwnProperty.call(exportsField, exportKey);
  }
  return false;
}

function readPackageJson(pkgPath: string): PackageJsonShape | null {
  try {
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    return JSON.parse(raw) as PackageJsonShape;
  } catch (error) {
    return null;
  }
}

export function discoverNodeTypePlugins({ rootDir }: DiscoverNodeTypePluginsOptions): NodeTypePluginInfo[] {
  const nodeTypeRoot = path.resolve(rootDir, NODE_TYPE_DIR_NAME);
  if (!fs.existsSync(nodeTypeRoot)) return [];

  const entries: NodeTypePluginInfo[] = [];
  const dirents = fs.readdirSync(nodeTypeRoot, { withFileTypes: true });
  for (const dirent of dirents) {
    if (!dirent.isDirectory() || !dirent.name.endsWith('-plugin')) continue;
    const packageDir = path.join(nodeTypeRoot, dirent.name);
    const pkgJsonPath = path.join(packageDir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) continue;

    const pkg = readPackageJson(pkgJsonPath);
    if (!pkg?.name) continue;
    const pluginMeta = pkg.hierarchidb?.plugin;
    if (!pluginMeta) continue;

    const nodeType = pluginMeta.nodeType ?? dirent.name.replace(/-plugin$/, '');
    const subpathEntries: Record<NodeTypePluginSubpath, NodeTypePluginSubpathInfo> = {
      root: {
        type: 'root',
        exportKey: '.',
        hasExport: true,
        srcPath: findFirstExistingFile(packageDir, SUBPATH_CONFIGS.find((cfg) => cfg.type === 'root')?.candidateBases ?? []),
      },
      services: {
        type: 'services',
        exportKey: './services',
        hasExport: false,
        srcPath: null,
      },
      database: {
        type: 'database',
        exportKey: './database',
        hasExport: false,
        srcPath: null,
      },
      shared: {
        type: 'shared',
        exportKey: './shared',
        hasExport: false,
        srcPath: null,
      },
      ui: {
        type: 'ui',
        exportKey: './ui',
        hasExport: false,
        srcPath: null,
      },
      worker: {
        type: 'worker',
        exportKey: './worker',
        hasExport: false,
        srcPath: null,
      },
      'worker-factory': {
        type: 'worker-factory',
        exportKey: './worker-factory',
        hasExport: false,
        srcPath: null,
      },
    };

    for (const config of SUBPATH_CONFIGS) {
      const hasExport = config.requireExport ? hasSubpathExport(pkg.exports, config.exportKey) : true;
      const srcPath = hasExport ? findFirstExistingFile(packageDir, config.candidateBases) : null;
      const info: NodeTypePluginSubpathInfo = {
        type: config.type,
        exportKey: config.exportKey,
        hasExport: hasExport && srcPath !== null,
        srcPath,
      };
      subpathEntries[config.type] = info;
    }

    entries.push({
      nodeType,
      packageName: pkg.name,
      packageDir,
      subpaths: subpathEntries,
    });
  }

  return entries.sort((a, b) => a.nodeType.localeCompare(b.nodeType));
}

export interface DeriveAliasOptions {
  readonly subpaths?: readonly NodeTypePluginSubpath[];
}

export function deriveNodeTypePluginAliases(
  plugins: readonly NodeTypePluginInfo[],
  options?: DeriveAliasOptions,
): NodeTypePluginAliasEntry[] {
  const allowed = options?.subpaths ? new Set(options.subpaths) : null;
  const sortedConfigs = [...SUBPATH_CONFIGS]
    .filter((config) => (allowed ? allowed.has(config.type) : true))
    .sort((a, b) => a.priority - b.priority);
  const aliasEntries: NodeTypePluginAliasEntry[] = [];

  for (const plugin of plugins) {
    for (const config of sortedConfigs) {
      const sub = plugin.subpaths[config.type];
      if (!sub?.srcPath || !sub.hasExport) continue;
      aliasEntries.push({
        find: `${plugin.packageName}${config.aliasSuffix}`,
        replacement: sub.srcPath,
        subpath: config.type,
        packageName: plugin.packageName,
        nodeType: plugin.nodeType,
      });
    }
  }

  return aliasEntries;
}

function normalizeAliasOptions(options?: AliasOptions): Alias[] {
  if (!options) return [];
  if (Array.isArray(options)) return [...options];
  return Object.entries(options).map(([find, replacement]) => ({ find, replacement }));
}

function mergeAliasOptions(existing: AliasOptions | undefined, additions: readonly Alias[]): Alias[] {
  const normalizedExisting = normalizeAliasOptions(existing);
  const findStrings = new Set(
    additions
      .map((alias) => (typeof alias.find === 'string' ? alias.find : null))
      .filter((value): value is string => value !== null),
  );

  const filteredExisting = normalizedExisting.filter((alias) => {
    if (typeof alias.find !== 'string') return true;
    return !findStrings.has(alias.find);
  });

  return [...additions, ...filteredExisting];
}

export interface CreateNodeTypeAliasPluginOptions {
  readonly rootDir?: string;
  readonly subpaths?: readonly NodeTypePluginSubpath[];
  readonly tsconfigPath?: string;
  readonly tsconfigSubpaths?: readonly NodeTypePluginSubpath[];
}

function toPosixRelative(fromDir: string, absolutePath: string): string {
  const rel = path.relative(fromDir, absolutePath).replace(/\\/g, '/');
  if (rel.startsWith('.')) return rel;
  return rel.length > 0 ? `./${rel}` : '.';
}

function stripJsonComments(text: string): string {
  let result = '';
  let inString = false;
  let stringChar: '"' | '\'' | '' = '';
  let escaped = false;
  let inSingleLineComment = false;
  let inMultiLineComment = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inSingleLineComment) {
      if (char === '\n' || char === '\r') {
        inSingleLineComment = false;
        result += char;
      } else {
        result += ' ';
      }
      continue;
    }

    if (inMultiLineComment) {
      if (char === '*' && next === '/') {
        inMultiLineComment = false;
        result += ' ';
        i++;
      } else if (char === '\n' || char === '\r') {
        result += char;
      } else {
        result += ' ';
      }
      continue;
    }

    if (inString) {
      result += char;
      if (char === stringChar && !escaped) {
        inString = false;
        stringChar = '';
      }
      escaped = char === '\\' ? !escaped : false;
      continue;
    }

    if (char === '"' || char === '\'') {
      inString = true;
      stringChar = char as '"' | '\'';
      result += char;
      escaped = false;
      continue;
    }

    if (char === '/' && next === '/') {
      inSingleLineComment = true;
      result += ' ';
      i++;
      continue;
    }

    if (char === '/' && next === '*') {
      inMultiLineComment = true;
      result += ' ';
      i++;
      continue;
    }

    result += char;
  }

  return result;
}

function readJsonWithComments(filePath: string): any | null {
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    const cleaned = stripJsonComments(text);
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function ensureTsconfigPaths(
  tsconfigPath: string,
  aliases: readonly NodeTypePluginAliasEntry[],
  allowedSubpaths?: readonly NodeTypePluginSubpath[],
): void {
  if (!fs.existsSync(tsconfigPath) || aliases.length === 0) return;

  const parsed = readJsonWithComments(tsconfigPath);
  if (!parsed) return;

  const compilerOptions = (parsed.compilerOptions = parsed.compilerOptions ?? {});
  const paths = (compilerOptions.paths = compilerOptions.paths ?? {});
  const baseDir = path.dirname(tsconfigPath);
  let changed = false;

  const allowed = allowedSubpaths ? new Set(allowedSubpaths) : null;

  for (const alias of aliases) {
    if (allowed && !allowed.has(alias.subpath)) continue;
    const relPath = toPosixRelative(baseDir, alias.replacement);
    const existing = paths[alias.find];
    if (!Array.isArray(existing) || existing[0] !== relPath) {
      paths[alias.find] = [relPath];
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(tsconfigPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8');
  }
}

export interface SyncNodeTypeAliasesToTsconfigOptions {
  readonly rootDir: string;
  readonly tsconfigPath: string;
  readonly subpaths?: readonly NodeTypePluginSubpath[];
  readonly tsconfigSubpaths?: readonly NodeTypePluginSubpath[];
}

export function syncNodeTypeAliasesToTsconfig({
  rootDir,
  tsconfigPath,
  subpaths,
  tsconfigSubpaths,
}: SyncNodeTypeAliasesToTsconfigOptions): void {
  const plugins = discoverNodeTypePlugins({ rootDir });
  const aliasEntries = deriveNodeTypePluginAliases(plugins, { subpaths });
  if (aliasEntries.length === 0) return;
  ensureTsconfigPaths(tsconfigPath, aliasEntries, tsconfigSubpaths ?? subpaths);
}

export function createNodeTypeAliasPlugin(options?: CreateNodeTypeAliasPluginOptions): Plugin {
  // eslint-disable-next-line no-restricted-globals
  const rootDir = options?.rootDir ?? process.cwd();

  return {
    name: 'hierarchidb-plugin-loader-alias-plugin',
    enforce: 'pre',
    config(config) {
      const plugins = discoverNodeTypePlugins({ rootDir });
      const aliasEntries = deriveNodeTypePluginAliases(plugins, {
        subpaths: options?.subpaths,
      });
      if (aliasEntries.length === 0) return;

      const viteAliases: Alias[] = aliasEntries.map(({ find, replacement }) => ({ find, replacement }));
      const merged = mergeAliasOptions(config?.resolve?.alias, viteAliases);

      if (options?.tsconfigPath) {
        ensureTsconfigPaths(options.tsconfigPath, aliasEntries, options.tsconfigSubpaths);
      }

      return {
        resolve: {
          alias: merged,
        },
      };
    },
  };
}

export function pickPreferredServiceSubpath(info: NodeTypePluginInfo): NodeTypePluginSubpathInfo | null {
  for (const key of SERVICE_SUBPATH_ORDER) {
    const candidate = info.subpaths[key];
    if (candidate?.hasExport) return candidate;
  }
  return null;
}
