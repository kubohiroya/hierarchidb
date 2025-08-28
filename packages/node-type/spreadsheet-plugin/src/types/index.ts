/**
 * @file types/index.ts
 * @description Type definitions for Spreadsheet plugin entities
 */

import type { NodeId, EntityId } from '@hierarchidb/common-core';

// ============================================================================
// Raw File Metadata (PersistentRelationalEntity)
// ============================================================================

/**
 * 【機能概要】: 読み込まれたファイルの元データ情報
 * 【実装方針】: PersistentRelationalEntityとして"rawFileMetadata"テーブルに保存
 * 【テスト対応】: ファイル読み込み時のメタデータ保存確認
 * 🟢 信頼性レベル: ファイル管理の基盤データ
 */
export interface RawFileMetadata {
  id: EntityId;
  fileName: string;
  originalUrl?: string; // ダウンロード元URL（URL読み込みの場合）
  fileSize: number; // バイト数
  contentHash: string; // ファイル内容のハッシュ値
  mimeType: string;
  encoding: string;
  
  // CSV解析設定
  parsingConfig: {
    delimiter: string;
    quoteChar: string;
    escapeChar: string;
    hasHeader: boolean;
    skipEmptyLines: boolean;
  };
  
  // 統計情報
  totalRows: number;
  totalColumns: number;
  chunkCount: number;
  
  // タイムスタンプ
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
 * 【機能概要】: パース済み行データのチャンク（バイナリ化済み）
 * 【実装方針】: PersistentRelationalEntityとして"rowChunks"テーブルに保存
 * 【テスト対応】: チャンクサイズ、バイナリ化、復元処理の確認
 * 🟡 信頼性レベル: バイナリシリアライゼーション要検証
 */
export interface RowChunk {
  id: EntityId;
  rawFileMetadataId: EntityId; // RawFileMetadataへの参照
  chunkIndex: number; // チャンクの順序（0から開始）
  
  // バイナリデータ
  binaryData: ArrayBuffer; // 行データをバイナリ化したもの
  rowCount: number; // このチャンクに含まれる行数
  startRowIndex: number; // 全体での開始行インデックス
  endRowIndex: number; // 全体での終了行インデックス
  
  // チャンク統計
  compressedSize: number; // バイナリデータのサイズ
  originalSize: number; // 元データのサイズ推定値
  
  // タイムスタンプ
  createdAt: number;
  updatedAt: number;
  version: number;
}

// ============================================================================
// Spreadsheet Entity (PersistentPeerEntity)
// ============================================================================

/**
 * 【機能概要】: SpreadsheetノードのメインEntity（TreeNodeと紐づき）
 * 【実装方針】: PersistentPeerEntityとしてフォルダ継承 + Spreadsheet機能
 * 【テスト対応】: フォルダ機能 + CSV機能の統合テスト
 * 🟢 信頼性レベル: フォルダベース + CSV拡張
 */
export interface SpreadsheetEntity {
  id: EntityId;
  nodeId: NodeId;
  
  // 基本情報
  name: string;
  description?: string;
  
  // フォルダ継承設定（フォルダ機能を保持）
  settings: SpreadsheetSettings;
  metadata: Record<string, any>;
  
  // Spreadsheet固有プロパティ
  rawFileMetadataId?: EntityId; // RawFileMetadataへの参照
  
  // 現在のデータ状態
  currentFilterState: {
    rowFilters: SpreadsheetRowFilter[];
    columnFilters: SpreadsheetColumnFilter[];
    isFiltered: boolean;
    filteredRowCount: number;
    filteredColumnCount: number;
  };
  
  // 統計情報
  statistics: {
    originalRowCount: number;
    originalColumnCount: number;
    currentRowCount: number;
    currentColumnCount: number;
    totalDataSize: number;
    lastFilteredAt?: number;
  };
  
  // タイムスタンプ
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * 【機能概要】: Spreadsheet設定（フォルダ設定を拡張）
 * 【実装方針】: フォルダ機能 + CSV処理設定の統合
 */
export interface SpreadsheetSettings {
  // フォルダ継承設定
  allowNestedFolders: boolean;
  maxDepth: number;
  sortOrder: 'name' | 'date' | 'size';
  
  // Spreadsheet固有設定
  csv: {
    maxChunkSize: number; // チャンクあたりの最大行数
    enableCompression: boolean; // バイナリ圧縮有効化
    autoTypeDetection: boolean; // 列型自動検出
    cacheStrategy: 'memory' | 'disk' | 'hybrid'; // キャッシュ戦略
  };
  
