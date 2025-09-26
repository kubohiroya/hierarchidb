import { toNodeType, type PluginMetadata } from '@hierarchidb/common-type';

export const PLUGIN_ID = '@hierarchidb/plugins-resolver-plugin' as const;
export const PLUGIN_VERSION = '1.0.0' as const;
export const PLUGIN_DESCRIPTION = 'Resolver node type plugin for property mapping between different data schemas' as const;

export const PLUGIN_MANIFEST: PluginMetadata = {
  id: PLUGIN_ID,
  name: 'Resolver Plugin',
  displayName: 'Resolver',
  nodeType: toNodeType('resolver'),
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  priority: 60,
  dependencies: [],
  icon: {
    mui: 'Extension',
    emoji: '🧩',
    color: '#ffb3c1',
  },
  category: {
    treeId: '*',
    menuGroup: 'document',
    createOrder: 60,
  },
  tags: ['mapping', 'schema'],
  capabilities: {
    relationalData: true,
  },
};

export type ResolverPluginManifest = typeof PLUGIN_MANIFEST;
