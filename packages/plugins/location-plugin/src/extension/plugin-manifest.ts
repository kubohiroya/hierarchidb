import type { PluginMetadata, NodeType } from '@hierarchidb/common-type';

export const PLUGIN_ID = '@hierarchidb/plugins-location-plugin' as const;
export const PLUGIN_VERSION = '0.1.0' as const;
export const PLUGIN_DESCRIPTION = 'Geographic location nodes with Shape integration' as const;
export const PLUGIN_NODE_TYPE = 'location' as NodeType;

export const PLUGIN_MANIFEST: PluginMetadata = {
  id: PLUGIN_ID,
  name: 'Location Plugin',
  displayName: 'Location',
  nodeType: PLUGIN_NODE_TYPE,
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  priority: 40,
  dependencies: [],
  icon: {
    mui: 'LocationOn',
    emoji: '📍',
    color: '#a3b030',
  },
  category: {
    treeId: '*',
    menuGroup: 'document',
    createOrder: 40,
  },
  tags: ['geographic', 'location'],
  capabilities: {
    workingCopy: true,
    batch: true,
    visualization: true,
  },
};

export type LocationPluginManifest = typeof PLUGIN_MANIFEST;
