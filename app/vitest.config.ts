import fs from 'node:fs';
import * as path from 'path';
import type { Alias, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { collectWorkspacePackages } from '../config/dev-alias-config.js';
import { collectAliasEntries } from './vite-plugins/vite-plugin-hierarchidb-plugin-alias/src/alias';

const rootDir = __dirname;

export default defineConfig({
  plugins: [workspaceTildeAliasPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    root: rootDir,
    setupFiles: [path.resolve(rootDir, '../vitest.setup.ts')],
    //coverage: {
    //  reporter: ['text'],
    //},
  },
  resolve: {
    alias: createAliasMap(),
  },
});

function createAliasMap(): Alias[] {
  const baseEntries: Record<string, string> = {
    '#app': path.resolve(rootDir, 'src'),
    'node-fetch': path.resolve(rootDir, 'src/virtual/node-fetch.ts'),
    '@hierarchidb/build-api': path.resolve(rootDir, '../packages/build-api/src/index.ts'),
    '@hierarchidb/core-types': path.resolve(rootDir, '../packages/core-types/src/index.ts'),
    '@hierarchidb/tree-api': path.resolve(rootDir, '../packages/tree-api/src/index.ts'),
    '@hierarchidb/runtime-worker/yaml-storage-legacy-fence': path.resolve(
      rootDir,
      '../packages/runtime-worker/src/yaml-storage-legacy-fence/index.ts'
    ),
    '@hierarchidb/runtime-worker/yaml-storage-activation': path.resolve(
      rootDir,
      '../packages/runtime-worker/src/yaml-storage-activation/index.ts'
    ),
    '@hierarchidb/runtime-worker/yaml-storage-production': path.resolve(
      rootDir,
      '../packages/runtime-worker/src/yaml-storage-production/index.ts'
    ),
    '@hierarchidb/runtime-worker': path.resolve(rootDir, '../packages/runtime-worker/src/index.ts'),
    '@hierarchidb/util': path.resolve(rootDir, '../packages/util/src/index.ts'),
    '@hierarchidb/plugin-base': path.resolve(rootDir, '../packages/plugin-base/src/index.ts'),
    '@hierarchidb/gis-sdk': path.resolve(rootDir, '../packages/gis-sdk/src/index.ts'),
    '@hierarchidb/ide-gsm-client': path.resolve(rootDir, '../packages/ide-gsm-client/src/index.ts'),
    '@hierarchidb/origin-coordinator': path.resolve(
      rootDir,
      '../packages/origin-coordinator/src/index.ts'
    ),
    '@hierarchidb/plugin-registry/icon-loaders': path.resolve(
      rootDir,
      '../packages/plugin-registry/generated/icon-loaders.ts'
    ),
    '@hierarchidb/plugin-registry/ui-loaders': path.resolve(
      rootDir,
      '../packages/plugin-registry/generated/ui-loaders.ts'
    ),
    '@hierarchidb/plugin-registry/worker-loaders': path.resolve(
      rootDir,
      '../packages/plugin-registry/generated/worker-loaders.ts'
    ),
    '@hierarchidb/plugin-registry/database-loaders': path.resolve(
      rootDir,
      '../packages/plugin-registry/generated/database-loaders.ts'
    ),
    '@hierarchidb/plugin-registry/derivations': path.resolve(
      rootDir,
      '../packages/plugin-registry/src/derivations.ts'
    ),
    '@hierarchidb/plugin-registry/types': path.resolve(
      rootDir,
      '../packages/plugin-registry/src/build-types.ts'
    ),
    '@hierarchidb/plugin-registry/plugin-definitions': path.resolve(
      rootDir,
      '../packages/plugin-registry/generated/plugin-definitions.ts'
    ),
    '@hierarchidb/plugin-registry': path.resolve(
      rootDir,
      '../packages/plugin-registry/generated/registry.ts'
    ),
    '@hierarchidb/staged-folder-action': path.resolve(
      rootDir,
      '../packages/staged-folder-action/src/index.ts'
    ),
    '@hierarchidb/styler-store': path.resolve(rootDir, '../packages/styler-store/src/index.ts'),
    '@hierarchidb/vt-orchestrator': path.resolve(
      rootDir,
      '../packages/vt-orchestrator/src/index.ts'
    ),
    '@hierarchidb/yaml-api/validation': path.resolve(
      rootDir,
      '../packages/yaml-api/src/validation/index.ts'
    ),
    '@hierarchidb/yaml-api/migration': path.resolve(
      rootDir,
      '../packages/yaml-api/src/migration/index.ts'
    ),
    '@hierarchidb/yaml-api/inverse-migration': path.resolve(
      rootDir,
      '../packages/yaml-api/src/inverse-migration/index.ts'
    ),
    '@hierarchidb/yaml-api': path.resolve(rootDir, '../packages/yaml-api/src/index.ts'),
    '@hierarchidb/ui-icon': path.resolve(rootDir, '../packages/components/src/index.ts'),
    '@hierarchidb/components': path.resolve(rootDir, '../packages/components/src/index.ts'),
    '@hierarchidb/ui-plugin-shell/components': path.resolve(
      rootDir,
      '../packages/components/src/index.ts'
    ),
    '@hierarchidb/ui-plugin-shell/plugin-ui-host': path.resolve(
      rootDir,
      '../packages/plugin-ui-host/src/index.ts'
    ),
    '@hierarchidb/ui-plugin-shell/ui-auth': path.resolve(
      rootDir,
      '../packages/ui/auth/src/index.ts'
    ),
    '@hierarchidb/ui-plugin-shell/ui-dialog': path.resolve(
      rootDir,
      '../packages/ui/dialog/src/index.ts'
    ),
    '@hierarchidb/ui-plugin-shell/ui-i18n': path.resolve(
      rootDir,
      '../packages/ui/i18n/src/index.ts'
    ),
    '@hierarchidb/ui-plugin-shell/ui-icon': path.resolve(
      rootDir,
      '../packages/ui/icon/src/index.ts'
    ),
    '@hierarchidb/ui-plugin-shell/ui-map': path.resolve(rootDir, '../packages/ui/map/src/index.ts'),
    '@hierarchidb/ui-plugin-shell/ui-navigation': path.resolve(
      rootDir,
      '../packages/ui/navigation/src/index.ts'
    ),
    '@hierarchidb/ui-plugin-shell/ui-theme': path.resolve(
      rootDir,
      '../packages/ui/theme/src/index.ts'
    ),
    '@hierarchidb/ui-plugin-shell/ui-tour': path.resolve(
      rootDir,
      '../packages/ui/tour/src/index.ts'
    ),
    '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb': path.resolve(
      rootDir,
      '../packages/ui/treeconsole/breadcrumb/src/index.ts'
    ),
    '@hierarchidb/ui-plugin-shell/ui-usermenu': path.resolve(
      rootDir,
      '../packages/ui/usermenu/src/index.ts'
    ),
    '@hierarchidb/ui-dialog': path.resolve(rootDir, '../packages/ui/dialog/src/index.ts'),
    '@hierarchidb/ui-i18n': path.resolve(rootDir, '../packages/ui/i18n/src/index.ts'),
    '@hierarchidb/ui-treeconsole-toolbar': path.resolve(
      rootDir,
      '../packages/ui/treeconsole/toolbar/src/index.ts'
    ),
    '@hierarchidb/ui-treeconsole-breadcrumb': path.resolve(
      rootDir,
      '../packages/ui/treeconsole/breadcrumb/src/index.ts'
    ),
    '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb': path.resolve(
      rootDir,
      '../packages/ui/plugin-shell/src/ui-treeconsole-breadcrumb.ts'
    ),
    '@hierarchidb/ui-plugin-shell': path.resolve(
      rootDir,
      '../packages/ui/plugin-shell/src/index.ts'
    ),
    '@hierarchidb/ui-worker-client': path.resolve(
      rootDir,
      '../packages/ui/worker-client/src/index.ts'
    ),
  };

  return createExactAliasEntries(
    createOrderedAliasMap(createPluginAliasMap(), baseEntries, createWorkspacePackageAliasMap())
  );
}

function createWorkspacePackageAliasMap(): Record<string, string> {
  const repoRoot = path.resolve(rootDir, '..');
  const aliases = new Map<string, string>();
  const workspacePackages = [
    ...collectWorkspacePackages(repoRoot),
    ...collectExtraWorkspacePackages(repoRoot),
  ];

  for (const entry of workspacePackages) {
    if (entry.srcEntry !== null) {
      aliases.set(entry.name, entry.srcEntry);
    }
    for (const [specifier, replacement] of collectPackageExportAliases(entry)) {
      aliases.set(specifier, replacement);
    }
  }

  return Object.fromEntries(
    [...aliases.entries()].sort(([left], [right]) => right.length - left.length)
  );
}

interface WorkspaceAliasPackage {
  name: string;
  dir: string;
  srcEntry: string | null;
}

function collectExtraWorkspacePackages(repoRoot: string): WorkspaceAliasPackage[] {
  return ['packages/build', 'packages/tools/gen-iso3166-2']
    .map((relativeDir) => {
      const dir = path.resolve(repoRoot, relativeDir);
      const packageJson = readPackageJson(path.join(dir, 'package.json'));
      if (!packageJson || typeof packageJson.name !== 'string') return null;
      const srcEntry = resolveExistingPath(dir, ['src/index.tsx', 'src/index.ts', 'src/index.js']);
      return { name: packageJson.name, dir, srcEntry };
    })
    .filter((entry): entry is WorkspaceAliasPackage => entry !== null);
}

function collectPackageExportAliases(entry: WorkspaceAliasPackage): [string, string][] {
  const packageJson = readPackageJson(path.join(entry.dir, 'package.json'));
  const exportsField = packageJson?.exports;
  if (!exportsField || typeof exportsField !== 'object' || Array.isArray(exportsField)) {
    return [];
  }

  const aliases: [string, string][] = [];
  for (const [exportKey, exportValue] of Object.entries(exportsField)) {
    const importTarget = extractImportTarget(exportValue);
    if (!importTarget?.startsWith('./dist/')) continue;
    const sourceTarget = resolveSourceTarget(entry.dir, importTarget);
    if (!sourceTarget) continue;
    const specifier =
      exportKey === '.' ? entry.name : `${entry.name}/${exportKey.replace(/^\.\//u, '')}`;
    aliases.push([specifier, sourceTarget]);
  }
  return aliases;
}

function extractImportTarget(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ['import', 'default', 'module']) {
    if (typeof record[key] === 'string') return record[key];
  }
  return null;
}

