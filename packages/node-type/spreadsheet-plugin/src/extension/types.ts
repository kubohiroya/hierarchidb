/**
  * : Spreadsheet
 * : any
 * :
 * : TypeScript
  */

type BaseFolderFields = {
  id: string;
  nodeId: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
};
import type { DataSourceType } from './constants.js';

// =========================================
// =========================================

/**
  * :
 * :
 * :
  */
export interface DataSourceConfig {
  /**
      */
  type: DataSourceType;
  /**
   * URLURL
   */
  source?: string;
  /**
   * CSV:
   */
  delimiter?: string;
  /**
      */
  hasHeader?: boolean;
}

/**
  * :
 * :
 * : File API
  */
export interface FileInfo {
  /**
      */
  name: string;
  /**
      */
  size: number;
  /**
   * MIME
   */
  type: string;
  /**
      */
  lastModified: number;
}

// =========================================
// =========================================

/**
  * :
 * :
 * :
  */
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null';

/**
  * :
 * :
 * :
  */
export interface RowFilter {
  /**
   * ID
   */
  id: string;
  /**
      */
  column: string;
  /**
      */
  operator: FilterOperator;
  /**
      */
  value: unknown;
  /**
   * /
   */
  enabled: boolean;
}

/**
  * : /
 * :
 * : UI
  */
export interface ColumnFilter {
  /**
      */
  name: string;
  /**
   * /
   */
  visible: boolean;
  /**
      */
  order?: number;
}

/**
  * :
 * :
 * :
  */
export interface FilterConfig {
  /**
      */
  rows: RowFilter[];
  /**
      */
  columns: ColumnFilter[];
}

// =========================================
// =========================================

/**
  * SpreadsheetEntity: Spreadsheet
 * : FolderEntity
 * :
  */
export interface SpreadsheetExtendedFields {
  /**
   * ID
   */
  spreadsheetMetadataId?: string;
  /**
      */
  dataSource: DataSourceConfig;
  /**
      */
  filters?: FilterConfig;
}

/**
  * SpreadsheetEntity: Spreadsheet
 * : FolderEntity
 * :
  */
export interface SpreadsheetEntity extends BaseFolderFields, SpreadsheetExtendedFields {
  //  FolderEntity:
  // - nodeId, name, description
  // - settings, statistics, tags, metadata
  // - createdAt, updatedAt, version

  //  SpreadsheetExtendedFields:
  // - spreadsheetMetadataId, dataSource, filters
}

/**
  * SpreadsheetWorkingCopy:
 * Working Copy:
 * : Working Copy
  */
export interface SpreadsheetWorkingCopy extends SpreadsheetEntity {
  /**
      */
  isDraft: boolean;
  /**
   * ID
   */
  originalId?: string;
  /**
      */
  workingCopyCreatedAt?: number;
  /**
      */
  changes?: {
    dataSourceChanged?: boolean;
    filtersChanged?: boolean;
    metadataChanged?: boolean;
  };
}

// =========================================
// =========================================

/**
  * :
 * :
 * :
  */
export interface ValidationResult {
  /**
   * /
   */
  isValid: boolean;
  /**
      */
  errors: string[];
  /**
      */
  warnings?: string[];
}

/**
  * :
 * :
 * :
  */
export interface SpreadsheetFormData {
  /**
   * FolderEntity
   */
  name?: string;
  description?: string;

  /**
   * Spreadsheet
   */
  dataSource?: DataSourceConfig;
  file?: FileInfo;
  filters?: FilterConfig;

  /**
      */
  [key: string]: unknown;
}
