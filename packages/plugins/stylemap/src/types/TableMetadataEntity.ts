/**
 * @file TableMetadataEntity.ts
 * @description Table metadata and row entity type definitions for StyleMap data storage
 * Implements normalized table design for hierarchidb
 * References:
 * - docs/spec/plugin-stylemap-requirements.md (REQ-002)
 * - ../eria-cartograph/app0/src/domains/resources/stylemap/types/TableMetadataEntity.ts
 */

import type { UUID, TreeNodeId } from '@hierarchidb/core';
import { generateUUID } from '@hierarchidb/core';

/**
 * Column metadata information
 */
export interface ColumnMetadata {
  /** Column name */
  name: string;
  /** Column data type */
  type: 'string' | 'number' | 'boolean' | 'date';
  /** Whether column contains null values */
  hasNulls: boolean;
  /** Unique value count (for categorical analysis) */
  uniqueCount: number;
  /** Sample values (up to 10) */
  sampleValues: Array<string | number>;
  /** Statistics for numeric columns */
  statistics?: {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
  };
}

/**
 * Table metadata entity
 * Stores structure and metadata about imported CSV/TSV tables
 */
export interface TableMetadataEntity {
  /** Unique table identifier */
  tableId: UUID;
  /** Associated StyleMap node ID */
  nodeId: TreeNodeId;
  /** Original filename */
  filename: string;
  /** File format */
  format: 'csv' | 'tsv' | 'excel';
  /** File size in bytes */
  fileSize: number;
  /** File encoding */
  encoding: string;
  /** SHA3-256 hash of file content */
  contentHash: string;

  // Table structure
  /** Column definitions */
  columns: ColumnMetadata[];
  /** Total number of rows (excluding header) */
  rowCount: number;
  /** Estimated memory size in bytes */
  estimatedSize: number;

  // Processing metadata
  /** Whether table has been fully processed */
  isProcessed: boolean;
  /** Processing errors if any */
  processingErrors?: string[];
  /** Processing warnings */
  processingWarnings?: string[];

  // Timestamps
  /** When the table was imported */
  importedAt: number;
  /** When the table was last accessed */
  lastAccessedAt: number;
}

/**
 * Row entity for storing table data
 * Stores individual rows of table data
 */
export interface RowEntity {
  /** Unique row identifier */
  rowId: UUID;
  /** Associated table ID */
  tableId: UUID;
  /** Row index (0-based) */
  rowIndex: number;
  /** Row data as JSON array */
  rowData: Array<string | number | null>;
  /** Optional row-level metadata */
  metadata?: {
    /** Whether row was filtered out */
    isFiltered?: boolean;
    /** Filter rules that matched this row */
    matchedRules?: string[];
    /** Validation errors for this row */
    validationErrors?: string[];
  };
}

/**
 * Table data summary for quick access
 */
export interface TableDataSummary {
  tableId: UUID;
  nodeId: TreeNodeId;
  filename: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  sampleRows: Array<Array<string | number | null>>;
  processingStatus: 'pending' | 'processing' | 'completed' | 'error';
}

/**
 * Table import result
 */
export interface TableImportResult {
  metadata: TableMetadataEntity;
  rowCount: number;
  warnings: string[];
  errors: string[];
}

/**
 * Table query options
 */
export interface TableQueryOptions {
  /** Limit number of rows returned */
  limit?: number;
  /** Skip number of rows */
  offset?: number;
  /** Filter by column values */
  filters?: Record<string, string | number>;
  /** Sort by column */
  sortBy?: string;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Include only specific columns */
  columns?: string[];
}

/**
 * Table query result
 */
export interface TableQueryResult {
  rows: Array<Array<string | number | null>>;
  totalRows: number;
  columns: string[];
  hasMore: boolean;
}

/**
 * Create table metadata entity
 */
export function createTableMetadataEntity(
  nodeId: TreeNodeId,
  filename: string,
  data: {
    format: 'csv' | 'tsv' | 'excel';
    fileSize: number;
    encoding: string;
    contentHash: string;
    columns: ColumnMetadata[];
    rowCount: number;
  }
): TableMetadataEntity {
  const now = Date.now();

  // Estimate memory size based on data
  const estimatedSize = data.columns.reduce((total: number, col) => {
    const avgValueSize =
      col.sampleValues.reduce(
        (sum: number, val) => sum + (val !== null ? String(val).length : 0),
        0
      ) / Math.max(col.sampleValues.length, 1);
    return total + avgValueSize * data.rowCount;
  }, 0);

  return {
    tableId: generateUUID(),
    nodeId,
    filename,
    format: data.format,
    fileSize: data.fileSize,
    encoding: data.encoding,
    contentHash: data.contentHash,
    columns: data.columns,
    rowCount: data.rowCount,
    estimatedSize: Math.round(estimatedSize),
    isProcessed: false,
    importedAt: now,
    lastAccessedAt: now,
  };
}

