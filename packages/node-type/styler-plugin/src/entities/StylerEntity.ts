import type { NodeId } from '@hierarchidb/common-type';
/**
  * : StylerEntity
 * : SpreadsheetEntity
 * : SpreadsheetEntity -> FolderEntity -> BaseEntity
 * :
  */
//import type { SpreadsheetEntity } from '@hierarchidb/node-type-spreadsheet-plugin';
import type { StylerConfig } from '../types/stylerTypes.js';

// Define SpreadsheetMetadataId locally since plugin-spreadsheet-plugin may not be available
export type SpreadsheetMetadataId = string & { readonly __brand: 'SpreadsheetMetadataId' };

// Define PersistentPeerEntity locally
export interface PersistentPeerEntity {
  nodeId: NodeId;
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * StylerEntity - Extends spreadsheet-plugin data with visualization configuration
 * Inherits from PeerEntity to link node to spreadsheet-plugin metadata
 */

//  Spreadsheet
//  SpreadsheetEntityimport
export interface SpreadsheetEntity {
  //  FolderEntity
  id: NodeId;
  nodeId: NodeId;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  version: number;

  //  SpreadsheetEntity
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

//  extension/definition.ts
export interface StylerStyle {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
}

export interface StylerColorRule {
  column: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'range';
  value: unknown;
  maxValue?: unknown; // For range operator
  style: StylerStyle;
  label?: string;
}

export interface StylerStyle {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
}

export interface StylerColorRule {
  column: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'range';
  value: unknown;
  maxValue?: unknown; // For range operator
  style: StylerStyle;
  label?: string;
}

/**
  * : StylerEntity
 * : SpreadsheetEntity
 * : SpreadsheetEntity -> FolderEntity -> BaseEntity
 * :
  */
export interface StylerEntity extends SpreadsheetEntity {
  //  SpreadsheetEntity ()
  //  - id: NodeId (PeerEntity)
  //  - nodeId: NodeId (PeerEntity)
  //  - name: string (SpreadsheetEntity)
  //  - description?: string (SpreadsheetEntity)
  //  - createdAt, updatedAt, version: number (PeerEntity)
  //  - spreadsheetMetadataId?: string (SpreadsheetEntity)
  //  - dataSource: object (SpreadsheetEntity)
  //  - filters?: object (SpreadsheetEntity)

  //  Styler
  stylerConfig: StylerConfig;
  selectedKeyColumn?: string;
  selectedValueColumn?: string;

  generatedStyle?: {
    maplibreStyleSpec: any;
    colorMapping: Record<string, string>;
    lastUpdated: number;
  };

  //  deprecated
  /** @deprecated Use stylerConfig instead */
  keyColumn?: string;
  /** @deprecated Use stylerConfig instead */
  colorRules?: StylerColorRule[];
  /** @deprecated Use stylerConfig instead */
  defaultStyle?: StylerStyle;
}

/**
  * : StylerWorkingCopy
 * : Working Copy
  */
// Working copies are handled by runtime-worker PeerStore; no dedicated type here.

export interface StylerColorRule {
  column: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'range';
  value: unknown;
  maxValue?: unknown; // For range operator
  style: StylerStyle;
  label?: string;
}

export interface StylerStyle {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
}
