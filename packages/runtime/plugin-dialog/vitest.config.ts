import { defineConfig } from 'vitest/config';
import * as path from 'path';
import {
  deriveNodeTypePluginAliases,
  discoverNodeTypePlugins,
} from '../../tools/plugin-registry-utils/dist/index.ts';

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
    .map(({ replacement, packageName }) => {
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
      '@hierarchidb/runtime-worker/WorkerAPIImpl': path.resolve(
        __dirname,
        './src/tests/mocks/WorkerAPIImpl.ts',
      ),
      'node-fetch': path.resolve(__dirname, '../../../app/src/virtual/node-fetch.ts'),
      '@hierarchidb/runtime-worker': path.resolve(
        __dirname,
        '../../runtime/worker/src/index.ts',
      ),
      '@hierarchidb/runtime-client': path.resolve(
        __dirname,
        '../../runtime/client/src/index.ts',
      ),
      '@hierarchidb/map-adapter': path.resolve(
        __dirname,
        '../../feature/map-adapter/src/index.ts',
      ),
      '@hierarchidb/tabular-xlsx': path.resolve(
        __dirname,
        '../../feature/tabular-source-xlsx/src/index.ts',
      ),
      '@hierarchidb/basemap-plugin/worker': path.resolve(
        __dirname,
        '../../plugin-loader/basemap-plugin/src/worker/factory/index.ts',
      ),
      '@hierarchidb/folder-plugin/worker': path.resolve(
        __dirname,
        '../../plugin-loader/folder-plugin/src/worker/factory/index.ts',
      ),
      '@hierarchidb/resolver-plugin/worker': path.resolve(
        __dirname,
        '../../plugin-loader/resolver-plugin/src/worker/factory/index.ts',
      ),
      '@hierarchidb/route-plugin/worker': path.resolve(
        __dirname,
        '../../plugin-loader/route-plugin/src/worker/factory/index.ts',
      ),
      '@hierarchidb/spreadsheet-plugin/worker': path.resolve(
        __dirname,
        '../../plugin-loader/spreadsheet-plugin/src/worker/factory/index.ts',
      ),
      '@hierarchidb/styler-plugin/worker': path.resolve(
        __dirname,
        '../../plugin-loader/styler-plugin/src/worker/factory/index.ts',
      ),
      '@hierarchidb/shape-plugin/worker': path.resolve(
        __dirname,
        '../../plugin-loader/shape-plugin/src/worker/factory/index.ts',
      ),
      '@hierarchidb/location-plugin/worker': path.resolve(
        __dirname,
        '../../plugin-loader/location-plugin/src/worker/factory/index.ts',
      ),
      '@hierarchidb/linker-plugin/worker': path.resolve(
        __dirname,
        '../../plugin-loader/linker-plugin/src/worker/factory/index.ts',
      ),
      '@hierarchidb/timeline-plugin/worker': path.resolve(
        __dirname,
        '../../plugin-loader/timeline-plugin/src/worker/factory/index.ts',
      ),
      ...nodeTypeAliases,
      ...legacyNodeTypeAliases,
      ...nodeTypeSrcAliases,
      ...legacyNodeTypeSrcAliases,
    },
  },
});
