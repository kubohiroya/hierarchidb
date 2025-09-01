/**
 * @file index.ts
 * @description Styler plugin services export
 * 【統合方針】: SpreadsheetCSVApiDriverを共通実装として使用
 */

// NOTE: SpreadsheetCSVApiDriverは直接@hierarchidb/spreadsheet-pluginからインポートしてください

// Styler固有のサービス
export { SimpleTableMetadataManager } from './SimpleTableMetadataManager';
export { StylerDataService } from './StylerDataService';