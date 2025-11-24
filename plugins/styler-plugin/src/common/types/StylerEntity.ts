import type { TreeNode } from '@hierarchidb/common-types';
import type { SpreadsheetEntity } from '@hierarchidb/spreadsheet-plugin';
import type { MapLibreStyle } from '@hierarchidb/ui-map';
import type { DialogProgressState, DialogWindowState } from '@hierarchidb/plugin-service-api';
import type { StylerConfig } from './stylerTypes.js';

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
    maplibreStyleSpec: MapLibreStyle | Record<string, unknown>;
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
 * : StylerDraft
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

export type StylerNodePayload = {
  data?: StylerEntity | null | undefined;
  dialogWindow?: DialogWindowState | null;
  dialogProgress?: DialogProgressState | null;
  updatedAt?: number;
};

export type StylerTreeNode = TreeNode<StylerNodePayload>;
