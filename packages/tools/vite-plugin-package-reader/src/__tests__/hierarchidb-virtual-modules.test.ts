import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { vitePluginPackageReader } from '../plugin/VitePlugin.js';
import {
  createHierarchiDBStrategy,
  createPluginDefinitionPipeline,
  createPluginVirtualModule,
} from '../presets/hierarchidb.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../..');

const virtualModuleId = 'virtual:plugin-definitions';

describe('HierarchiDB preset virtual module integration', () => {
  it('processes real plugin manifests and exposes plugin-definitions virtual module', async () => {
    const plugin = vitePluginPackageReader({
      rootDir: repoRoot,
      strategies: [createHierarchiDBStrategy()],
      pipeline: createPluginDefinitionPipeline(),
      virtualModules: [createPluginVirtualModule()],
      cache: false,
      watch: false,
      logger: { level: 'silent' },
      monorepo: { usePnpmWorkspace: true },
    });

    await plugin.configResolved?.({
      root: repoRoot,
      logLevel: 'silent',
      resolve: {},
      plugins: [],
    } as any);

    await plugin.api?.reload();

    const packages = plugin.api?.getPackages();
    expect(packages?.size).toBeGreaterThan(0);

    const definitions = plugin.api?.getTransformed();
    expect(definitions).toBeDefined();
    expect(definitions?.length).toBeGreaterThan(0);
    expect(definitions?.some((def) => def.nodeType === 'folder')).toBe(true);
    expect(definitions?.every((def) => typeof def.version === 'string')).toBe(true);

    const resolvedId = plugin.resolveId?.(virtualModuleId);
    expect(resolvedId).toBe('\0virtual:plugin-definitions');

    const virtualContent = plugin.load?.(resolvedId as string);
    expect(virtualContent).toBeDefined();
    expect(virtualContent).toContain("packageName: '@hierarchidb/plugins-folder-plugin'");
    expect(virtualContent).toContain("nodeType: 'folder'");
    expect(virtualContent).toContain('pluginDefinitions');
  });
});