function resolveSourceTarget(packageDir: string, importTarget: string): string | null {
  const withoutDist = importTarget.replace(/^\.\//u, '').replace(/^dist\//u, 'src/');
  const withoutExtension = withoutDist.replace(/\.(?:mjs|js|cjs)$/u, '');
  return resolveExistingPath(packageDir, [
    `${withoutExtension}.ts`,
    `${withoutExtension}.tsx`,
    `${withoutExtension}.js`,
    path.join(withoutExtension, 'index.ts'),
    path.join(withoutExtension, 'index.tsx'),
    path.join(withoutExtension, 'index.js'),
  ]);
}

function resolveExistingPath(baseDir: string, candidates: string[]): string | null {
  for (const candidate of candidates) {
    const absolutePath = path.resolve(baseDir, candidate);
    if (fs.existsSync(absolutePath)) return absolutePath;
  }
  return null;
}

function readPackageJson(filePath: string): { name?: unknown; exports?: unknown } | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { name?: unknown; exports?: unknown };
  } catch {
    return null;
  }
}

function createOrderedAliasMap(...maps: Record<string, string>[]): Record<string, string> {
  const aliases = new Map<string, string>();
  for (const map of maps) {
    for (const [specifier, replacement] of Object.entries(map).sort(
      ([left], [right]) => right.length - left.length
    )) {
      if (!aliases.has(specifier)) {
        aliases.set(specifier, replacement);
      }
    }
  }
  return Object.fromEntries(aliases);
}

