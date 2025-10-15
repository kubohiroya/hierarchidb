/**
 * @file types/openstreetmap-type.ts
 * @description Type definitions for CSV data extraction system
 */
import {CSVColumnInfo, CSVColumnType, CSVTableMetadata, CSVTableMetadataLike} from '@hierarchidb/tabular-store';

/**
 * CSV Filter Rule for row filtering
 */
/**
 * CSV Filter Operator
 */
export type CSVFilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal'
  | 'less_equal'
  | 'is_null'
  | 'is_not_null'
  | 'regex';

export interface CSVFilterRule {
  /** Unique identifier for this rule */
  id: string;
  /** Column name to filter on */
  column: string;
  /** Filter operator */
  operator: CSVFilterOperator;
  /** Filter value */
  value: string | number;
  /** Whether this rule is enabled */
  enabled: boolean;
}

/**
 * CSV Processing Configuration
 */
export interface CSVProcessingConfig {
  /** Column delimiter */
  delimiter?: ',' | '	' | ';' | '|';
  /** Text encoding */
  encoding?: 'utf-8' | 'shift_jis' | 'euc-jp' | 'iso-8859-1' | 'windows-1252';
  /** Whether the first row contains headers */
  hasHeader?: boolean;
  /** Number of rows to skip from the beginning */
  skipRows?: number;
  /** Maximum number of rows to process (0 = no limit) */
  maxRows?: number;
  /** Quote character for CSV parsing */
  quoteChar?: '"' | '\'' | '';
  /** Escape character */
  escapeChar?: '\\';
  /** Whether to skip empty lines */
  skipEmptyLines?: boolean;
}

/**
 * CSV Selection Configuration
 */
export interface CSVSelectionConfig {
  /** Key column for mapping (primary key) */
  keyColumn?: string;
  /** Value columns to extract */
  valueColumns: string[];
  /** Filter rules to apply */
  filterRules: CSVFilterRule[];
  /** Custom key-value mappings */
  customMappings?: Array<{
    key: string;
    value: string;
    label?: string;
  }>;
}

/**
 * CSV Data Result - filtered and processed data
 */
export interface CSVDataResult {
  /** Column information */
  columns: CSVColumnInfo[];
  /** Data rows as key-value objects */
  rows: Array<Record<string, string | number | null>>;
  /** Total number of rows after filtering */
  totalRows: number;

  /** Whether result is from chunked data */
  isChunked?: boolean;
  /** Chunk information if applicable */
  chunkInfo?: {
    currentChunk: number;
    totalChunks: number;
    chunkSize: number;
  };
}

/**
 * CSV Column Mapping for selection step
 */
export interface CSVColumnMapping {
  /** Source column name */
  sourceColumn: string;
  /** Source column type */
  sourceType: CSVColumnType;
  /** Target column name */
  targetColumn: string;
  /** Target column type */
  targetType: CSVColumnType;
  /** Whether this column is included in output */
  included: boolean;
  /** Display order */
  order: number;
  /** Transform to apply */
  transform: 'none' | 'uppercase' | 'lowercase' | 'trim';
}

/**
 * CSV Extract Result - final result for plugin-loader
 */
export interface CSVExtractResult {
  /** Table metadata ID for reference */
  tableMetadataId: string;
  /** Table metadata */
  metadata: CSVTableMetadata;
  /** Selection configuration */
  selection: CSVSelectionConfig;
  /** Preview data */
  previewData: CSVDataResult;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  /** Offset from start */
  offset: number;
  /** Maximum number of items */
  limit: number;
}

/**
 * CSV Table List Result
 */
export interface CSVTableListResult {
  /** List of tables */
  tables: CSVTableMetadataLike[];
  /** Total number of tables */
  total: number;
}

/**
 * CSV Processing Status
 */
export interface CSVProcessingStatus {
  /** Processing state */
  status: 'pending' | 'processing' | 'completed' | 'error';
  /** Progress percentage (0-100) */
  progress: number;
  /** Error message if status is 'error' */
  error?: string;
  /** Additional processing info */
  info?: string;
}

/**
 * CSV API Interface - must be implemented by plugin-loader
 */
export interface ICSVDataApi {
  /**
   * Upload and process CSV file
   */
  uploadCSVFile(
    file: File,
    config: CSVProcessingConfig,
  ): Promise<CSVTableMetadata>;

  /**
   * Download CSV from URL and process
   */
  downloadCSVFromUrl(
    url: string,
    config: CSVProcessingConfig,
  ): Promise<CSVTableMetadata>;

  /**
   * Get CSV table metadata by ID
   */
  getTableMetadata(id: string): Promise<CSVTableMetadata | null>;

  /**
   * List available CSV tables
   */
  listTables(
    pluginId?: string,
    pagination?: PaginationOptions,
  ): Promise<CSVTableListResult>;

  /**
   * Delete CSV table (force delete, ignoring references)
   */
  deleteTable(tableMetadataId: string): Promise<void>;

  /**
   * Get filtered CSV data preview
   */
  getFilteredPreview(
    tableId: string,
    filters: CSVFilterRule[],
    rowCount: number,
  ): Promise<CSVDataResult>;

  /**
   * Get full filtered dataset
   */
  getFilteredData(
    tableId: string,
    selection: CSVSelectionConfig,
  ): Promise<CSVDataResult>;

  /**
   * Add plugin reference to CSV table (reference counting)
   */
  addTableReference(
    tableId: string,
    pluginId: string,
  ): Promise<void>;

  /**
   * Remove plugin reference from CSV table
   */
  removeTableReference(
    tableId: string,
    pluginId: string,
  ): Promise<void>;

  /**
   * Get processing status for async operations
   */
  getProcessingStatus?(id: string): Promise<CSVProcessingStatus | null>;
}
