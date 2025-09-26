import type { PluginMetadata, NodeType } from '@hierarchidb/common-type';

export const PLUGIN_ID = '@hierarchidb/plugins-shape-plugin' as const;
export const PLUGIN_VERSION = '0.1.0' as const;
export const PLUGIN_DESCRIPTION = 'Geographic shape data management plugin for HierarchiDB' as const;
export const PLUGIN_NODE_TYPE = 'shape' as NodeType;

export const PLUGIN_MANIFEST: PluginMetadata = {
  id: PLUGIN_ID,
  name: 'Shape Plugin',
  displayName: 'Shape',
  nodeType: PLUGIN_NODE_TYPE,
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  extends: 'folder',
  priority: 800,
  dependencies: ['folder'],
  icon: {
    mui: 'Hexagon',
    emoji: '♦️',
    color: '#a3b030',
  },
  category: 'geographic',
  capabilities: {
    canHaveChildren: false,
    canBeRoot: false,
    canBeDeleted: true,
    canBeRenamed: true,
    canBeMoved: true,
    canBeCopied: false,
    supportsBatchProcessing: true,
  },
  schema: {
    inherits: 'folder',
    fields: [
      {
        name: 'dataSourceName',
        type: 'string',
        required: true,
      },
      {
        name: 'selectedCountries',
        type: 'array',
        required: true,
      },
      {
        name: 'selectedAdminLevels',
        type: 'array',
        required: true,
      },
      {
        name: 'licenseAgreement',
        type: 'boolean',
        required: true,
      },
    ],
  },
};

export type ShapePluginManifest = typeof PLUGIN_MANIFEST;
