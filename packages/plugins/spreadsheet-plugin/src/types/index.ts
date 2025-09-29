/**
 * @file types/index.ts
 * @description Type definitions for Spreadsheet plugin entities
 */

import type { NodeId } from '@hierarchidb/common-type';

// ============================================================================
// Raw File Metadata (PersistentRelationalEntity)
// ============================================================================

/**
  * :
 * : PersistentRelationalEntity"rawFileMetadata"
 * :
 * :
  */
export interface RawFileMetadata {
  id: NodeId;
  fileName: string;
  originalUrl?: string; //  URLURL
  fileSize: number;
  contentHash: string;
  mimeType: string;
  encoding: string;

  //  CSV
  parsingConfig: {
    delimiter: string;
    quoteChar: string;
    escapeChar: string;
    hasHeader: boolean;
    skipEmptyLines: boolean;
  };

  totalRows: number;
  totalColumns: number;
  chunkCount: number;

  uploadedAt: number;
  parsedAt: number;
  createdAt: number;
  updatedAt: number;
  version: number;
}

// ============================================================================
// Row Chunk (PersistentRelationalEntity)
// ============================================================================

/**
  * :
 * : PersistentRelationalEntity"rowChunks"
 * :
 * :
  */
export interface RowChunk {
  id: NodeId;
  rawFileMetadataId: NodeId; //  RawFileMetadata
  chunkIndex: number; //  0

  binaryData: ArrayBuffer;
  rowCount: number;
  startRowIndex: number;
  endRowIndex: number;
  compressedSize: number;
  originalSize: number;
  createdAt: number;
  updatedAt: number;
  version: number;
}

// ============================================================================
// Spreadsheet Entity (PersistentPeerEntity)
// ============================================================================

/**
  * : SpreadsheetEntityTreeNode
 * : PersistentPeerEntity + Spreadsheet
 * : + CSV
 * : + CSV
  */
export interface SpreadsheetEntity {
  id: NodeId;
  nodeId: NodeId;

  name: string;
  description?: string;

  settings: SpreadsheetSettings;
  metadata: Record<string, any>;

  //  Spreadsheet
  rawFileMetadataId?: NodeId; //  RawFileMetadata

  currentFilterState: {
    rowFilters: SpreadsheetRowFilter[];
    columnFilters: SpreadsheetColumnFilter[];
    isFiltered: boolean;
    filteredRowCount: number;
    filteredColumnCount: number;
  };

  statistics: {
    originalRowCount: number;
    originalColumnCount: number;
    currentRowCount: number;
    currentColumnCount: number;
    totalDataSize: number;
    lastFilteredAt?: number;
  };

  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * Peer payload persisted in peerEntities for spreadsheet nodes.
 * Maintains schemaVersion for forward-compatible migrations.
 */
export interface SpreadsheetPeerData {
  schemaVersion: 1;
  lastViewedSheet?: {
    sheetId?: NodeId;
    scrollTop?: number;
    scrollLeft?: number;
  };
  metadata?: Record<string, unknown>;
}

/**
  * : Spreadsheet
 * : + CSV
  */
export interface SpreadsheetSettings {
  allowNestedFolders: boolean;
  maxDepth: number;
  sortOrder: 'name' | 'date' | 'size';

  //  Spreadsheet
  csv: {
    maxChunkSize: number;
    enableCompression: boolean;
    autoTypeDetection: boolean;
    cacheStrategy: 'memory' | 'disk' | 'hybrid';
  };

  filters: {
    maxConcurrentFilters: number; enableRegexFilters: boolean; enableDateRangeFilters: boolean;
  };

  display: {
    maxPreviewRows: number; enableVirtualScrolling: boolean; defaultColumnWidth: number;
  };
}

// ============================================================================
// Spreadsheet Row (PersistentRelationalEntity)
// ============================================================================

/**
  * :
 * : PersistentRelationalEntity"spreadsheetRow"
 * :
 * :
  */
export interface SpreadsheetRow {
  id: NodeId;
  spreadsheetEntityId: NodeId; //  SpreadsheetEntity
  originalRowIndex: number;
  cellValues: (string | number | null)[];
  columnMapping: number[];
  matchedFilters: string[]; //  ID
  filterScore: number;
  createdAt: number;
  updatedAt: number;
  version: number;
}

// ============================================================================
// Filter Types
// ============================================================================

/**
  * :
 * : AND/OR
 * :
  */
export interface SpreadsheetRowFilter {
  id: string;
  name: string;
  enabled: boolean;

  conditions: RowFilterCondition[];
  logicalOperator: 'AND' | 'OR';
  createdAt: number;
  updatedAt: number;
}

export interface RowFilterCondition {
  columnIndex: number;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' |
    'starts_with' | 'ends_with' | 'greater_than' | 'less_than' |
    'greater_equal' | 'less_equal' | 'is_null' | 'is_not_null' | 'regex';
  value: string | number | null;
  caseSensitive?: boolean;
}

/**
  * :
 * :
 * :
  */
export interface SpreadsheetColumnFilter {
  id: string;
  name: string;
  enabled: boolean;

  selectedColumns: ColumnSelection[];
  columnOrder: number[];
  createdAt: number;
  updatedAt: number;
}

export interface ColumnSelection {
  originalIndex: number;
  displayName: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  visible: boolean;
  width?: number;
}

// Working copies are managed by runtime-worker PeerStore; no dedicated types here.

// ============================================================================
// Utility Types
// ============================================================================

/**
  * :
 * :
 * :
  */
export interface ChunkBinaryFormat {
  version: number;
  compression: 'none' | 'gzip' | 'lz4';
  encoding: 'utf8' | 'binary';
  columnTypes: ('string' | 'number' | 'date' | 'boolean')[];
  rowData: ArrayBuffer;
}

/**
  * :
 * :
 * :
  */
export interface ProcessingStats {
  chunkProcessingTime: number;
  filterApplicationTime: number;
  binarySerializationTime: number;
  memoryUsage: number;
  diskUsage: number;
}

export type { SpreadsheetGroupItemData, SpreadsheetRelationMeta } from './entities.js';
