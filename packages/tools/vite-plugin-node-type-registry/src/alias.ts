import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Alias } from 'vite';
import { detectNodeTypePlugins } from './detect-plugins.js';
import { toPosixPath } from './fs-utils.js';
import type {
  AliasEntry,
  CreateAliasPluginOptions,
  PluginEntryKind,
} from './types.js';

interface TsconfigShape {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

const DEFAULT_ALIAS_KINDS: PluginEntryKind[] = ['database', 'common', 'ui', 'worker'];

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDir, '..');
const defaultRootDir = path.resolve(packageRoot, '..', '..', '..');

function filterKinds(kinds?: PluginEntryKind[]): PluginEntryKind[] {
  return kinds && kinds.length > 0 ? kinds : DEFAULT_ALIAS_KINDS;
}

function collectAliasEntries(rootDir: string, kinds?: PluginEntryKind[]): AliasEntry[] {
  const allowed = new Set(filterKinds(kinds));
  const plugins = detectNodeTypePlugins({ rootDir });
  const entries: AliasEntry[] = [];

  for (const plugin of plugins) {
    for (const [kind, info] of Object.entries(plugin.subpaths)) {
      const typedKind = kind as PluginEntryKind;
      if (!allowed.has(typedKind)) continue;
      if (!info.hasExport || !info.sourcePath) continue;

      entries.push({
        find: `${plugin.packageName}${info.exportKey === '.' ? '' : info.exportKey.replace(/^[.]/, '')}`.replace(/\/+/g, '/'),
        replacement: info.sourcePath,
        kind: typedKind,
        nodeType: plugin.nodeType,
        packageName: plugin.packageName,
      });
    }
  }

  return entries;
}

function mergeAliasOptions(existing: any, additions: readonly Alias[]): Alias[] {
  const normalized: Alias[] = Array.isArray(existing)
    ? [...existing]
    : existing && typeof existing === 'object'
      ? Object.entries(existing).map(([find, replacement]) => ({ find, replacement }))
      : [];

  const additionKeys = new Set(additions.map((alias) => (typeof alias.find === 'string' ? alias.find : String(alias.find))));
  const filtered = normalized.filter((alias) => {
    if (typeof alias.find !== 'string') return true;
    return !additionKeys.has(alias.find);
  });

  return [...additions, ...filtered];
}

function ensureTsconfigPaths(tsconfigPath: string, entries: readonly AliasEntry[], kinds: readonly PluginEntryKind[]): void {
  if (!fs.existsSync(tsconfigPath)) return;

  const raw = fs.readFileSync(tsconfigPath, 'utf-8');
  let parsed: TsconfigShape;
  try {
    parsed = JSON.parse(raw) as TsconfigShape;
  } catch {
    return;
  }

  const compilerOptions = (parsed.compilerOptions = parsed.compilerOptions ?? {});
  const paths = (compilerOptions.paths = compilerOptions.paths ?? {});

  let changed = false;
  const allowed = new Set(kinds);

  for (const entry of entries) {
    if (!allowed.has(entry.kind)) continue;
    const rel = toPosixPath(path.relative(path.dirname(tsconfigPath), entry.replacement));
    if (!Array.isArray(paths[entry.find]) || paths[entry.find]?.[0] !== rel) {
      paths[entry.find] = [rel];
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(tsconfigPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8');
  }
}

export function createNodeTypeAliasPlugin(options: CreateAliasPluginOptions = {}) {
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : defaultRootDir;
  const allowedKinds = filterKinds(options.kinds);
  
  return {
    name: '@hierarchidb/vite-plugin-node-type-registry:alias',
    enforce: 'pre' as const,
    config(config: any) {
      const entries = collectAliasEntries(rootDir, allowedKinds);
      if (entries.length === 0) return;

      const viteAliases: Alias[] = entries.map(({ find, replacement }) => ({ find, replacement }));
      const merged = mergeAliasOptions(config?.resolve?.alias, viteAliases);

      if (options.tsconfigPath) {
        const tsconfigKinds = options.tsconfigKinds ? filterKinds(options.tsconfigKinds) : allowedKinds;
        ensureTsconfigPaths(path.resolve(rootDir, options.tsconfigPath), entries, tsconfigKinds);
      }

      return {
        resolve: {
          alias: merged,
        },
      };
    },
  };
}

export { collectAliasEntries };
