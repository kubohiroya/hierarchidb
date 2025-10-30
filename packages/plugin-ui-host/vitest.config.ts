import { defineConfig } from 'vitest/config';
import type { Alias } from 'vite';
import * as path from 'path';

const pluginNames = [
  'basemap',
  'folder',
  'resolver',
  'route',
  'spreadsheet',
  'styler',
  'shape',
  'location',
  'linker',
  'timeline',
];

const workerStubPath = path.resolve(__dirname, './src/tests/pluginWorkerStub.ts');
const runtimeWorkerStubPath = path.resolve(__dirname, './src/tests/runtimeWorkerStub.ts');

const pluginAliasEntries: Alias[] = pluginNames.flatMap((name) => {
  const root = path.resolve(__dirname, `../../plugins/${name}-plugin/src`);
  return [
    { find: `@hierarchidb/${name}-plugin`, replacement: path.join(root, 'index.ts') },
    { find: `@hierarchidb/${name}-plugin/src`, replacement: root },
    { find: `@hierarchidb/${name}-plugin/worker`, replacement: workerStubPath },
  ];
});

const pluginBasicInfoRoot = path.resolve(__dirname, '../ui/plugin-basic-info/src');
const basicInfoAliasEntries: Alias[] = [
  { find: '@hierarchidb/ui-plugin-basic-info', replacement: path.join(pluginBasicInfoRoot, 'index.ts') },
  { find: '@hierarchidb/ui-plugin-basic-info/src', replacement: pluginBasicInfoRoot },
  { find: '@hierarchidb/runtime-basic-info', replacement: path.join(pluginBasicInfoRoot, 'index.ts') },
  { find: '@hierarchidb/runtime-basic-info/src', replacement: pluginBasicInfoRoot },
];

const baseAliasEntries: Alias[] = [
  { find: '@hierarchidb/runtime-worker/WorkerAPIImpl', replacement: runtimeWorkerStubPath },
  { find: '@hierarchidb/runtime-worker', replacement: runtimeWorkerStubPath },
  { find: 'node-fetch', replacement: path.resolve(__dirname, '../../app/src/virtual/node-fetch.ts') },
  { find: '@hierarchidb/runtime-client', replacement: path.resolve(__dirname, '../runtime/client/src/index.ts') },
  { find: '@hierarchidb/map-adapter', replacement: path.resolve(__dirname, '../feature/map-adapter/src/index.ts') },
  {
    find: '@hierarchidb/tabular-xlsx',
    replacement: path.resolve(__dirname, '../feature/tabular-source-xlsx/src/index.ts'),
  },
];

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [
      path.resolve(__dirname, '../../vitest.setup.ts'),
      path.resolve(__dirname, './src/tests/setupPluginWorkerMock.ts'),
    ],
    globals: true,
    passWithNoTests: true,
  },
  resolve: {
    alias: [...baseAliasEntries, ...pluginAliasEntries, ...basicInfoAliasEntries],
  },
});