  // フィルタ設定
  filters: {
    maxConcurrentFilters: number; // 同時適用可能フィルタ数
    enableRegexFilters: boolean; // 正規表現フィルタ有効化
    enableDateRangeFilters: boolean; // 日付範囲フィルタ有効化
  };
  
  // 表示設定
  display: {
    maxPreviewRows: number; // プレビュー最大行数
    enableVirtualScrolling: boolean; // 仮想スクロール有効化
    defaultColumnWidth: number; // デフォルト列幅
  };
}

// ============================================================================
// Spreadsheet Row (PersistentRelationalEntity)
// ============================================================================

/**
 * 【機能概要】: フィルタ適用済みの行データ
 * 【実装方針】: PersistentRelationalEntityとして"spreadsheetRow"テーブルに保存
 * 【テスト対応】: フィルタ適用、カラム絞り込みの確認テスト
 * 🟢 信頼性レベル: フィルタリング結果の永続化
 */
export interface SpreadsheetRow {
  id: EntityId;
  spreadsheetEntityId: EntityId; // SpreadsheetEntityへの参照
  originalRowIndex: number; // 元データでの行インデックス
  
  // 行データ（可変長配列）
  cellValues: (string | number | null)[]; // 現在選択されているカラムの値
  columnMapping: number[]; // 元データでのカラムインデックスのマッピング
  
  // フィルタ情報
  matchedFilters: string[]; // この行にマッチしたフィルタのID
  filterScore: number; // フィルタマッチスコア（ソート用）
  
  // タイムスタンプ
  createdAt: number;
  updatedAt: number;
  version: number;
}

// ============================================================================
// Filter Types
// ============================================================================

/**
 * 【機能概要】: 行フィルタ定義
 * 【実装方針】: 複数条件のAND/OR組み合わせ対応
 * 🟢 信頼性レベル: 豊富なフィルタオペレータ
 */
export interface SpreadsheetRowFilter {
  id: string;
  name: string;
  enabled: boolean;
  
  conditions: RowFilterCondition[];
  logicalOperator: 'AND' | 'OR'; // 条件間の結合方法
  
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
 * 【機能概要】: カラムフィルタ定義
 * 【実装方針】: 表示カラムの選択・順序変更対応
 * 🟢 信頼性レベル: カラム表示制御
 */
export interface SpreadsheetColumnFilter {
  id: string;
  name: string;
  enabled: boolean;
  
  selectedColumns: ColumnSelection[];
  columnOrder: number[]; // 表示順序
  
  createdAt: number;
  updatedAt: number;
}

export interface ColumnSelection {
  originalIndex: number; // 元データでのカラムインデックス
  displayName: string; // 表示名（変更可能）
  dataType: 'string' | 'number' | 'date' | 'boolean';
  visible: boolean;
  width?: number; // 表示幅
}

// ============================================================================
// Working Copy Types
// ============================================================================

/**
 * 【機能概要】: SpreadsheetEntityのWorkingCopy
 * 【実装方針】: フォルダWorkingCopyを拡張
 */
export interface SpreadsheetEntityWorkingCopy extends SpreadsheetEntity {
  copiedAt: number;
  originalNodeId?: NodeId;
  originalVersion?: number;
  hasEntityCopy?: boolean;
  entityWorkingCopyId?: EntityId;
  hasGroupEntityCopy?: Record<string, boolean>;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * 【機能概要】: バイナリデータのシリアライゼーション形式
 * 【実装方針】: 効率的なバイナリ形式の定義
 * 🟡 信頼性レベル: カスタムバイナリ形式、互換性要検証
 */
export interface ChunkBinaryFormat {
  version: number; // フォーマットバージョン
  compression: 'none' | 'gzip' | 'lz4'; // 圧縮方式
  encoding: 'utf8' | 'binary'; // エンコーディング
  columnTypes: ('string' | 'number' | 'date' | 'boolean')[]; // 各カラムの型情報
  rowData: ArrayBuffer; // 実際の行データ
}

/**
 * 【機能概要】: パフォーマンス統計情報
 * 【実装方針】: チャンク処理、フィルタ処理のパフォーマンス監視
 * 🟡 信頼性レベル: パフォーマンス監視機能
 */
export interface ProcessingStats {
  chunkProcessingTime: number; // チャンク処理時間（ミリ秒）
  filterApplicationTime: number; // フィルタ適用時間（ミリ秒）
  binarySerializationTime: number; // バイナリ化時間（ミリ秒）
  memoryUsage: number; // メモリ使用量（バイト）
  diskUsage: number; // ディスク使用量（バイト）
}