function createExactAliasEntries(entries: Record<string, string>): Alias[] {
  return Object.entries(entries).map(([specifier, replacement]) => ({
    find: new RegExp(`^${escapeRegExp(specifier)}$`, 'u'),
    replacement,
  }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function workspaceTildeAliasPlugin(): Plugin {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

  return {
    name: 'hierarchidb:test-workspace-tilde-alias',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!source.startsWith('~/') || !importer) return null;

      const importerPath = importer.split('?', 1)[0]?.replace(/^\/@fs\//, '/') ?? '';
      let cursor = path.dirname(importerPath);
      let sourceRoot: string | null = null;

      while (cursor.startsWith(path.resolve(rootDir, '..'))) {
        const packageJsonPath = path.join(cursor, 'package.json');
        const candidateSourceRoot = path.join(cursor, 'src');
        if (fs.existsSync(packageJsonPath) && fs.existsSync(candidateSourceRoot)) {
          sourceRoot = candidateSourceRoot;
          break;
        }
        const parent = path.dirname(cursor);
        if (parent === cursor) break;
        cursor = parent;
      }

      if (!sourceRoot) return null;

      const requestedPath = path.resolve(sourceRoot, source.slice(2));
      const detectedExtension = path.extname(requestedPath);
      const requestedExtension = extensions.includes(detectedExtension) ? detectedExtension : '';
      const pathWithoutExtension = requestedExtension
        ? requestedPath.slice(0, -requestedExtension.length)
        : requestedPath;
      const candidates = requestedExtension
        ? [requestedPath, ...extensions.map((extension) => `${pathWithoutExtension}${extension}`)]
        : [
            ...extensions.map((extension) => `${requestedPath}${extension}`),
            ...extensions.map((extension) => path.join(requestedPath, `index${extension}`)),
          ];

      return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
    },
  };
}

function createPluginAliasMap(): Record<string, string> {
  const entries = collectAliasEntries(path.resolve(rootDir, '..'), [
    'database',
    'common',
    'ui',
    'worker',
    'icon',
    'root',
  ]);
  const map = Object.fromEntries(
    [...entries]
      .sort((left, right) => right.find.length - left.find.length)
      .map(({ find, replacement }) => [find, replacement])
  );
  if (process.env.VITEST_ALIAS_DEBUG === '1') {
    console.log('[vitest] plugin alias entries', Object.keys(map));
  }
  return map;
}
