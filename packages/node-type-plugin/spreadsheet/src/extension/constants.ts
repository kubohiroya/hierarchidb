/**
 * 【定数定義ファイル】: Spreadsheet拡張の共通定数
 * 【設計方針】: マジックナンバー・文字列を集約し、保守性を向上
 * 【セキュリティ】: 検証パターンとエラーメッセージの一元管理
 * 🟢 信頼性レベル: ベストプラクティスに基づく実装
 */

// =========================================
// プラグインメタデータ
// =========================================

/**
 * 【プラグイン基本情報】: UIに表示される情報の定数化
 * 【保守性】: 表示文字列の一元管理により変更が容易
 * 🟢 信頼性レベル: 設計文書に基づく
 */
export const PLUGIN_METADATA = {
  NODE_TYPE: 'spreadsheet',
  NAME: 'Spreadsheet',
  DISPLAY_NAME: 'スプレッドシート',
  ICON: 'table_chart',
  COLOR: '#2196F3', // Material Design blue[500]
  EXTENDS: 'folder',
} as const;

// =========================================
// ステップ定義
// =========================================

/**
 * 【ステップ設定】: マルチステップダイアログの構成定数
 * 【拡張性】: ステップ追加時の影響を最小化
 * 🟢 信頼性レベル: 仕様書に基づく
 */
export const STEP_CONFIG = {
  DATA_SOURCE: {
    NUMBER: 2,
    TITLE: 'データソース選択',
  },
  FILTERING: {
    NUMBER: 3,
    TITLE: 'フィルタリング',
    IS_OPTIONAL: true,
    DEPENDS_ON: [2],
  },
} as const;

// =========================================
// データソースタイプ
// =========================================

/**
 * 【データソースタイプ】: 許可されるデータソースの種類
 * 【型安全性】: as constによる厳密な型定義
 * 🟢 信頼性レベル: 設計仕様に基づく
 */
export const DATA_SOURCE_TYPES = {
  FILE: 'file',
  URL: 'url',
  MANUAL: 'manual',
} as const;

export type DataSourceType = typeof DATA_SOURCE_TYPES[keyof typeof DATA_SOURCE_TYPES];

// =========================================
// ファイル形式
// =========================================

/**
 * 【ファイル拡張子】: サポートするファイル形式の定義
 * 【セキュリティ】: 許可される拡張子を明示的に制限
 * 🟢 信頼性レベル: implementation-guide.mdに基づく
 */
export const SUPPORTED_FILE_EXTENSIONS = [
  '.csv',
  '.tsv',
  '.xlsx',
  '.xls',
] as const;

/**
 * 【ファイル検証パターン】: 拡張子検証用の正規表現
 * 【パフォーマンス】: 事前コンパイルによる高速化
 * 【セキュリティ】: 大文字小文字を無視した厳密な検証
 * 🟢 信頼性レベル: セキュリティベストプラクティスに基づく
 */
export const FILE_VALIDATION_PATTERN = /\.(csv|tsv|xlsx?)$/i;

/**
 * 【ファイルサイズ制限】: アップロード可能な最大ファイルサイズ
 * 【パフォーマンス】: メモリ使用量の制限
 * 【ユーザビリティ】: 現実的な制限値の設定
 * 🟡 信頼性レベル: 一般的なベストプラクティスから推測
 */
export const FILE_SIZE_LIMITS = {
  MAX_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
  MAX_SIZE_LABEL: '100MB',
} as const;

// =========================================
// フィールド定義
// =========================================

/**
 * 【フィールド名】: エンティティフィールドの名前定数
 * 【保守性】: フィールド名の一元管理
 * 🟢 信頼性レベル: エンティティ設計に基づく
 */
export const FIELD_NAMES = {
  SPREADSHEET_METADATA_ID: 'spreadsheetMetadataId',
  DATA_SOURCE: 'dataSource',
  FILTERS: 'filters',
} as const;

/**
 * 【フィールドラベル】: UIに表示されるラベル
 * 【国際化対応】: 将来的なi18n対応を考慮
 * 🟢 信頼性レベル: UI仕様に基づく
 */
export const FIELD_LABELS = {
  SPREADSHEET_METADATA_ID: 'メタデータID',
  DATA_SOURCE: 'データソース',
  FILTERS: 'フィルタ設定',
} as const;

/**
 * 【フィールド説明】: フィールドの用途説明
 * 【ユーザビリティ】: ユーザーへの分かりやすい説明
 * 🟢 信頼性レベル: UI仕様に基づく
 */
export const FIELD_DESCRIPTIONS = {
  SPREADSHEET_METADATA_ID: '表データのメタデータへの参照ID',
  DATA_SOURCE: 'データの取得元（ファイル、URL、手動入力）',
  FILTERS: '行と列のフィルタリング設定',
} as const;

// =========================================
// エラーメッセージ
// =========================================

/**
 * 【エラーメッセージ】: バリデーションエラー時のメッセージ
 * 【ユーザビリティ】: 明確で実行可能な指示を提供
 * 【国際化対応】: 将来的なi18n対応を考慮した構造
 * 🟢 信頼性レベル: UXベストプラクティスに基づく
 */
export const ERROR_MESSAGES = {
  DATA_SOURCE_REQUIRED: 'データソースを選択してください',
  FILE_REQUIRED: 'ファイルを選択してください',
  INVALID_FILE_FORMAT: 'CSV、TSV、またはExcelファイルを選択してください',
  FILE_TOO_LARGE: `ファイルサイズが${FILE_SIZE_LIMITS.MAX_SIZE_LABEL}を超えています`,
  INVALID_DATA_SOURCE_TYPE: '無効なデータソースタイプです',
  FILTER_INVALID: 'フィルタ設定が不正です',
} as const;

// =========================================
// バリデーション設定
// =========================================

/**
 * 【バリデーション設定】: 拡張バリデーションの設定値
 * 【拡張性】: 新しいバリデーションルール追加を容易に
 * 🟢 信頼性レベル: プラグイン拡張仕様に基づく
 */
export const VALIDATION_CONFIG = {
  CHAIN_MODE: 'all' as const,
  MERGE_STRATEGY: 'append' as const,
} as const;