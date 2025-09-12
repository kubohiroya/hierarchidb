// Worker registration for route-plugin Dexie stores + standard worker exports
import type { NodeId, TreeNode } from '@hierarchidb/common-type';

try {
  const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
  import('@hierarchidb/runtime-worker').then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;
    try {
      const { RouteEntitiesDB } = await import('./routeEntitiesDB');
      const db = new RouteEntitiesDB();
      await db.open();
      if (!storeRegistry.getPeer('route')) {
        const { createRoutePeerStoreDexie } = await import('./routePeerStore.dexie');
        storeRegistry.registerPeer('route', createRoutePeerStoreDexie(db));
      }
    } catch {}
  }).catch(() => {});
} catch {}

// Standardized worker-side factory exports (polymorphic contract)
export async function createEntityHandler() {
  const { RouteEntityHandler } = await import('../entities/RouteEntityHandler');
  return new RouteEntityHandler();
}

export async function createBatchManager() {
  const { createRouteBatchManager } = await import('../services/UnifiedRouteBatchManager');
  return createRouteBatchManager();
}

export const lifecycle = {
  async onCreate(nodeId: NodeId): Promise<void> {
    // lightweight log only; real work should live in handler
    try { console.log(`[RoutePlugin] onCreate: ${nodeId}`); } catch {}
  },
  async afterCreate(node: TreeNode): Promise<void> {
    try { console.log(`[RoutePlugin] afterCreate: ${node.id}`); } catch {}
  },
  async beforeDelete(node: TreeNode): Promise<void> {
    try { console.log(`[RoutePlugin] beforeDelete: ${node.id}`); } catch {}
  },
  async afterUpdate(node: TreeNode): Promise<void> {
    try { console.log(`[RoutePlugin] afterUpdate: ${node.id}`); } catch {}
  },
} as const;
