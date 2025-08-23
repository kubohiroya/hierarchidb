/**
 * @file types.ts
 * @description Type definitions for Spreadsheet plugin entities
 */

import type { NodeId } from '@hierarchidb/00-core';

// DOM types for TypeScript 4.9 compatibility
declare global {
  interface File extends Blob {
    readonly lastModified: number;
    readonly name: string;
    readonly webkitRelativePath: string;
  }
  interface FileReader extends EventTarget {
    readonly error: DOMException | null;
    readonly readyState: number;
    readonly result: string | ArrayBuffer | null;
    readonly EMPTY: number;
    readonly LOADING: number;
    readonly DONE: number;
    readAsArrayBuffer(file: Blob): void;
    readAsBinaryString(file: Blob): void;
    readAsDataURL(file: Blob): void;
    readAsText(file: Blob, encoding?: string): void;
    abort(): void;
    onload: ((ev: ProgressEvent<FileReader>) => any) | null;
    onerror: ((ev: ProgressEvent<FileReader>) => any) | null;
  }
  interface Crypto {
    randomUUID(): string;
  }
  var crypto: Crypto;
}

// Define entity base types locally since core doesn't export them yet
interface PersistentRelationalEntity {
  createdAt: number;
  updatedAt: number;
  version: number;
}

interface PersistentPeerEntity {
  nodeId: NodeId;
  createdAt: number;
  updatedAt: number;
  version: number;
}

// ============================================================================
// Brand Types
// ============================================================================

/**
 * Brand type for SpreadsheetMetadata ID
 */
export type SpreadsheetMetadataId = string & { 
  readonly __brand: 'SpreadsheetMetadataId' 
};

/**
 * Brand type for SpreadsheetChunk ID
 */
export type SpreadsheetChunkId = string & {
  readonly __brand: 'SpreadsheetChunkId'
};

// ============================================================================
// Entity Types
// ============================================================================

/**
 * Spreadsheet metadata - shared data (no nodeId)
 * Extends PersistentRelationalEntity
 */
export interface SpreadsheetMetadata extends PersistentRelationalEntity {
  // Identification
  id: SpreadsheetMetadataId;
  
  // Metadata
  name: string;                // File name or table name
  description?: string;        // Table description
  
  // Content identification
  contentHash: string;         // SHA-256 hash for deduplication
  
  // Spreadsheet info
  columns: string[];           // Column names
  rowCount: number;           // Total rows
  totalRows: number;          // Alias for rowCount (backward compatibility)
  totalChunks: number;        // Number of data chunks
  columnCount: number;        // Total columns
  fileSize: number;           // Original file size in bytes
  referenceCount?: number;    // Reference count (optional)
  
  // Format info
  originalFormat: 'csv' | 'tsv' | 'excel' | 'json';
  delimiter: string;          // Default: '\t'
  hasHeader: boolean;         // Has header row
  encoding: string;           // Character encoding
  
  // Statistics (optional)
  stats?: {
    numericColumns: string[];  // Numeric type columns
    dateColumns: string[];     // Date type columns
    textColumns: string[];     // Text type columns
  };
  
  // Timestamps (no nodeId!)
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
}

/**
 * Spreadsheet data chunks - compressed data blocks
 */
export interface SpreadsheetChunk {
  id: SpreadsheetChunkId;
  metadataId: SpreadsheetMetadataId;  // Reference to metadata
  chunkIndex: number;                  // Chunk sequence number
  compressedData: Uint8Array;         // Compressed data (pako)
  rowStart: number;                    // Start row index
  rowEnd: number;                      // End row index
  sizeBytes: number;                   // Compressed size
  firstRowPreview?: string;            // Debug preview
  
  // Additional properties needed by ChunkManager
  startRowIndex: number;               // Alias for rowStart
  endRowIndex: number;                 // Alias for rowEnd
  compressedSize: number;              // Alias for sizeBytes
  uncompressedSize: number;            // Size before compression
  contentHash: string;                 // Content hash for deduplication
  lastAccessedAt: number;              // Last access timestamp
}

/**
 * Spreadsheet reference - links node to metadata
 * Extends PersistentPeerEntity
 */
export interface SpreadsheetRefEntity extends PersistentPeerEntity {
  // Entity reference fields (following EntityReferenceHints conventions)
  nodeId: NodeId;                      // nodeRefField (デフォルト)
  metadataId: SpreadsheetMetadataId;   // relRefField (カスタマイズ)
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  version: number;
}

// ============================================================================
// Data Types
// ============================================================================

/**
 * Single row of spreadsheet data
 */
export type SpreadsheetRow = Record<string, unknown>;

/**
 * Import result containing parsed data
 */
export interface SpreadsheetImportResult {
  headers: string[];
  rows: SpreadsheetRow[];
  totalRows: number;
  format: 'csv' | 'tsv' | 'excel' | 'json';
  originalSize: number;
}

/**
 * Import options for file loading
 */
export interface SpreadsheetImportOptions {
  name?: string;
  description?: string;
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: string;
  sheet?: number | string;
  sheetName?: string;                 // Sheet name for Excel files
  skipEmptyLines?: boolean;           // Skip empty lines during parsing
}

/**
 * Filter options for querying data
 */
