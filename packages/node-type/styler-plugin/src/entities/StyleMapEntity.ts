import type { NodeId, EntityId } from '@hierarchidb/common-type';

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

// 【Spreadsheetプラグイン完成前の暫定型定義】
// SpreadsheetEntityの仮定義（実装完成後に正式import予定）
export interface SpreadsheetEntity {
  // FolderEntityから継承される基本フィールド
  id: EntityId;
  nodeId: NodeId;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  version: number;

  // SpreadsheetEntityの拡張フィールド（暫定）
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

// 【色変換で使用する型定義群】
// extension/definition.tsから移行
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
 * 【型定義】: StylerEntityの完全な型定義
 * 【実装方針】: SpreadsheetEntityを継承してスタイル情報を追加
 * 【継承関係】: SpreadsheetEntity -> FolderEntity -> BaseEntity
 * 🟢 信頼性レベル: プラグイン拡張仕様準拠
 */
//import type { SpreadsheetEntity } from '@hierarchidb/spreadsheet-plugin';
import type { StylerConfig } from '../types/stylerTypes';

// 【色変換で使用する型定義群】
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
 * 【型定義】: StylerEntityの完全な型定義
 * 【実装方針】: SpreadsheetEntityを継承してスタイル情報を追加
 * 【継承関係】: SpreadsheetEntity -> FolderEntity -> BaseEntity
 * 🟢 信頼性レベル: プラグイン拡張仕様準拠
 */
export interface StylerEntity extends SpreadsheetEntity {
  // SpreadsheetEntityから継承される全フィールド (実際に含まれる)
  // - id: EntityId (PeerEntityから)
  // - nodeId: NodeId (PeerEntityから)
  // - name: string (SpreadsheetEntityで定義)
  // - description?: string (SpreadsheetEntityで定義)
  // - createdAt, updatedAt, version: number (PeerEntityから)
  // - spreadsheetMetadataId?: string (SpreadsheetEntityで定義)
  // - dataSource: object (SpreadsheetEntityで定義)
  // - filters?: object (SpreadsheetEntityで定義)

  // Styler固有のフィールド
  stylerConfig: StylerConfig;
  selectedKeyColumn?: string;
  selectedValueColumn?: string;

  // 生成されたスタイル情報（オプション）
  generatedStyle?: {
    maplibreStyleSpec: any;
    colorMapping: Record<string, string>;
    lastUpdated: number;
  };

  // 後方互換性のための旧フィールド（deprecatedマーク）
  /** @deprecated Use stylerConfig instead */
  keyColumn?: string;
  /** @deprecated Use stylerConfig instead */
  colorRules?: StylerColorRule[];
  /** @deprecated Use stylerConfig instead */
  defaultStyle?: StylerStyle;
}

/**
 * 【型定義】: StylerWorkingCopyの型定義
 * 🟢 信頼性レベル: Working Copyパターン準拠
 */
export interface StylerWorkingCopy extends StylerEntity {
  isDraft: boolean;
  originalId?: string;
  copiedAt: number;
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
