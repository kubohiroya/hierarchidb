import type { NodeType } from '@hierarchidb/core-types';
import type { PluginManifest } from '@hierarchidb/plugin-base';

export const PLUGIN_ID = '@hierarchidb/route-plugin' as const;
export const PLUGIN_VERSION = '1.0.0' as const;
export const PLUGIN_DESCRIPTION = 'Route management plugin extending Shape plugin for HierarchiDB' as const;
export const PLUGIN_NODE_TYPE = 'route' as NodeType;

export const PLUGIN_MANIFEST: PluginManifest = {
  id: PLUGIN_ID,
  name: 'Route Plugin',
  displayName: 'Route',
  nodeType: PLUGIN_NODE_TYPE,
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  i18nNamespace: 'route-plugin',
  stepTitleKeys: {
    '1': 'basicInfo',
    '2': 'dataSource',
    '3': 'routeConfig',
    '4': 'processing',
    '5': 'stage',
    '6': 'preview',
  },
  extends: 'shape',
  dependencies: ['shape'],
  icon: {
    mui: 'Route',
    emoji: '〰️',
    color: '#a3b030',
    component: {
      specifier: '@hierarchidb/route-plugin/icon',
      exportName: 'RoutePluginIcon',
    },
  },
  category: {
    id: 'geographic',
    menuGroup: 'geo',
    createOrder: 60,
  },
  database: {
    dbName: 'route',
    tableName: 'features',
    version: 3,
    schema: {
      fields: [
        { name: 'id', indexed: true },
        { name: 'nodeId', indexed: true },
        { name: 'startLocationId', indexed: true },
        { name: 'endLocationId', indexed: true },
        { name: 'transportMode', indexed: true },
        { name: 'processingStatus', indexed: true },
        { name: 'createdAt', indexed: true },
        { name: 'updatedAt', indexed: true },
      ],
    },
  },
  worker: {
    preload: ['registerRouteWorkerStores'],
  },
};

export type RoutePluginManifest = typeof PLUGIN_MANIFEST;
