import path from 'node:path';
import fs from 'node:fs';
import { dirExists, readJsonFile, resolveCandidate } from './fs-utils.js';
import type {
  DetectPluginsOptions,
  NodeTypePluginDetails,
  PluginEntryKind,
  PluginSubpathInfo,
} from './types.js';

interface SubpathDefinition {
  readonly kind: PluginEntryKind;
  readonly exportKey: string;
  readonly requireExport: boolean;
  readonly candidateBases: readonly string[];
}

const CANDIDATE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.cjs'] as const;

const SUBPATH_DEFINITIONS: readonly SubpathDefinition[] = [
  {
    kind: 'services',
    exportKey: './services',
    requireExport: true,
    candidateBases: ['src/services/index', 'src/services'],
  },
  {
    kind: 'database',
    exportKey: './database',
    requireExport: true,
    candidateBases: ['src/services/database/index', 'src/database/index', 'src/services/database', 'src/database'],
  },
  {
    kind: 'common',
    exportKey: './common',
    requireExport: false,
    candidateBases: ['src/common/index', 'src/common', 'src/shared/index', 'src/shared'],
  },
  {
    kind: 'ui',
    exportKey: './ui',
    requireExport: true,
    candidateBases: ['src/ui/index', 'src/ui/facade/index', 'src/ui/facade', 'src/ui'],
  },
  {
    kind: 'worker',
    exportKey: './worker',
    requireExport: true,
    candidateBases: ['src/worker/index', 'src/worker'],
  },
  {
    kind: 'root',
    exportKey: '.',
    requireExport: false,
    candidateBases: ['src/index'],
  },
] as const;

interface PackageJsonShape {
  name?: string;
  version?: string;
  exports?: Record<string, unknown> | string;
  hierarchidb?: { plugin?: { nodeType?: string } };
}

function hasExport(exportsField: PackageJsonShape['exports'], exportKey: string): boolean {
  if (!exportsField) return false;
  if (typeof exportsField === 'string') {
    return exportKey === '.';
  }
  if (typeof exportsField === 'object' && exportKey in exportsField) {
    return true;
  }
  return false;
}

function candidateFiles(packageDir: string, bases: readonly string[]): string[] {
  const files: string[] = [];
  for (const base of bases) {
    for (const ext of CANDIDATE_EXTENSIONS) {
      files.push(path.resolve(packageDir, `${base}${ext}`));
    }
  }
  return files;
}

function resolveManifestPath(packageDir: string, allowFallback: boolean): string | null {
  const primary = path.resolve(packageDir, 'src', 'plugin-manifest.ts');
  if (fs.existsSync(primary)) {
    return primary;
  }
  if (!allowFallback) return null;
  const legacy = path.resolve(packageDir, 'src', 'extension', 'plugin-manifest.ts');
  return fs.existsSync(legacy) ? legacy : null;
}

export function detectNodeTypePlugins(options: DetectPluginsOptions): NodeTypePluginDetails[] {
  const { rootDir, manifestFallback = true } = options;
  const pluginsDir = path.resolve(rootDir, 'plugins');
  if (!dirExists(pluginsDir)) return [];

  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  const results: NodeTypePluginDetails[] = [];

  for (const dirent of entries) {
    if (!dirent.isDirectory() || !dirent.name.endsWith('-plugin')) continue;
    const packageDir = path.resolve(pluginsDir, dirent.name);
    const packageJsonPath = path.resolve(packageDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) continue;

    const pkg = readJsonFile<PackageJsonShape>(packageJsonPath);
    if (!pkg?.name) continue;

    const pluginMeta = pkg.hierarchidb?.plugin;
    const nodeType = pluginMeta?.nodeType ?? dirent.name.replace(/-plugin$/, '');
    const manifestPath = resolveManifestPath(packageDir, manifestFallback);

    const subpaths: Record<PluginEntryKind, PluginSubpathInfo> = {} as Record<PluginEntryKind, PluginSubpathInfo>;
    for (const def of SUBPATH_DEFINITIONS) {
      const exportPresent = hasExport(pkg.exports, def.exportKey);
      const sourcePath = resolveCandidate(candidateFiles(packageDir, def.candidateBases));
      subpaths[def.kind] = {
        kind: def.kind,
        exportKey: def.exportKey,
        sourcePath,
        hasExport: def.requireExport ? exportPresent && !!sourcePath : !!sourcePath || exportPresent,
      };
    }

    results.push({
      nodeType,
      packageName: pkg.name,
      version: pkg.version ?? null,
      packageDir,
      packageJsonPath,
      manifestPath,
      exportsField: pkg.exports,
      subpaths,
    });
  }

  return results.sort((a, b) => a.nodeType.localeCompare(b.nodeType));
}
