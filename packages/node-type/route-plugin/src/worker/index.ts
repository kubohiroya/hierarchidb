// Worker registration for route-plugin Dexie stores + standard worker exports
import type { NodeId, TreeNode } from '@hierarchidb/common-type';

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
import('@hierarchidb/runtime-worker').then(async ({ storeRegistry }) => {
  if (!hasIndexedDB) return;
  const { RouteEntitiesDB } = await import('./routeEntitiesDB.js');
  const db = new RouteEntitiesDB();
  await db.open();
  if (!storeRegistry.getPeer('route')) {
    const { createRoutePeerStoreDexie } = await import('./routePeerStore.dexie.js');
    storeRegistry.registerPeer('route', createRoutePeerStoreDexie(db));
  }
}).catch(() => {});

// Standardized worker-side factory exports (polymorphic contract)
export async function createEntityHandler() {
  const { RouteEntityHandler } = await import('../entities/RouteEntityHandler.js');
  return new RouteEntityHandler();
}

export async function createBatchManager() {
  const { createRouteBatchManager } = await import('../services/UnifiedRouteBatchManager.js');
  return createRouteBatchManager();
}

export const lifecycle = {
  async onCreate(nodeId: NodeId): Promise<void> {
    // lightweight log only; real work should live in handler
    console.log(`[RoutePlugin] onCreate: ${nodeId}`);
  },
  async afterCreate(node: TreeNode): Promise<void> {
    console.log(`[RoutePlugin] afterCreate: ${node.id}`);
  },
  async beforeDelete(node: TreeNode): Promise<void> {
    console.log(`[RoutePlugin] beforeDelete: ${node.id}`);
  },
  async afterUpdate(node: TreeNode): Promise<void> {
    console.log(`[RoutePlugin] afterUpdate: ${node.id}`);
  },
} as const;
