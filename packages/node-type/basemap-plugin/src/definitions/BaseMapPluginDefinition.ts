/**
 * @file BaseMapPluginDefinition.ts
 * @description BaseMap plugin definition (aligned with current PluginDefinition shape)
 */

import type { NodeType, TreeId } from '@hierarchidb/common-type';

export const BaseMapPluginDefinition = {
  // Basic metadata
  nodeType: 'basemap' as NodeType,
  name: 'basemap-plugin',
  displayName: 'BaseMap',
  version: '1.0.0',
  dependencies: [],
  priority: 0,

  // Category (available in all trees; document group)
  category: {
    treeId: '*' as TreeId | '*',
    menuGroup: 'document',
  },

  // Database schema
  database: {
    dbName: 'basemapDB',
    schema: {
      baseMaps:
        '&id, nodeId, name, [nodeId+name], createdAt, updatedAt, baseMapMetadataId',
      workingCopies: '&id, nodeId, originalId, createdAt, copiedAt',
    },
    version: 1,
  },

  // UI routing hints (paths are consumed by UI side; not validated here)
  ui: {
    dialogComponentPath: './components/BaseMapPanel',
    panelComponentPath: './components/BaseMapPanel',
  },

  icon: {
    emoji: '🗺️',
  },
} as const;
