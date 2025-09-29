/**
  * : Spreadsheet
 * :
 * :
 * :
  */

// =========================================
// =========================================

import { PLUGIN_MANIFEST } from './plugin-manifest.js';

/**
  * Plugin metadata bridge (legacy fields kept for incremental migration)
  */
export const PLUGIN_METADATA = {
  NODE_TYPE: PLUGIN_MANIFEST.nodeType,
  NAME: PLUGIN_MANIFEST.name,
  DISPLAY_NAME: PLUGIN_MANIFEST.displayName ?? PLUGIN_MANIFEST.name,
  ICON: PLUGIN_MANIFEST.icon?.mui ?? PLUGIN_MANIFEST.icon?.muiIconName ?? 'table_chart',
  COLOR: PLUGIN_MANIFEST.icon?.color ?? '#2196F3',
  EXTENDS: PLUGIN_MANIFEST.extends ?? 'folder',
} as const;

// =========================================
// =========================================

/**
  * :
 * :
 * :
  */
export const STEP_CONFIG = {
  DATA_SOURCE: {
    NUMBER: 2,
    TITLE: 'Data Source Selection',
  },
  FILTERING: {
    NUMBER: 3,
    TITLE: 'Filtering',
    IS_OPTIONAL: true,
    DEPENDS_ON: [2],
  },
} as const;

// =========================================
// =========================================

/**
  * :
 * : as const
 * :
  */
export const DATA_SOURCE_TYPES = {
  FILE: 'file',
  URL: 'url',
  MANUAL: 'manual',
} as const;

export type DataSourceType = typeof DATA_SOURCE_TYPES[keyof typeof DATA_SOURCE_TYPES];

// =========================================
// =========================================

/**
  * :
 * :
 * : implementation-guide.md
  */
export const SUPPORTED_FILE_EXTENSIONS = [
  '.csv',
  '.tsv',
  '.xlsx',
  '.xls',
] as const;

/**
  * :
 * :
 * :
 * :
  */
export const FILE_VALIDATION_PATTERN = /\.(csv|tsv|xlsx?)$/i;

/**
  * :
 * :
 * :
 * :
  */
export const FILE_SIZE_LIMITS = {
  MAX_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
  MAX_SIZE_LABEL: '100MB',
} as const;

// =========================================
// =========================================

/**
  * :
 * :
 * :
  */
export const FIELD_NAMES = {
  SPREADSHEET_METADATA_ID: 'spreadsheetMetadataId',
  DATA_SOURCE: 'dataSource',
  FILTERS: 'filters',
} as const;

/**
  * : UI
 * : i18n
 * : UI
  */
export const FIELD_LABELS = {
  SPREADSHEET_METADATA_ID: 'Metadata ID',
  DATA_SOURCE: 'Data Source',
  FILTERS: 'Filter Configuration',
} as const;

/**
  * :
 * :
 * : UI
  */
export const FIELD_DESCRIPTIONS = {
  SPREADSHEET_METADATA_ID: 'Reference identifier for the parsed table metadata',
  DATA_SOURCE: 'Source configuration for the spreadsheet data (file, URL, or manual input)',
  FILTERS: 'Row and column filtering configuration applied to the dataset',
} as const;

// =========================================
// =========================================

/**
  * :
 * :
 * : i18n
 * : UX
  */
export const ERROR_MESSAGES = {
  DATA_SOURCE_REQUIRED: 'Select a data source',
  FILE_REQUIRED: 'Select a file to continue',
  INVALID_FILE_FORMAT: 'Choose a CSV, TSV, or Excel file',
  FILE_TOO_LARGE: `File size exceeds ${FILE_SIZE_LIMITS.MAX_SIZE_LABEL}`,
  INVALID_DATA_SOURCE_TYPE: 'Invalid data source type',
  FILTER_INVALID: 'Filter configuration is invalid',
} as const;

// =========================================
// =========================================

/**
  * :
 * :
 * :
  */
export const VALIDATION_CONFIG = {
  CHAIN_MODE: 'all' as const,
  MERGE_STRATEGY: 'append' as const,
} as const;
