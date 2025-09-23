/**
  * : Spreadsheet
 * :
 * :
 * :
  */

// =========================================
// =========================================

/**
  * : UI
 * :
 * :
  */
export const PLUGIN_METADATA = {
  NODE_TYPE: 'spreadsheet',
  NAME: 'Spreadsheet',
  DISPLAY_NAME: 'スプレッドシート',
  ICON: 'table_chart',
  COLOR: '#2196F3', // Material Design blue[500]
  EXTENDS: 'folder',
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
    TITLE: 'データソース選択',
  },
  FILTERING: {
    NUMBER: 3,
    TITLE: 'フィルタリング',
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
  SPREADSHEET_METADATA_ID: 'メタデータID',
  DATA_SOURCE: 'データソース',
  FILTERS: 'フィルタ設定',
} as const;

/**
  * :
 * :
 * : UI
  */
export const FIELD_DESCRIPTIONS = {
  SPREADSHEET_METADATA_ID: '表データのメタデータへの参照ID',
  DATA_SOURCE: 'データの取得元（ファイル、URL、手動入力）',
  FILTERS: '行と列のフィルタリング設定',
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
  DATA_SOURCE_REQUIRED: 'データソースを選択してください',
  FILE_REQUIRED: 'ファイルを選択してください',
  INVALID_FILE_FORMAT: 'CSV、TSV、またはExcelファイルを選択してください',
  FILE_TOO_LARGE: `ファイルサイズが${FILE_SIZE_LIMITS.MAX_SIZE_LABEL}を超えています`,
  INVALID_DATA_SOURCE_TYPE: '無効なデータソースタイプです',
  FILTER_INVALID: 'フィルタ設定が不正です',
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