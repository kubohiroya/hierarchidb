/**
 * @file index.ts
 * @description StyleMap plugin services export
 * 【統合方針】: SpreadsheetCSVApiDriverを共通実装として使用
 */

// 【統合】: SpreadsheetCSVApiDriverを共通化として使用
export { SpreadsheetCSVApiDriver } from '@hierarchidb/node-type-spreadsheet-plugin';
export { SpreadsheetCSVApiDriver as StyleMapCSVApiDriver } from '@hierarchidb/node-type-spreadsheet-plugin';

// StyleMap固有のサービス
export { SimpleTableMetadataManager } from './SimpleTableMetadataManager';
export { StyleMapDataService } from './StyleMapDataService';