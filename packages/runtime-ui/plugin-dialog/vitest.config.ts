import { defineConfig } from 'vitest/config';
import path from 'path';
import {
  deriveNodeTypePluginAliases,
  discoverNodeTypePlugins,
} from '../../tools/plugin-registry-utils/dist/index.js';

const workspaceRoot = path.resolve(__dirname, '../..');
const nodeTypePlugins = discoverNodeTypePlugins({ rootDir: workspaceRoot });
const nodeTypeAliasEntries = deriveNodeTypePluginAliases(nodeTypePlugins, {
  subpaths: ['root', 'ui', 'services', 'database', 'shared'],
});

const nodeTypeAliases = Object.fromEntries(
  nodeTypeAliasEntries.map(({ find, replacement }) => [find, replacement]),
);

const pluginByPackage = new Map(nodeTypePlugins.map((plugin) => [plugin.packageName, plugin]));

const legacyNodeTypeAliases = Object.fromEntries(
  nodeTypeAliasEntries
    .map(({ find, replacement, packageName }) => {
      const plugin = pluginByPackage.get(packageName);
      if (!plugin) return null;
      const suffix = find.slice(packageName.length);
      const alias = `@hierarchidb/${plugin.nodeType}-plugin${suffix}`;
      return [alias, replacement] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry)),
);

const nodeTypeSrcAliases = Object.fromEntries(
  nodeTypeAliasEntries
    .filter(({ subpath }) => subpath === 'root')
    .map(({ find, replacement }) => [`${find}/src`, path.dirname(replacement)]),
);

const legacyNodeTypeSrcAliases = Object.fromEntries(
  nodeTypeAliasEntries
    .filter(({ subpath }) => subpath === 'root')
    .map(({ find, replacement, packageName }) => {
      const plugin = pluginByPackage.get(packageName);
      if (!plugin) return null;
      const alias = `@hierarchidb/${plugin.nodeType}-plugin/src`;
      return [alias, path.dirname(replacement)] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry)),
);


export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, '../../../vitest.setup.ts')],
    globals: true,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      // Use mock WorkerAPI for integration-like tests
      '@hierarchidb/runtime-worker-worker/WorkerAPIImpl': path.resolve(
        __dirname,
        './src/tests/mocks/WorkerAPIImpl.ts',
      ),
      'node-fetch': path.resolve(__dirname, '../../../app/src/virtual/node-fetch.ts'),
      '@hierarchidb/runtime-worker': path.resolve(
        __dirname,
        '../../runtime/worker/src/index.ts',
      ),
      '@hierarchidb/runtime-worker-bootstrap': path.resolve(
        __dirname,
        '../../runtime/worker-bootstrap/src/index.ts',
      ),
      '@hierarchidb/map-adapter': path.resolve(
        __dirname,
        '../../feature/map-adapter/src/index.ts',
      ),
      '@hierarchidb/tabular-xlsx': path.resolve(
        __dirname,
        '../../feature/tabular-xlsx/src/index.ts',
      ),
      '@hierarchidb/plugins-basemap-plugin/worker-factory': path.resolve(
        __dirname,
        '../../plugin-loader/basemap-plugin/src/worker-factory/RuntimeWorkerService.ts',
      ),
      '@hierarchidb/plugins-folder-plugin/worker-factory': path.resolve(
        __dirname,
        '../../plugin-loader/folder-plugin/src/worker-factory/RuntimeWorkerService.ts',
      ),
      '@hierarchidb/plugins-resolver-plugin/worker-factory': path.resolve(
        __dirname,
        '../../plugin-loader/resolver-plugin/src/worker-factory/RuntimeWorkerService.ts',
      ),
      '@hierarchidb/plugins-route-plugin/worker-factory': path.resolve(
        __dirname,
        '../../plugin-loader/route-plugin/src/worker-factory/RuntimeWorkerService.ts',
      ),
      '@hierarchidb/plugins-spreadsheet-plugin/worker-factory': path.resolve(
        __dirname,
        '../../plugin-loader/spreadsheet-plugin/src/worker-factory/RuntimeWorkerService.ts',
      ),
      '@hierarchidb/plugins-styler-plugin/worker-factory': path.resolve(
        __dirname,
        '../../plugin-loader/styler-plugin/src/worker-factory/RuntimeWorkerService.ts',
      ),
      '@hierarchidb/plugins-shape-plugin/worker-factory': path.resolve(
        __dirname,
        '../../plugin-loader/shape-plugin/src/worker-factory/RuntimeWorkerService.ts',
      ),
      '@hierarchidb/plugins-location-plugin/worker-factory': path.resolve(
        __dirname,
        '../../plugin-loader/location-plugin/src/worker-factory/RuntimeWorkerService.ts',
      ),
      '@hierarchidb/plugins-linker-plugin/worker-factory': path.resolve(
        __dirname,
        '../../plugin-loader/linker-plugin/src/worker-factory/RuntimeWorkerService.ts',
      ),
      '@hierarchidb/plugins-timeline-plugin/worker-factory': path.resolve(
        __dirname,
        '../../plugin-loader/timeline-plugin/src/worker-factory/RuntimeWorkerService.ts',
      ),
      ...nodeTypeAliases,
      ...legacyNodeTypeAliases,
      ...nodeTypeSrcAliases,
      ...legacyNodeTypeSrcAliases,
    },
  },
});
