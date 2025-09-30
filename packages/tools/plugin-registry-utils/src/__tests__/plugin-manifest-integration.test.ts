import { describe, expect, it } from 'vitest';
import path from 'node:path';

import { loadPluginManifestFromFile } from '../../../../../tools/plugin-manifest-loader.js';
import { PluginDefinitionBuilder } from '../../../../../scripts/plugin-definition-builder.js';
import type { NodeType, PluginMetadata } from '@hierarchidb/common-type';

type PluginDescriptor = {
  packageName: string;
  dir: string;
  nodeType: NodeType;
};

const repoRoot = path.resolve(__dirname, '../../../../../');

const pluginDescriptors: PluginDescriptor[] = [
  { packageName: '@hierarchidb/plugins-folder-plugin', dir: 'folder-plugin', nodeType: 'folder' as NodeType },
  { packageName: '@hierarchidb/plugins-basemap-plugin', dir: 'basemap-plugin', nodeType: 'basemap' as NodeType },
  { packageName: '@hierarchidb/plugins-shape-plugin', dir: 'shape-plugin', nodeType: 'shape' as NodeType },
  { packageName: '@hierarchidb/plugins-location-plugin', dir: 'location-plugin', nodeType: 'location' as NodeType },
  { packageName: '@hierarchidb/plugins-route-plugin', dir: 'route-plugin', nodeType: 'route' as NodeType },
  { packageName: '@hierarchidb/plugins-resolver-plugin', dir: 'resolver-plugin', nodeType: 'resolver' as NodeType },
  { packageName: '@hierarchidb/plugins-spreadsheet-plugin', dir: 'spreadsheet-plugin', nodeType: 'spreadsheet' as NodeType },
  { packageName: '@hierarchidb/plugins-styler-plugin', dir: 'styler-plugin', nodeType: 'styler' as NodeType },
  { packageName: '@hierarchidb/plugins-linker-plugin', dir: 'linker-plugin', nodeType: 'linker' as NodeType },
  { packageName: '@hierarchidb/plugins-timeline-plugin', dir: 'timeline-plugin', nodeType: 'timeline' as NodeType },
];

describe('plugin manifest integration', () => {
  it('loads real manifests and builds plugin definitions', () => {
    const manifestEntries = new Map<string, PluginMetadata>();

    for (const plugin of pluginDescriptors) {
      const manifestPath = path.join(
        repoRoot,
        'packages',
        'plugins',
        plugin.dir,
        'src',
        'extension',
        'plugin-manifest.ts',
      );

      const manifest = loadPluginManifestFromFile(manifestPath, { silent: false }) as PluginMetadata | undefined;
      expect(manifest, `manifest for ${plugin.packageName}`).toBeDefined();
      expect(manifest?.nodeType).toEqual(plugin.nodeType);
      manifestEntries.set(plugin.packageName, manifest!);
    }

    const builder = new PluginDefinitionBuilder();
    const definitions = builder.buildDefinitions(manifestEntries);

    expect(definitions.size).toBe(pluginDescriptors.length);

    for (const plugin of pluginDescriptors) {
      const definition = definitions.get(plugin.nodeType);
      expect(definition, `definition for ${plugin.packageName}`).toBeDefined();
      const manifest = manifestEntries.get(plugin.packageName)!;
      expect(definition?.version).toBe(manifest.version);

      if (plugin.nodeType !== ('folder' as NodeType)) {
        expect(definition?.dependencies).toContain('folder');
      }
    }
  });
});
