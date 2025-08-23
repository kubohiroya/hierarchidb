/**
 * Spreadsheet plugin metadata with entity reference hints
 */

import type { PluginMetadata } from '@hierarchidb/00-core';

export const SpreadsheetMetadata: PluginMetadata = {
  id: 'com.hierarchidb.spreadsheet',
  name: 'Spreadsheet',
  nodeType: 'spreadsheet',
  version: '1.0.0',
  description: 'Universal table data processing with Excel/CSV support',
  author: 'HierarchiDB Team',
  status: 'active',
  tags: ['data', 'spreadsheet', 'csv', 'excel'],
  dependencies: [],
  
  // Entity reference hints - simple field naming conventions
  entityHints: {
    // TreeNodeを参照するフィールド名: デフォルト 'nodeId' (カスタマイズなし)
    // RelationalEntityを参照するフィールド名: デフォルト 'relRef' 
    // SpreadsheetRefEntity.metadataId -> 'relRef' にカスタマイズ
    relRefField: 'metadataId'
    // 参照カウント用フィールド名: デフォルト 'refCount' (カスタマイズなし)
  }
};