export interface SpreadsheetFilterOptions {
  conditions?: Record<string, {
    operator: FilterOperator;
    value: unknown;
    maxValue?: unknown;
  }>;
}

// ============================================================================
// Filter Types
// ============================================================================

export type FilterOperator = 
  | 'equals' 
  | 'not_equals'
  | 'contains' 
  | 'not_contains'
  | 'starts_with' 
  | 'ends_with'
  | 'startsWith'           // Alternative form
  | 'endsWith'             // Alternative form
  | 'regex'
  | 'greater_than' 
  | 'less_than'
  | 'greaterThan'          // Alternative form
  | 'lessThan'             // Alternative form
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'is_null'
  | 'is_not_null'
  | 'isEmpty'              // Alternative form
  | 'isNotEmpty';          // Alternative form

export interface FilterRule {
  column: string;
  operator: FilterOperator;
  value: string | number | boolean | null;
  caseSensitive?: boolean;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface FilterCache {
  id: string;
  metadataId: SpreadsheetMetadataId;
  filterHash: string;
  rules: FilterRule[];
  matchedRows: number[];
  resultCount: number;
  createdAt: number;
  lastUsed: number;
  expiresAt: number;
}

export interface ColumnIndex {
  id: string;
  metadataId: SpreadsheetMetadataId;
  column: string;
  uniqueValues: string[];
  valueToRows: Record<string, number[]>;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'mixed';
  stats?: {
    min?: number | string;
    max?: number | string;
    mean?: number;
    nullCount: number;
  };
  createdAt: number;
}

// ============================================================================
// Import/Export Types
// ============================================================================

export interface ImportOptions {
  source: 'file' | 'url' | 'clipboard';
  file?: File;
  url?: string;
  clipboardData?: string;
  delimiter?: string;
  hasHeaders?: boolean;
  encoding?: string;
  sheet?: number | string;  // For Excel files
}

export interface ExportOptions {
  format: 'csv' | 'tsv' | 'excel' | 'json';
  delimiter?: string;
  includeHeaders?: boolean;
  columns?: string[];        // Specific columns to export
  filters?: FilterRule[];    // Apply filters before export
}

export interface LoadResult {
  data: string[][];
  headers: string[];
  format: 'csv' | 'tsv' | 'excel' | 'json';
  originalSize: number;
  rowCount: number;
  columnCount: number;
}

// ============================================================================
// Query Types
// ============================================================================

export interface QueryOptions {
  limit?: number;
  offset?: number;
  useCache?: boolean;
  cacheResults?: boolean;
  progressCallback?: (progress: number) => void;
}

export interface QueryResult {
  rows: string[][];
  totalMatches: number;
  fromCache: boolean;
  queryTime: number;
}

export interface PreviewData {
  metadataId: SpreadsheetMetadataId;
  sampleRows: string[][];
  filteredSample?: string[][];
  statistics: {
    totalRows: number;
    totalColumns: number;
    uniqueKeyValues?: number;
    columnsInfo: Record<string, ColumnInfo>;
  };
}

export interface ColumnInfo {
  type: 'string' | 'number' | 'boolean' | 'date' | 'mixed';
  nullCount: number;
  uniqueCount: number;
  sampleValues: (string | number | boolean | null)[];
  min?: number | string;
  max?: number | string;
}

// ============================================================================
// Error Types
// ============================================================================

export enum SpreadsheetErrorCode {
  // Import errors (1xxx)
  FILE_TOO_LARGE = 1001,
  INVALID_FORMAT = 1002,
  ENCODING_ERROR = 1003,
  PARSE_ERROR = 1004,
  UNSUPPORTED_FORMAT = 1005,
  IMPORT_FAILED = 1006,
  
  // Storage errors (2xxx)
  METADATA_NOT_FOUND = 2001,
  CHUNK_NOT_FOUND = 2002,
  REFERENCE_NOT_FOUND = 2003,
  STORAGE_ERROR = 2004,
  
  // Processing errors (3xxx)
  FILTER_ERROR = 3001,
  INDEX_BUILD_ERROR = 3002,
  EXPORT_ERROR = 3003,
  COMPRESSION_ERROR = 3004,
  
  // Network errors (4xxx)
  FETCH_ERROR = 4001,
  TIMEOUT_ERROR = 4002,
  NETWORK_ERROR = 4003,
}

// Additional string-based error codes for backward compatibility
export const SpreadsheetErrorCodes = {
  ...SpreadsheetErrorCode,
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT' as const,
  IMPORT_FAILED: 'IMPORT_FAILED' as const,
  NETWORK_ERROR: 'NETWORK_ERROR' as const,
  PARSE_ERROR: 'PARSE_ERROR' as const,
} as const;

export class SpreadsheetError extends Error {
  public timestamp: number;
  
  constructor(
    public code: SpreadsheetErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SpreadsheetError';
    this.timestamp = Date.now();
  }
}

// Additional exports for missing types
export type SpreadsheetExportOptions = ExportOptions;
export type SpreadsheetImportError = SpreadsheetError;
export type SpreadsheetFilterCondition = FilterRule;

// Legacy aliases for backwards compatibility
export type CSVStorageError = SpreadsheetError;
export type CSVStorageErrorCode = SpreadsheetErrorCode;