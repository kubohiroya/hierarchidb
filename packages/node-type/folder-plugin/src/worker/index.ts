/**
 * @file worker/index.ts
 * @description Worker-side exports for Folder plugin
 */

import { FolderEntityHandler } from '../handlers/FolderEntityHandler';
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

// Dev registration of Folder PeerStore (A-plan: per-plugin DB; here in-memory)
try {
  // Dynamic import to avoid hard dependency at build time
  // and keep this safe in non-worker contexts.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  import('@hierarchidb/runtime-worker/entity/store-registry').then(({ storeRegistry }) => {
    // Peer store
    import('./folderPeerStore').then(({ folderPeerStore }) => {
      if (!storeRegistry.getPeer('folder')) storeRegistry.registerPeer('folder', folderPeerStore);
    }).catch(() => {});
    // Group store
    import('./folderGroupStore').then(({ folderGroupStore }) => {
      if (!storeRegistry.getGroup('folder')) storeRegistry.registerGroup('folder', folderGroupStore);
    }).catch(() => {});
    // Relations store
    import('./folderRelationStore').then(({ folderRelationStore }) => {
      if (!storeRegistry.getRelations('folder')) storeRegistry.registerRelations('folder', folderRelationStore);
    }).catch(() => {});
  }).catch(() => {});
} catch {
  // ignore
}
