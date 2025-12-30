import type { NodeType } from '@hierarchidb/common-types';
import type { PluginManifest } from '@hierarchidb/plugin-service-api';

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
    prewarm: [
      {
        specifier: '@hierarchidb/route-plugin/database',
        export: 'RouteDB',
      },
    ],
  },
  worker: {
    preload: ['registerRouteWorkerStores'],
  },
};

export type RoutePluginManifest = typeof PLUGIN_MANIFEST;
