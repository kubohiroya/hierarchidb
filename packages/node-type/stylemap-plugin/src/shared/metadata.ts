/**
 * StyleMap plugin metadata with entity reference hints
 */

import type { PluginMetadata } from '@hierarchidb/common-type';

export const StyleMapMetadata: PluginMetadata = {
  id: 'com.hierarchidb.stylemap-plugin',
  name: 'Style Map',
  nodeType: 'stylemap',
  version: '1.0.0',
  description: 'Map visualization with data-driven styling based on spreadsheet-plugin data',
  author: 'HierarchiDB Team',
  status: 'active',
  tags: ['visualization', 'mapping', 'styling', 'data-driven'],
  dependencies: ['com.hierarchidb.spreadsheet-plugin'],
  
  // Entity reference hints - simple field naming conventions
  entityHints: {
    // TreeNodeを参照するフィールド名: デフォルト 'nodeId' (そのまま使用)
    // RelationalEntityを参照するフィールド名: デフォルト 'relRef'
    // StyleMapEntity.spreadsheetMetadataId -> 'relRef' にカスタマイズ  
    relRefField: 'spreadsheetMetadataId'
  }
};