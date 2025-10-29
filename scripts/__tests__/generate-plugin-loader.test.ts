import { beforeAll, describe, expect, it } from 'vitest';
import { generatePluginRegistry } from '../generate-plugin-loader.mjs';
import type { PluginRegistryEntry } from '@hierarchidb/plugin-registry/types';

let registrySnapshot: PluginRegistryEntry[];

beforeAll(async () => {
  await generatePluginRegistry();
  // Ensure the generated registry is resolved after regeneration
  const refreshed = await import('@hierarchidb/plugin-registry');
  registrySnapshot = refreshed.pluginRegistry;
});

describe('generate-plugin-loader.mjs', () => {
  it('emits plugin definitions for known plugins', async () => {
    const folder = registrySnapshot.find((entry) => entry.nodeType === 'folder');
    expect(folder).toMatchObject({
      nodeType: 'folder',
      packageName: '@hierarchidb/folder-plugin',
    });

    const route = registrySnapshot.find((entry) => entry.nodeType === 'route');
    expect(route).toMatchObject({
      nodeType: 'route',
      packageName: '@hierarchidb/route-plugin',
    });

    expect(registrySnapshot.length).toBeGreaterThanOrEqual(5);
  });

  it('generates UI/Worker loader maps that reference real plugin entry points', async () => {
    const folder = registrySnapshot.find((entry) => entry.nodeType === 'folder');
    expect(folder?.modules.ui?.specifier).toBe('@hierarchidb/folder-plugin/ui');
    expect(folder?.modules.worker?.specifier).toBe('@hierarchidb/folder-plugin/worker');
  });

  it('records source hints for worker modules when available', () => {
    const workerEntries = registrySnapshot.filter((entry) => entry.modules.worker?.specifier);
    expect(workerEntries.length).toBeGreaterThan(0);
    for (const entry of workerEntries) {
      expect(entry.modules.worker?.specifier).toMatch(/^@hierarchidb\/[a-z-]+-plugin\/worker$/);
      expect(entry.modules.worker?.source).toMatch(/^plugins\//);
    }
  });
});
