import { toNodeType } from '@hierarchidb/common-types';
import type { PluginManifest } from '@hierarchidb/plugin-service-api';

export const PLUGIN_ID = '@hierarchidb/basemap-plugin' as const;
export const PLUGIN_VERSION = '1.0.0' as const;
export const PLUGIN_DESCRIPTION =
  'BaseMap Plugin for HierarchiDB - Geographic base layer configuration and management' as const;
export const PLUGIN_NODE_TYPE = toNodeType('basemap');

export const PLUGIN_MANIFEST: PluginManifest = {
  id: PLUGIN_ID,
  name: 'BaseMap Plugin',
  displayName: 'BaseMap',
  nodeType: PLUGIN_NODE_TYPE,
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  extends: 'folder',
  priority: 900,
  dependencies: ['folder'],
  icon: {
    mui: 'Public',
    emoji: '🌍',
    color: '#b0b3d9',
    component: {
      specifier: '@hierarchidb/basemap-plugin/icon',
      exportName: 'BasemapPluginIcon',
    },
  },
  category: {
    id: 'geographic',
    menuGroup: 'base',
    createOrder: 900,
  },
  capabilities: {
    canHaveChildren: true,
    canBeRoot: false,
    canBeDeleted: true,
    canBeRenamed: true,
    canBeMoved: true,
    canBeCopied: true,
  },
  schema: {
    inherits: 'folder',
    fields: [
      {
        name: 'mapStyle',
        type: 'object',
        required: true,
      },
      {
        name: 'viewport',
        type: 'object',
        required: true,
      },
    ],
  },
  database: {
    prewarm: [
      {
        specifier: '@hierarchidb/basemap-plugin/worker-database',
        export: 'BasemapEntitiesDB',
      },
    ],
  },
  worker: {
    preload: ['registerBasemapWorkerStores', 'loadBasemapEntitiesDbModule'],
  },
};

export type BaseMapPluginManifest = typeof PLUGIN_MANIFEST;
