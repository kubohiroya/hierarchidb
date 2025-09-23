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
      ...nodeTypeAliases,
      ...legacyNodeTypeAliases,
      ...nodeTypeSrcAliases,
      ...legacyNodeTypeSrcAliases,
    },
  },
});
