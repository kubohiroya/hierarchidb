/**
 * Folder plugin metadata - UI・Worker共通メタデータ
 */

import type { PluginMetadata, NodeType } from '@hierarchidb/common-type';

export const FolderMetadata: PluginMetadata = {
  id: '@hierarchidb/folder-plugin',
  nodeType: 'folder' as NodeType,
  name: 'Folder',
  description: 'Hierarchical folder-plugin organization plugin',
  version: '1.0.0',
  author: 'HierarchiDB Team',
  status: 'active',
  
  capabilities: {
    // Core operations
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: true,
    supportsChildren: true,
    supportedOperations: ['create', 'read', 'update', 'delete', 'move', 'copy']
  },
  
  dependencies: [
    '@hierarchidb/common-type',
    '@hierarchidb/common-api'
  ],
  
  tags: ['organization', 'hierarchy', 'core']
};

// Additional metadata not part of PluginMetadata type
export const FolderValidation = {
  namePattern: '^[^<>:"/\\\\|?*]+$', // Exclude filesystem-unsafe characters
  maxChildren: 1000,
  maxDepth: 20,
  nameMinLength: 1,
  nameMaxLength: 255
};

export const FolderUIConfig = {
  dialogComponentPath: '@hierarchidb/plugin-folder-plugin/components/FolderDialog',
  panelComponentPath: '@hierarchidb/plugin-folder-plugin/components/FolderPanel',
  iconComponentPath: '@hierarchidb/plugin-folder-plugin/components/FolderIcon',
  treeComponentPath: '@hierarchidb/plugin-folder-plugin/components/FolderTree',
  
  // Context menu items
  contextMenuItems: [
    'create_folder',
    'rename',
    'move',
    'copy',
    'duplicate',
    'add_bookmark',
    'create_template',
    'properties',
    'permissions',
    'delete'
  ],
  
  // Toolbar items
  toolbarItems: [
    'create_folder',
    'search',
    'view_mode',
    'sort_order',
    'refresh'
  ]
};

export const FolderPerformanceProfile = {
  memoryUsage: 'low',
  cpuUsage: 'low',
  diskUsage: 'low',
  networkUsage: 'none'
};