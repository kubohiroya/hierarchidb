/**
  * Folder plugin metadata - UIWorker
  */

import type { NodeType } from '@hierarchidb/core-types';

export const FolderMetadata = {
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
    supportedOperations: ['create', 'read', 'update', 'delete', 'move', 'copy'],
  },

  dependencies: ['@hierarchidb/_obsolate_common-types', '@hierarchidb/_obsolate_common-api'],

  tags: ['organization', 'hierarchy', 'core'],
};

// Additional metadata not part of PluginManifest type
export const FolderValidation = {
  namePattern: '^[^<>:"/\\\\|?*]+$', // Exclude filesystem-unsafe characters
  maxChildren: 1000,
  maxDepth: 20,
  nameMinLength: 1,
  nameMaxLength: 255,
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
    'properties',
    'permissions',
    'delete',
  ],

  // Toolbar items
  toolbarItems: ['create_folder', 'search', 'view_mode', 'sort_order', 'refresh'],
};
