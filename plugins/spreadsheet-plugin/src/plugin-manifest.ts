import type { PluginManifest } from '@hierarchidb/plugin-base';
import type { NodeType } from '@hierarchidb/core-types';

export const SPREADSHEET_PLUGIN_ID = '@hierarchidb/spreadsheet-plugin' as const;
export const SPREADSHEET_PLUGIN_VERSION = '0.2.0' as const;
export const SPREADSHEET_NODE_TYPE = 'spreadsheet' as NodeType;

export const PLUGIN_DESCRIPTION =
  'Spreadsheet plugin powered by the shared tabular ingestion stack' as const;

export const PLUGIN_MANIFEST: PluginManifest = {
  id: SPREADSHEET_PLUGIN_ID,
  name: 'Spreadsheet Plugin',
  displayName: 'Spreadsheet',
  nodeType: SPREADSHEET_NODE_TYPE,
  version: SPREADSHEET_PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  extends: 'folder',
  priority: 600,
  dependencies: ['folder'],
  icon: {
    mui: 'Assessment',
    emoji: '📈',
    color: '#dcbc50',
    component: {
      specifier: '@hierarchidb/spreadsheet-plugin/icon',
      exportName: 'SpreadsheetPluginIcon',
    },
  },
  category: {
    id: 'data',
    menuGroup: 'tabular',
    createOrder: 600,
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
        name: 'spreadsheetMetadataId',
        type: 'string',
        required: false,
      },
      {
        name: 'dataSource',
        type: 'object',
        required: false,
      },
      {
        name: 'filters',
        type: 'array',
        required: false,
      },
    ],
  },
  worker: {
    preload: ['registerSpreadsheetWorkerStores'],
  },
};

export type SpreadsheetPluginManifest = typeof PLUGIN_MANIFEST;
