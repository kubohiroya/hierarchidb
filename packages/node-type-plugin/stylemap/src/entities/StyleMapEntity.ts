import type { NodeId } from '@hierarchidb/common-core';

// Define SpreadsheetMetadataId locally since plugin-spreadsheet may not be available
export type SpreadsheetMetadataId = string & { readonly __brand: 'SpreadsheetMetadataId' };

// Define PersistentPeerEntity locally
export interface PersistentPeerEntity {
  nodeId: NodeId;
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * StyleMapEntity - Extends spreadsheet data with visualization configuration
 * Inherits from PeerEntity to link node to spreadsheet metadata
 */
export interface StyleMapEntity extends PersistentPeerEntity {
  nodeId: NodeId;                        // nodeRefField (デフォルト)
  spreadsheetMetadataId: SpreadsheetMetadataId; // relRefField (カスタマイズ)
  
  // Visual mapping configuration
  keyColumn: string;
  colorRules: StyleMapColorRule[];
  defaultStyle: StyleMapStyle;
  
  // Optional metadata
  description?: string;
  
  // Entity metadata
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface StyleMapColorRule {
  column: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'range';
  value: unknown;
  maxValue?: unknown; // For range operator
  style: StyleMapStyle;
  label?: string;
}

export interface StyleMapStyle {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
}