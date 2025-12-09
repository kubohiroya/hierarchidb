import type { SpreadsheetEntity } from '@hierarchidb/spreadsheet-plugin';
import type { MapLibreStyle } from '@hierarchidb/ui-map';
import type { StylerConfig, StyleType } from './stylerTypes.js';

/**
 * : StylerEntity
 * : SpreadsheetEntity
 * : SpreadsheetEntity -> FolderEntity -> BaseEntity
 * :
 */
export interface StylerEntity extends SpreadsheetEntity {
  //  - spreadsheetMetadataId?: string (SpreadsheetEntity)
  //  - dataSource: object (SpreadsheetEntity)
  //  - filters?: object (SpreadsheetEntity)

  // nodeId?: NodeId;

  //  Styler
  stylerConfig: StylerConfig;
  /** Optional style preset metadata kept alongside the entity */
  styleType?: StyleType;
  colorScheme?: string;
  opacity?: number;
  strokeWidth?: number;
  selectedKeyColumn?: string;
  selectedValueColumn?: string;

  generatedStyle?: {
    maplibreStyleSpec: MapLibreStyle | Record<string, unknown>;
    colorMapping: Record<string, string>;
    lastUpdated: number;
  };

}

/**
 * : StylerDraft
 * : Working Copy
 */
// Working copies are handled by runtime-worker-worker PeerStore; no dedicated type here.

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
