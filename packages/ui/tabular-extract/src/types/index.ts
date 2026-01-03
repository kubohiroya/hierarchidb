/**
 * @file types/openstreetmap-type.ts
 * @description Type definitions for Tabular data extraction system
 */
import {TabularColumnInfo, TabularColumnType, TabularTableMetadata, TabularTableMetadataLike} from '@hierarchidb/tabular-store';

/**
 * Tabular Filter Rule for row filtering
 */
/**
 * Tabular Filter Operator
 */
export type TabularFilterOperator =
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

export interface TabularFilterRule {
  /** Unique identifier for this rule */
  id: string;
  /** Column name to filter on */
  column: string;
  /** Filter operator */
  operator: TabularFilterOperator;
  /** Filter value */
  value: string | number;
  /** Whether this rule is enabled */
  enabled: boolean;
}

/**
 * Tabular Processing Configuration
 */
export interface TabularProcessingConfig {
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
  /** Quote character for Tabular parsing */
  quoteChar?: '"' | '\'' | '';
  /** Escape character */
  escapeChar?: '\\';
  /** Whether to skip empty lines */
  skipEmptyLines?: boolean;
}

/**
 * Tabular Selection Configuration
 */
export interface TabularSelectionConfig {
  /** Key column for mapping (primary key) */
  keyColumn?: string;
  /** Value columns to extract */
  valueColumns: string[];
  /** Filter rules to apply */
  filterRules: TabularFilterRule[];
  /** Custom key-value mappings */
  customMappings?: Array<{
    key: string;
    value: string;
    label?: string;
  }>;
}

/**
 * Tabular Data Result - filtered and processed data
 */
export interface TabularDataResult {
  /** Column information */
  columns: TabularColumnInfo[];
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
 * Tabular Column Mapping for selection step
 */
export interface TabularColumnMapping {
  /** Source column name */
  sourceColumn: string;
  /** Source column type */
  sourceType: TabularColumnType;
  /** Target column name */
  targetColumn: string;
  /** Target column type */
  targetType: TabularColumnType;
  /** Whether this column is included in output */
  included: boolean;
  /** Display order */
  order: number;
  /** Transform to apply */
  transform: 'none' | 'uppercase' | 'lowercase' | 'trim';
}

/**
 * Tabular Extract Result - final result for plugin-loader
 */
export interface TabularExtractResult {
  /** Table metadata ID for reference */
  tableMetadataId: string;
  /** Table metadata */
  metadata: TabularTableMetadata;
  /** Selection configuration */
  selection: TabularSelectionConfig;
  /** Preview data */
  previewData: TabularDataResult;
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
export interface TabularTableListResult {
  /** List of tables */
  tables: TabularTableMetadataLike[];
  /** Total number of tables */
  total: number;
}

/**
 * CSV Processing Status
 */
export interface TabularProcessingStatus {
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
 * Tabular data API Interface - must be implemented by plugin-loader
 */
export interface TabularDataApi {
  /**
   * Upload and process CSV file
   */
  uploadTabularFile(
    file: File,
    config: TabularProcessingConfig,
  ): Promise<TabularTableMetadata>;

  /**
   * Download CSV from URL and process
   */
  downloadTabularFromUrl(
    url: string,
    config: TabularProcessingConfig,
    nodeId?: string,
  ): Promise<TabularTableMetadata>;

  /**
   * Get CSV table metadata by ID
   */
  getTableMetadata(id: string): Promise<TabularTableMetadata | null>;

  /**
   * List available CSV tables
   */
  listTables(
    pluginId?: string,
    pagination?: PaginationOptions,
  ): Promise<TabularTableListResult>;

  /**
   * Delete CSV table (force delete, ignoring references)
   */
  deleteTable(tableMetadataId: string): Promise<void>;

  /**
   * Get filtered CSV data preview
   */
  getFilteredPreview(
    tableId: string,
    filters: TabularFilterRule[],
    rowCount: number,
  ): Promise<TabularDataResult>;

  /**
   * Get full filtered dataset
   */
  getFilteredData(
    tableId: string,
    selection: TabularSelectionConfig,
  ): Promise<TabularDataResult>;

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
  getProcessingStatus?(id: string): Promise<TabularProcessingStatus | null>;
}
