/**
  * : Spreadsheet
 * : folder
 * : TC-101-001 TC-101-010
 * : EXTENDING_FOLDER_PLUGIN.md
  */

// Avoid cross-package type dependency to keep d.ts bundling simple
type BaseFolderFields = {
  id: string;
  nodeId: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
};

//  Step
// import { DataSourceStep } from '../steps/DataSourceStep.js';
// import { FilteringStep } from '../steps/FilteringStep.js';

/**
  * : SpreadsheetEntity
 * :
  */
interface SpreadsheetExtendedFields {
  spreadsheetMetadataId?: string;
  dataSource: {
    type: 'file' | 'url' | 'manual';
    source?: string;
    delimiter?: string;
    hasHeader?: boolean;
  };
  filters?: {
    rows: any[];
    columns: any[];
  };
}

/**
  * : SpreadsheetEntity
 * : FolderEntity
  */
export interface SpreadsheetEntity extends BaseFolderFields, SpreadsheetExtendedFields {
  //  FolderEntity: id, nodeId, name, description, createdAt, updatedAt, version
  //  SpreadsheetExtendedFields: spreadsheetMetadataId, dataSource, filters
}

/**
  * : SpreadsheetWorkingCopy
 * : Working Copy
  */
export interface SpreadsheetWorkingCopy extends SpreadsheetEntity {
  isDraft: boolean;
  originalId?: string;
  copiedAt: number;
}

/**
  * : Spreadsheet
 * : ExtendableNodeTypeDefinition
 * : TC-101-001TC-101-010
 * : EXTENDING_FOLDER_PLUGIN.md
  */
export const SpreadsheetExtension = {
  //  : folder
  extends: 'folder',

  //  :
  nodeType: 'spreadsheet',
  name: 'Spreadsheet',
  displayName: 'Spreadsheet',
  icon: 'table_chart', //  : Material Icon
  color: '#2196F3', //  : Material Designblue[500]

  //  : SpreadSheet
  extendedFields: [
    {
      name: 'spreadsheetMetadataId',
      type: 'string',
      required: false,
      label: 'Spreadsheet Metadata ID',
      description: 'Internal metadata identifier',
    },
    {
      name: 'dataSource',
      type: 'object',
      required: true,
      label: 'Data Source',
      description: 'Data source configuration',
    },
    {
      name: 'filters',
      type: 'object',
      required: false,
      label: 'Filters',
      description: 'Row and column filtering configuration',
    },
  ],

  //  : SpreadSheet
  extendedValidation: {
    extendedRules: {
      fileFormatRule: {
        validate: (data: any) => {
          const fileName = data.dataSource?.source || data.file?.name;
          if (!fileName) return true;
          const lowerFileName = fileName.toLowerCase();
          const supportedExtensions = ['.csv', '.tsv', '.xlsx', '.xls'];
          return supportedExtensions.some((ext) => lowerFileName.endsWith(ext));
        },
        message: 'Choose a CSV, TSV, or Excel file',
      },
    },
    chainMode: 'all',
    mergeStrategy: 'append',
  },

};
