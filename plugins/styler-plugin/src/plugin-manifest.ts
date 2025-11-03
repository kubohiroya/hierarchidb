import type { NodeType } from '@hierarchidb/common-types';
import type { PluginManifest } from '@hierarchidb/plugin-service-api';

export const PLUGIN_ID = '@hierarchidb/styler-plugin' as const;
export const PLUGIN_VERSION = '1.0.0' as const;
export const PLUGIN_DESCRIPTION =
  'Styler Plugin for HierarchiDB - Dynamic styling for map visualizations' as const;
export const PLUGIN_NODE_TYPE = 'styler' as NodeType;

export const PLUGIN_MANIFEST: PluginManifest = {
  id: PLUGIN_ID,
  name: 'Styler Plugin',
  displayName: 'Styler',
  nodeType: PLUGIN_NODE_TYPE,
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  extends: 'spreadsheet',
  priority: 700,
  dependencies: ['@hierarchidb/spreadsheet-plugin'],
  icon: {
    mui: 'Palette',
    emoji: '🎨',
    color: '#dcbc50',
    component: {
      specifier: '@hierarchidb/styler-plugin/icon',
      exportName: 'StylerPluginIcon',
    },
  },
  category: {
    id: 'visualization',
    menuGroup: 'tabular',
    createOrder: 700,
  },
  capabilities: {
    canHaveChildren: false,
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
        name: 'csvData',
        type: 'string',
        required: true,
      },
      {
        name: 'mappingConfig',
        type: 'object',
        required: true,
      },
    ],
  },
  worker: {
    preload: ['registerStylerWorkerStores', 'loadStylerEntitiesDbModule'],
  },
};

export type StylerPluginManifest = typeof PLUGIN_MANIFEST;
