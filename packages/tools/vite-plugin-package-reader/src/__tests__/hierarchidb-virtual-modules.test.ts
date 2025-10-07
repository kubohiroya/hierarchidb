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

function getHookHandler<T extends (...args: any[]) => any>(
  hook: T | { handler?: T } | undefined,
): T | undefined {
  if (!hook) return undefined;
  if (typeof hook === 'function') return hook;
  if (typeof hook.handler === 'function') {
    return hook.handler;
  }
  return undefined;
}

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

    const configResolved = getHookHandler<(config: any) => void | Promise<void>>(
      plugin.configResolved as any,
    );
    await configResolved?.call(plugin, {
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

    const resolveId = getHookHandler<(
      source: string,
      importer: string | undefined,
      options: any
    ) => any>(plugin.resolveId as any);
    const resolvedId = await resolveId?.call(
      plugin,
      virtualModuleId,
      undefined,
      { attributes: {}, isEntry: false } as any,
    );
    expect(resolvedId).toBe('\0virtual:plugin-definitions');

    const load = getHookHandler<(id: string, options?: any) => any>(plugin.load as any);
    const virtualContent = await load?.call(plugin, resolvedId as string, { ssr: false } as any);
    expect(virtualContent).toBeDefined();
    expect(virtualContent).toContain("packageName: '@hierarchidb/plugin-loader-folder-plugin'");
    expect(virtualContent).toContain("nodeType: 'folder'");
    expect(virtualContent).toContain('pluginDefinitions');
  });
});
