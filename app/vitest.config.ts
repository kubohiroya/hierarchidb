import * as path from 'path';
import { defineConfig } from 'vitest/config';
import { collectAliasEntries } from './vite-plugins/vite-plugin-hierarchidb-plugin-alias/src/alias.ts';

const rootDir = __dirname;

export default defineConfig({
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
    alias: {
      '~': path.resolve(rootDir, 'src'),
      '#app': path.resolve(rootDir, 'src'),
      'node-fetch': path.resolve(rootDir, 'src/virtual/node-fetch.ts'),
      ...createPluginAliasMap(),
    },
  },
});

function createPluginAliasMap(): Record<string, string> {
  const entries = collectAliasEntries(path.resolve(rootDir, '..'), ['database', 'common', 'ui', 'worker', 'icon', 'root']);
  const map = Object.fromEntries(entries.map(({ find, replacement }) => [find, replacement]));
  if (process.env.VITEST_ALIAS_DEBUG === '1') {
    console.log('[vitest] plugin alias entries', Object.keys(map));
  }
  return map;
}
