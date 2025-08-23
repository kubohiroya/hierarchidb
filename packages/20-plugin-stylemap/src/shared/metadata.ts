/**
 * StyleMap plugin metadata with entity reference hints
 */

import type { PluginMetadata } from '@hierarchidb/00-core';

export const StyleMapMetadata: PluginMetadata = {
  id: 'com.hierarchidb.stylemap',
  name: 'Style Map',
  nodeType: 'stylemap',
  version: '1.0.0',
  description: 'Map visualization with data-driven styling based on spreadsheet data',
  author: 'HierarchiDB Team',
  status: 'active',
  tags: ['visualization', 'mapping', 'styling', 'data-driven'],
  dependencies: ['com.hierarchidb.spreadsheet'],
  
  // Entity reference hints - simple field naming conventions
  entityHints: {
    // TreeNodeを参照するフィールド名: デフォルト 'nodeId' (そのまま使用)
    // RelationalEntityを参照するフィールド名: デフォルト 'relRef'
    // StyleMapEntity.spreadsheetMetadataId -> 'relRef' にカスタマイズ  
    relRefField: 'spreadsheetMetadataId'
  }
};