import type { PluginMetadata, NodeType } from '@hierarchidb/common-types';

export const PLUGIN_ID = '@hierarchidb/plugin-loader-basemap-plugin' as const;
export const PLUGIN_VERSION = '1.0.0' as const;
export const PLUGIN_DESCRIPTION = 'BaseMap Plugin for HierarchiDB - Geographic base layer configuration and management' as const;
export const PLUGIN_NODE_TYPE = 'basemap' as NodeType;

export const PLUGIN_MANIFEST: PluginMetadata = {
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
  },
  category: 'geographic',
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
      {
        name: 'displayOptions',
        type: 'object',
        required: false,
      },
    ],
  },
};

export type BaseMapPluginManifest = typeof PLUGIN_MANIFEST;
