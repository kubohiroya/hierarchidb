/**
 * @file worker/index.ts
 * @description Worker-side exports for Folder plugin
 */

import { FolderEntityHandler } from '../handlers/FolderEntityHandler';
import type { NodeLifecycleHooks, PluginRoutingConfig } from '@hierarchidb/common-type';
import type { FolderEntity } from '../types';

// Create singleton instance of entity handler
export const entityHandler = new FolderEntityHandler();

// Lifecycle hooks for folder operations
export const lifecycle: NodeLifecycleHooks<FolderEntity> = {
  afterCreate: async (nodeId, entity) => {
    console.log(`Folder created: ${nodeId}`, entity.name);
  },
  
  beforeDelete: async (nodeId) => {
    console.log(`Folder will be deleted: ${nodeId}`);
    // Clean up bookmarks and templates via entity handler
    const bookmarks = await entityHandler.getBookmarks(nodeId);
    const templates = await entityHandler.getTemplates(nodeId);
    
    if (bookmarks.length > 0) {
      console.log(`Cleaning up ${bookmarks.length} bookmarks`);
    }
    if (templates.length > 0) {
      console.log(`Cleaning up ${templates.length} templates`);
    }
  },
  
  afterDelete: async (nodeId) => {
    console.log(`Folder deleted: ${nodeId}`);
  },
  
  beforeMove: async (nodeId, newParentId) => {
    console.log(`Folder ${nodeId} will be moved to ${newParentId}`);
  },
  
  afterMove: async (nodeId, newParentId) => {
    console.log(`Folder ${nodeId} moved to ${newParentId}`);
  },
};

// Routing configuration for folder plugin
export const routing: PluginRoutingConfig = {
  actions: {
    view: {
      path: 'view',
      componentPath: '@hierarchidb/node-type-folder-plugin/ui/FolderView',
    },
    edit: {
      path: 'edit',
      componentPath: '@hierarchidb/node-type-folder-plugin/ui/FolderEditDialog',
    },
    create: {
      path: 'create',
      componentPath: '@hierarchidb/node-type-folder-plugin/ui/FolderCreateDialog',
    },
    settings: {
      path: 'settings',
      componentPath: '@hierarchidb/node-type-folder-plugin/ui/FolderSettings',
    },
  },
  defaultAction: 'view',
};

// Also export as default for compatibility
export default entityHandler;