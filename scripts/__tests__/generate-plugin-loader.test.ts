import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePluginRegistry } from '../generate-plugin-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const pluginRegistryFile = path.join(
  repoRoot,
  'app',
  'src',
  'plugin-registry',
  'generated',
  'index.ts',
);
const pluginAmbientFile = path.join(
  repoRoot,
  'types',
  'generated',
  'plugin-modules.d.ts',
);
const runtimeWorkerMetadataFile = path.join(
  repoRoot,
  'packages',
  'runtime/worker',
  'src',
  'generated',
  'plugin-metadata.ts',
);
const runtimeWorkerAmbientFile = path.join(
  repoRoot,
  'types',
  'generated',
  'runtime-worker.d.ts',
);
const uiLoaderFile = path.join(repoRoot, 'app', 'src', 'generated', 'ui-loader.ts');
const workerLoaderFile = path.join(repoRoot, 'app', 'src', 'generated', 'worker-loader.ts');

async function readGeneratedFile(filePath: string) {
  return readFile(filePath, 'utf8');
}

function extractDefinitionsArray(source: string) {
  const match = source.match(
    /export const pluginDefinitions: PluginDefinition\[] = (\[[\s\S]*?\]);/,
  );
  if (!match) {
    throw new Error('pluginDefinitions export not found in generated registry');
  }
  return JSON.parse(match[1]) as Array<Record<string, unknown>>;
}

beforeAll(async () => {
  await generatePluginRegistry();
});

describe('generate-plugin-loader.mjs', () => {
  it('emits plugin definitions for known plugins', async () => {
    const registrySource = await readGeneratedFile(pluginRegistryFile);
    const definitions = extractDefinitionsArray(registrySource);

    const folder = definitions.find((entry) => entry.nodeType === 'folder');
    expect(folder).toMatchObject({
      nodeType: 'folder',
      packageName: '@hierarchidb/folder-plugin',
      dependencies: [],
    });

    const route = definitions.find((entry) => entry.nodeType === 'route');
    expect(route).toMatchObject({
      nodeType: 'route',
      packageName: '@hierarchidb/route-plugin',
      dependencies: ['shape'],
    });

    expect(definitions.length).toBeGreaterThanOrEqual(5);
  });

  it('generates UI/Worker loader maps that reference real plugin entry points', async () => {
    const registrySource = await readGeneratedFile(pluginRegistryFile);
    expect(registrySource).toContain(
      `'folder': () => import('@hierarchidb/folder-plugin/ui')`,
    );
    expect(registrySource).toContain(
      `'folder': () => import('@hierarchidb/folder-plugin/worker')`,
    );
  });

  it('updates generated UI loader with dependency-ordered imports', async () => {
    const uiLoaderSource = await readGeneratedFile(uiLoaderFile);
    expect(uiLoaderSource).toContain(
      `'folder': () => import('@hierarchidb/folder-plugin/ui')`,
    );
    // Ensure load order array exists and contains known node types
    expect(uiLoaderSource).toMatch(
      /export const uiLoadOrder = \[[^\]]*"folder"[^\]]*\] as const;/,
    );
  });

  it('generates ambient module declarations for plugin entry points', async () => {
    const ambientSource = await readGeneratedFile(pluginAmbientFile);
    expect(ambientSource).toContain(`declare module '@hierarchidb/folder-plugin/ui';`);
    expect(ambientSource).toContain(`declare module '@hierarchidb/folder-plugin/worker';`);
  });

  it('generates runtime worker ambient declarations', async () => {
    const ambientSource = await readGeneratedFile(runtimeWorkerAmbientFile);
    expect(ambientSource).toContain(`export * from '@hierarchidb/folder-plugin/worker';`);
  });

  it('produces worker loader entries for plugins with EntitiesDB exports', async () => {
    const workerLoaderSource = await readGeneratedFile(workerLoaderFile);
    expect(workerLoaderSource).toMatch(/'folder': async \(\) =>/);
    expect(workerLoaderSource).toContain(`loadFolderEntitiesDbModule`);
  });

  it('emits runtime worker metadata with loader map', async () => {
    const metadataSource = await readGeneratedFile(runtimeWorkerMetadataFile);
    expect(metadataSource).toContain(`export const pluginRegistry`);
    expect(metadataSource).toContain(`'folder': () => import('@hierarchidb/folder-plugin/worker')`);
  });
});