/**
 * Create row entity
 */
export function createRowEntity(
  tableId: UUID,
  rowIndex: number,
  rowData: Array<string | number | null>
): RowEntity {
  return {
    rowId: generateUUID(),
    tableId,
    rowIndex,
    rowData: [...rowData], // Deep copy to prevent mutations
  };
}

/**
 * Analyze column data to generate metadata
 */
export function analyzeColumnData(
  columnName: string,
  values: Array<string | number | null>
): ColumnMetadata {
  const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');
  const hasNulls = nonNullValues.length < values.length;

  // Determine data type
  let type: ColumnMetadata['type'] = 'string';
  const numericValues: number[] = [];

  for (const value of nonNullValues) {
    const num = Number(value);
    if (!isNaN(num) && isFinite(num)) {
      numericValues.push(num);
    } else if (type === 'string') {
      // Check if it's a date
      const date = new Date(String(value));
      if (!isNaN(date.getTime()) && String(value).match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/)) {
        type = 'date';
      }
    }
  }

  // If more than 80% of values are numeric, consider it a number column
  if (numericValues.length > nonNullValues.length * 0.8 && numericValues.length > 0) {
    type = 'number';
  }

  // Get unique values for categorical analysis
  const uniqueValues = new Set(nonNullValues);
  const uniqueCount = uniqueValues.size;

  // Sample values (up to 10 unique values)
  const sampleValues = Array.from(uniqueValues).slice(0, 10).sort();

  // Calculate statistics for numeric columns
  let statistics: ColumnMetadata['statistics'] | undefined;

  if (type === 'number' && numericValues.length > 0) {
    const sorted = numericValues.sort((a, b) => a - b);
    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / numericValues.length;

    const variance =
      numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length;
    const stdDev = Math.sqrt(variance);

    const midIndex = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? ((sorted[midIndex - 1] ?? 0) + (sorted[midIndex] ?? 0)) / 2
        : (sorted[midIndex] ?? 0);

    statistics = {
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      mean: Number(mean.toFixed(6)),
      median: Number(median.toFixed(6)),
      stdDev: Number(stdDev.toFixed(6)),
    };
  }

  return {
    name: columnName,
    type,
    hasNulls,
    uniqueCount,
    sampleValues: sampleValues as (string | number)[],
    statistics,
  };
}

/**
 * Validate table metadata entity
 */
export function validateTableMetadata(metadata: TableMetadataEntity): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!metadata.tableId) {
    errors.push('Table ID is required');
  }

  if (!metadata.nodeId) {
    errors.push('Node ID is required');
  }

  if (!metadata.filename) {
    errors.push('Filename is required');
  }

  if (!metadata.contentHash) {
    errors.push('Content hash is required');
  }

  // Validate columns
  if (!metadata.columns || metadata.columns.length === 0) {
    errors.push('At least one column is required');
  } else {
    const columnNames = new Set<string>();
    metadata.columns.forEach((col, index) => {
      if (!col.name) {
        errors.push(`Column ${index + 1}: name is required`);
      } else if (columnNames.has(col.name)) {
        errors.push(`Duplicate column name: ${col.name}`);
      } else {
        columnNames.add(col.name);
      }

      if (col.uniqueCount < 0) {
        errors.push(`Column ${col.name}: uniqueCount cannot be negative`);
      }
    });
  }

  // Validate row count
  if (metadata.rowCount < 0) {
    errors.push('Row count cannot be negative');
  }

  // Warnings for potential issues
  if (metadata.rowCount > 100000) {
    warnings.push('Large dataset may impact performance');
  }

  if (metadata.estimatedSize > 50 * 1024 * 1024) {
    // 50MB
    warnings.push('Large estimated size may impact memory usage');
  }

  if (metadata.columns.length > 100) {
    warnings.push('Large number of columns may impact performance');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get table data summary
 */
export function createTableDataSummary(
  metadata: TableMetadataEntity,
  sampleRows: Array<Array<string | number | null>> = []
): TableDataSummary {
  const processingStatus: TableDataSummary['processingStatus'] =
    metadata.processingErrors && metadata.processingErrors.length > 0
      ? 'error'
      : metadata.isProcessed
        ? 'completed'
        : 'pending';

  return {
    tableId: metadata.tableId,
    nodeId: metadata.nodeId,
    filename: metadata.filename,
    rowCount: metadata.rowCount,
    columnCount: metadata.columns.length,
    columns: metadata.columns.map((col) => col.name),
    sampleRows: sampleRows.slice(0, 5), // First 5 rows as sample
    processingStatus,
  };
}
