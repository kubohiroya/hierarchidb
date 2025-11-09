import type { NodeType } from '@hierarchidb/common-types';

export const PLUGIN_ID = '@hierarchidb/location-plugin' as const;
export const PLUGIN_VERSION = '0.1.0' as const;
export const PLUGIN_DESCRIPTION = 'Geographic location nodes with Shape integration' as const;
export const PLUGIN_NODE_TYPE = 'location' as NodeType;

export const PLUGIN_MANIFEST = {
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
    component: {
      specifier: '@hierarchidb/location-plugin/icon',
      exportName: 'LocationPluginIcon',
    },
  },
  category: {
    id: 'geographic',
    treeId: '*',
    menuGroup: 'geo',
    createOrder: 40,
  },
  tags: ['geographic', 'location'],
  capabilities: {
    workingCopy: true,
    batch: true,
    visualization: true,
  },
  database: {
    prewarm: [
      {
        specifier: '@hierarchidb/location-plugin/database',
        export: 'getEphemeralLocationDB',
      },
    ],
  },
  worker: {
    preload: ['registerLocationWorkerStores', 'loadLocationEntitiesDbModule'],
  },
};

export type LocationPluginManifest = typeof PLUGIN_MANIFEST;
