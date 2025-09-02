/**
 * @file worker/index.ts
 * @description Worker-side exports for Folder plugin
 */

import { FolderEntityHandler } from '../handlers/FolderEntityHandler';
import { storeRegistry } from '@hierarchidb/runtime-worker';
import { getFolderPeerStore } from './folderPeerStore';
import type { NodeLifecycleHooks, PluginRoutingConfig, NodeId } from '@hierarchidb/common-type';
import type { FolderEntity } from '../entities/FolderEntity';

// Create singleton instance of entity handler
export const entityHandler = new FolderEntityHandler();

// Lifecycle hooks for folder operations
export const lifecycle: NodeLifecycleHooks<FolderEntity> = {
  afterCreate: async (nodeId: NodeId, entity: FolderEntity) => {
    console.log(`Folder created: ${nodeId}`, entity.name);
  },

  beforeDelete: async (nodeId: NodeId) => {
    console.log(`Folder will be deleted: ${nodeId}`);
  },

  afterDelete: async (nodeId: NodeId) => {
    console.log(`Folder deleted: ${nodeId}`);
  },

  beforeMove: async (nodeId: NodeId, newParentId: NodeId) => {
    console.log(`Folder ${nodeId} will be moved to ${newParentId}`);
  },

  afterMove: async (nodeId: NodeId, newParentId: NodeId) => {
    console.log(`Folder ${nodeId} moved to ${newParentId}`);
  },
};

// Routing configuration for folder plugin
export const routing: PluginRoutingConfig = {
  actions: {
    view: {
      path: 'view',
      componentPath: '@hierarchidb/folder-plugin/ui/FolderView',
    },
    edit: {
      path: 'edit',
      componentPath: '@hierarchidb/folder-plugin/ui/FolderEditDialog',
    },
    create: {
      path: 'create',
      componentPath: '@hierarchidb/folder-plugin/ui/FolderCreateDialog',
    },
    settings: {
      path: 'settings',
      componentPath: '@hierarchidb/folder-plugin/ui/FolderSettings',
    },
  },
  defaultAction: 'view',
};

// Also export as default for compatibility
export default entityHandler;

// Register Peer store for folder nodeType (A-plan)
try {
  const { store } = getFolderPeerStore();
  storeRegistry.registerPeer('folder', store);
} catch {
  // Ignore registration errors in non-worker environments (e.g., UI-only tests)
}
// Dev registration of PeerStore (A-plan: per-plugin DB; here in-memory stub)
import { storeRegistry } from '@hierarchidb/runtime-worker-worker/entity/store-registry';
import { folderPeerStore } from './folderPeerStore';

try {
  // Register only once; safe to call multiple times
  if (!storeRegistry.getPeer('folder')) {
    storeRegistry.registerPeer('folder', folderPeerStore);
  }
} catch {
  // ignore registration failures in non-worker contexts
}
