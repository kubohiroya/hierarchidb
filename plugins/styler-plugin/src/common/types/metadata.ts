/**
 * Styler plugin metadata with entity reference hints
 */

import { toNodeType } from '@hierarchidb/common-types';
import type { PluginManifest } from '@hierarchidb/plugin-service-api';

export const StylerMetadata: PluginManifest = {
  id: 'com.hierarchidb.styler-plugin',
  name: 'Style Map',
  nodeType: toNodeType('styler'),
  version: '1.0.0',
  description: 'Map visualization with data-driven styling based on spreadsheet-plugin data',
  author: 'HierarchiDB Team',
  status: 'active',
  tags: ['visualization', 'mapping', 'styling', 'data-driven'],
  dependencies: ['com.hierarchidb.spreadsheet-plugin'],

  // Entity reference hints - simple field naming conventions
  entityHints: {
    //  TreeNode: 'nodeId' ()
    //  RelationalEntity: 'relRef'
    //  StylerEntity.spreadsheetMetadataId -> 'relRef'
    relRefField: 'spreadsheetMetadataId',
  },
};
