/**
 * @file index.ts
 * @description StyleMap plugin services export
 * 【統合方針】: SpreadsheetCSVApiDriverを共通実装として使用
 */

// NOTE: SpreadsheetCSVApiDriverは直接@hierarchidb/spreadsheet-pluginからインポートしてください

// StyleMap固有のサービス
export { SimpleTableMetadataManager } from './SimpleTableMetadataManager';
export { StyleMapDataService } from './StyleMapDataService';