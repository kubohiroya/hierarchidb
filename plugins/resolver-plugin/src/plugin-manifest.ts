import type { NodeType } from '@hierarchidb/core-types';
import type { PluginManifest } from '@hierarchidb/plugin-base';

export const PLUGIN_ID = '@hierarchidb/resolver-plugin' as const;
export const PLUGIN_VERSION = '1.0.0' as const;
export const PLUGIN_DESCRIPTION =
  'Resolver node type plugin for property mapping between different data schemas' as const;
export const PLUGIN_NODE_TYPE = 'resolver' as NodeType;

export const PLUGIN_MANIFEST: PluginManifest = {
  id: PLUGIN_ID,
  name: 'Resolver Plugin',
  displayName: 'Resolver',
  nodeType: PLUGIN_NODE_TYPE,
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  i18nNamespace: 'resolver-plugin',
  stepTitleKeys: {
    '1': 'basicInfo',
    '2': 'schemaSelection',
    '3': 'propertyMapping',
    '4': 'validationRules',
    '5': 'duplicateResolution',
    '6': 'stage',
    '7': 'previewTest',
  },
  priority: 60,
  extends: 'folder',
  dependencies: ['folder'],
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
    dbName: 'resolver-db',
    tableName: 'resolvers',
    version: 1,
    schema: {
      fields: [
        { name: 'id', indexed: true },
        { name: 'nodeId', indexed: true },
        { name: 'name', indexed: true },
      ],
    },
  },
  worker: {
    preload: ['registerResolverWorkerStores'],
  },
};

export type ResolverPluginManifest = typeof PLUGIN_MANIFEST;
