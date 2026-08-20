import fs from 'node:fs';
import * as path from 'path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
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

function createAliasMap(): Record<string, string> {
  const baseEntries: Record<string, string> = {
    '#app': path.resolve(rootDir, 'src'),
    'node-fetch': path.resolve(rootDir, 'src/virtual/node-fetch.ts'),
    '@hierarchidb/runtime-worker/yaml-storage-legacy-fence': path.resolve(
      rootDir,
      '../packages/runtime-worker/src/yaml-storage-legacy-fence/index.ts'
    ),
    '@hierarchidb/runtime-worker': path.resolve(rootDir, '../packages/runtime-worker/src/index.ts'),
    '@hierarchidb/util': path.resolve(rootDir, '../packages/util/src/index.ts'),
    '@hierarchidb/plugin-base': path.resolve(rootDir, '../packages/plugin-base/src/index.ts'),
    '@hierarchidb/gis-sdk': path.resolve(rootDir, '../packages/gis-sdk/src/index.ts'),
    '@hierarchidb/vt-orchestrator': path.resolve(
      rootDir,
      '../packages/vt-orchestrator/src/index.ts'
    ),
    '@hierarchidb/ui-icon': path.resolve(rootDir, '../packages/components/src/index.ts'),
    '@hierarchidb/components': path.resolve(rootDir, '../packages/components/src/index.ts'),
    '@hierarchidb/ui-dialog': path.resolve(rootDir, '../packages/ui/dialog/src/index.ts'),
    '@hierarchidb/ui-treeconsole-toolbar': path.resolve(
      rootDir,
      '../packages/ui/treeconsole/toolbar/src/index.ts'
    ),
  };

  return {
    ...baseEntries,
    ...createPluginAliasMap(),
  };
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
  const map = Object.fromEntries(entries.map(({ find, replacement }) => [find, replacement]));
  if (process.env.VITEST_ALIAS_DEBUG === '1') {
    console.log('[vitest] plugin alias entries', Object.keys(map));
  }
  return map;
}
