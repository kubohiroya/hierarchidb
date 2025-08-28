/**
 * @file utils/index.ts
 * @description ユーティリティ関数の統一エクスポート
 * Re-exports all utility functions for easy imports in test and implementation files
 */

// 【バイナリシリアライゼーション関数】: テストで参照される主要関数群 🟢
export {
  serializeRowsToArrayBuffer,
  deserializeRowsFromArrayBuffer,
  getBinaryFormatInfo,
  calculateCompressionRatio,
  measureSerializationPerformance,
} from './binarySerializer';

// 【ハッシュ計算関数】: ファイル整合性チェック 🟢
export {
  calculateFileHash,
  calculateTextHash,
  calculateBufferHash,
  calculateCombinedHash,
  compareHashes,
  getShortHash,
} from './hashUtils';

// 【CSVパース関数】: CSV解析と型検出 🟢
export { parseCSVContent, detectColumnTypes } from './csvParser';

// 【ファイル処理関数】: Excel/ZIP処理 🟡
export {
  processExcelFile,
  processZipFile,
  detectFileTypeFromContent,
  getExtensionFromMimeType,
  formatFileSize,
  detectCSVDelimiter,
} from './fileProcessingUtils';

// 【フィルタ関数】: CSVフィルタ適用 🟢
export { applyCsvFilters, validateFilterRules, getFilterStatistics } from './filterUtils';
