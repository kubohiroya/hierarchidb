/**
  * @file definition.ts
 * @description Styler plugin extension definition
 * : Styler
 * : spreadsheetStep5-6
 * : ExtendingNodeTypeDefinition
  */

// import type { ExtendedPluginDefinition } from '@hierarchidb/common-type';

// Define base entity types since they're not exported
interface SpreadsheetEntity {
  id: string;
  nodeId: string;
  name: string;
  description?: string;
  spreadsheetMetadataId?: string;
  dataSource?: any;
  filters?: any[];
  createdAt: number;
  updatedAt: number;
  version: number;
}

import type { StylerConfig } from '../types/stylerTypes.js';
import { StylerStep5Definition } from '../components/steps/StylerStep5.js';
import { StylerStep6Definition } from '../components/steps/StylerStep6.js';

/**
  * : StylerEntity
 * : SpreadsheetEntity
  */
interface StylerExtendedFields {
  //  Styler
  stylerConfig: StylerConfig;
  selectedKeyColumn?: string;
  selectedValueColumn?: string;

  generatedStyle?: {
    maplibreStyleSpec: any;
    colorMapping: Record<string, string>;
    lastUpdated: number;
  };
}

/**
  * : StylerEntity
 * : SpreadsheetEntity
  */
export interface StylerEntity extends SpreadsheetEntity, StylerExtendedFields {
  //  SpreadsheetEntity:
  // - FolderEntity fields (id, nodeId, name, description, etc.)
  // - spreadsheetMetadataId, dataSource, filters
  //  StylerExtendedFields:
  // - stylerConfig, selectedKeyColumn, selectedValueColumn, generatedStyle
}

/**
  * : StylerWorkingCopy
 * : Working Copy
  */
// Working copies are managed by runtime-worker PeerStore; no dedicated type here.

/**
  * : Styler
 * : ExtendingNodeTypeDefinition
 * : spreadsheet-plugin -> folder-plugin -> base 3
 * :
  */
// Export as a simple object, not as ExtendedPluginDefinition
export const StylerExtension = {
  extends: 'spreadsheet',
  //  :
  nodeType: 'styler',
  name: 'Styler',
  displayName: 'スタイルマップ',

  //  : Step 5Step 6
  //  spreadsheetStep 1-4
  extendedSteps: [
    {
      stepNumber: 5,
      title: 'Style Mapping Configuration',
      component: StylerStep5Definition.component,
      validation: StylerStep5Definition.validation,
    },
    {
      stepNumber: 6,
      title: 'Preview with Style Mapping',
      component: StylerStep6Definition.component,
      validation: StylerStep6Definition.validation,
    },
  ],

  //  : Styler
  extendedFields: [
    {
      name: 'stylerConfig',
      type: 'object',
      required: true,
      label: 'Style Mapping Configuration',
      description: 'MapLibre style mapping configuration',
    },
    {
      name: 'selectedKeyColumn',
      type: 'string',
      required: false,
      label: 'Key Column',
      description: 'Selected key column for mapping',
    },
    {
      name: 'selectedValueColumn',
      type: 'string',
      required: true,
      label: 'Value Column',
      description: 'Selected value column for color mapping',
    },
    {
      name: 'generatedStyle',
      type: 'object',
      required: false,
      label: 'Generated Style',
      description: 'Generated MapLibre style specification',
    },
  ],

  //  : Styler
  extendedValidation: {
    extendedRules: {
      styleConfigRule: {
        validate: (data: any) => {
          const config = data.stylerConfig;
          return config && config.targetProperty && config.mapping;
        },
        message: 'スタイルマッピング設定が必要です',
      },

      valueColumnRule: {
        validate: (data: any) => {
          return !!data.selectedValueColumn;
        },
        message: '値列の選択が必要です',
      },

      mappingRangeRule: {
        validate: (data: any) => {
          const mapping = data.stylerConfig?.mapping;
          if (!mapping) return true;
          return mapping.min < mapping.max;
        },
        message: '最大値は最小値より大きい値を設定してください',
      },
    },
    chainMode: 'all',
    mergeStrategy: 'append',
  },
};
