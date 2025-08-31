/**
 * 【型定義ファイル】: Spreadsheet拡張の型定義
 * 【設計方針】: 型安全性を最大化し、any型を排除
 * 【保守性】: 型定義の一元管理により変更影響を最小化
 * 🟢 信頼性レベル: TypeScriptベストプラクティスに基づく
 */

import type { FolderEntity } from '@hierarchidb/folder-plugin';
import type { DataSourceType } from './constants';

// =========================================
// データソース関連の型
// =========================================

/**
 * 【データソース設定型】: データ取得元の設定構造
 * 【型安全性】: 厳密な型定義によりランタイムエラーを防止
 * 🟢 信頼性レベル: 設計文書に基づく
 */
export interface DataSourceConfig {
  /** データソースの種類 */
  type: DataSourceType;
  /** データソースのURL（URLタイプの場合） */
  source?: string;
  /** CSVデリミタ（デフォルト: カンマ） */
  delimiter?: string;
  /** ヘッダー行の有無 */
  hasHeader?: boolean;
}

/**
 * 【ファイル情報型】: アップロードファイルの情報
 * 【セキュリティ】: 必要最小限の情報のみ保持
 * 🟢 信頼性レベル: File API仕様に基づく
 */
export interface FileInfo {
  /** ファイル名 */
  name: string;
  /** ファイルサイズ（バイト） */
  size: number;
  /** MIMEタイプ */
  type: string;
  /** 最終更新日時 */
  lastModified: number;
}

// =========================================
// フィルタ関連の型
// =========================================

/**
 * 【フィルタ演算子型】: フィルタリングで使用可能な演算子
 * 【拡張性】: 新しい演算子の追加が容易
 * 🟡 信頼性レベル: 一般的なフィルタリングパターンから推測
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
 * 【行フィルタ型】: 行データのフィルタ条件
 * 【機能性】: 柔軟なフィルタリング条件を表現
 * 🟡 信頼性レベル: 一般的なデータフィルタリングパターン
 */
export interface RowFilter {
  /** フィルタID（ユニーク識別子） */
  id: string;
  /** 対象カラム名 */
  column: string;
  /** フィルタ演算子 */
  operator: FilterOperator;
  /** 比較値 */
  value: unknown;
  /** フィルタ有効/無効 */
  enabled: boolean;
}

/**
 * 【列フィルタ型】: 表示/非表示列の設定
 * 【ユーザビリティ】: 列の表示制御を簡潔に表現
 * 🟡 信頼性レベル: UI要件から推測
 */
export interface ColumnFilter {
  /** カラム名 */
  name: string;
  /** 表示/非表示 */
  visible: boolean;
  /** 表示順序 */
  order?: number;
}

/**
 * 【フィルタ設定型】: 行と列のフィルタ設定全体
 * 【構造化】: フィルタ設定を論理的にグループ化
 * 🟢 信頼性レベル: エンティティ設計に基づく
 */
export interface FilterConfig {
  /** 行フィルタのリスト */
  rows: RowFilter[];
  /** 列フィルタのリスト */
  columns: ColumnFilter[];
}

// =========================================
// エンティティ関連の型
// =========================================

/**
 * 【SpreadsheetEntity拡張フィールド型】: Spreadsheet固有のフィールド
 * 【継承】: FolderEntityに追加されるフィールドを定義
 * 🟢 信頼性レベル: エンティティ設計文書に基づく
 */
export interface SpreadsheetExtendedFields {
  /** 表データのメタデータID（オプション） */
  spreadsheetMetadataId?: string;
  /** データソース設定（必須） */
  dataSource: DataSourceConfig;
  /** フィルタ設定（オプション） */
  filters?: FilterConfig;
}

/**
 * 【SpreadsheetEntity型】: 完全なSpreadsheetエンティティ
 * 【型合成】: FolderEntityと拡張フィールドを合成
 * 🟢 信頼性レベル: プラグイン拡張仕様に基づく
 */
export interface SpreadsheetEntity extends FolderEntity, SpreadsheetExtendedFields {
  // FolderEntityから継承:
  // - nodeId, name, description
  // - settings, statistics, tags, metadata
  // - createdAt, updatedAt, version
  
  // SpreadsheetExtendedFieldsから追加:
  // - spreadsheetMetadataId, dataSource, filters
}

/**
 * 【SpreadsheetWorkingCopy型】: 編集用ワーキングコピー
 * 【Working Copyパターン】: 編集中の一時的な状態を管理
 * 🟢 信頼性レベル: Working Copyパターンに基づく
 */
export interface SpreadsheetWorkingCopy extends SpreadsheetEntity {
  /** ドラフト状態フラグ */
  isDraft: boolean;
  /** オリジナルエンティティのID */
  originalId?: string;
  /** ワーキングコピー作成日時 */
  workingCopyCreatedAt?: number;
  /** 変更追跡 */
  changes?: {
    dataSourceChanged?: boolean;
    filtersChanged?: boolean;
    metadataChanged?: boolean;
  };
}

// =========================================
// バリデーション関連の型
// =========================================

/**
 * 【バリデーション結果型】: バリデーション実行結果
 * 【エラーハンドリング】: 詳細なエラー情報を提供
 * 🟢 信頼性レベル: プラグイン拡張仕様に基づく
 */
export interface ValidationResult {
  /** バリデーション成功/失敗 */
  isValid: boolean;
  /** エラーメッセージのリスト */
  errors: string[];
  /** 警告メッセージのリスト（オプション） */
  warnings?: string[];
}

/**
 * 【フォームデータ型】: ダイアログフォームのデータ構造
 * 【型安全性】: フォームデータの構造を明確に定義
 * 🟡 信頼性レベル: 一般的なフォーム構造から推測
 */
export interface SpreadsheetFormData {
  /** 基本情報（FolderEntityから） */
  name?: string;
  description?: string;
  
  /** Spreadsheet固有情報 */
  dataSource?: DataSourceConfig;
  file?: FileInfo;
  filters?: FilterConfig;
  
  /** メタデータ */
  [key: string]: unknown;
}