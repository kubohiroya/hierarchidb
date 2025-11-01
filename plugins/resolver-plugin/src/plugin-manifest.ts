import type { NodeType } from '@hierarchidb/common-types';
import type { PluginManifest } from '@hierarchidb/plugin-service-api';

export const PLUGIN_ID = '@hierarchidb/resolver-plugin' as const;
export const PLUGIN_VERSION = '1.0.0' as const;
export const PLUGIN_DESCRIPTION = 'Resolver node type plugin for property mapping between different data schemas' as const;
export const PLUGIN_NODE_TYPE = 'resolver' as NodeType;

export const PLUGIN_MANIFEST: PluginManifest = {
  id: PLUGIN_ID,
  name: 'Resolver Plugin',
  displayName: 'Resolver',
  nodeType: PLUGIN_NODE_TYPE,
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  priority: 60,
  dependencies: [],
  icon: {
    mui: 'Extension',
    emoji: '🧩',
    color: '#ffb3c1',
    component: {
      specifier: '@hierarchidb/resolver-plugin/icon',
      exportName: 'ResolverPluginIcon',
    },
  },
  category: {
    id: 'data',
    treeId: '*',
    menuGroup: 'tabular',
    createOrder: 60,
  },
  tags: ['mapping', 'schema'],
  capabilities: {
    relationalData: true,
  },
  database: {
    prewarm: [
      {
        specifier: '@hierarchidb/resolver-plugin/database',
        export: 'resolverDB',
      },
    ],
  },
  worker: {
    preload: ['registerResolverWorkerStores', 'loadResolverEntitiesDbModule'],
  },
};

export type ResolverPluginManifest = typeof PLUGIN_MANIFEST;
