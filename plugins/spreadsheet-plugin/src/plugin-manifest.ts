import type { NodeType } from '@hierarchidb/common-types';
import type { PluginMetadata } from '@hierarchidb/plugin-service-api';

export const PLUGIN_ID = '@hierarchidb/spreadsheet-plugin' as const;
export const PLUGIN_VERSION = '0.0.1' as const;
export const PLUGIN_DESCRIPTION = 'Spreadsheet plugin for HierarchiDB - extends folder plugin' as const;
export const PLUGIN_NODE_TYPE = 'spreadsheet' as NodeType;

export const PLUGIN_MANIFEST: PluginMetadata = {
  id: PLUGIN_ID,
  name: 'Spreadsheet Plugin',
  displayName: 'Spreadsheet',
  nodeType: PLUGIN_NODE_TYPE,
  version: PLUGIN_VERSION,
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
  database: {
    prewarm: [
      {
        specifier: '@hierarchidb/spreadsheet-plugin/database',
        export: 'SpreadsheetDatabase',
      },
    ],
  },
  worker: {
    preload: ['registerSpreadsheetWorkerStores', 'loadSpreadsheetEntitiesDbModule'],
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
        name: 'spreadsheetData',
        type: 'object',
        required: true,
      },
      {
        name: 'formulas',
        type: 'object',
        required: false,
      },
    ],
  },
};

export type SpreadsheetPluginManifest = typeof PLUGIN_MANIFEST;
