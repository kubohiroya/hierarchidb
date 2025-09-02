/**
 * Worker layer exports - Worker環境専用
 */

// API implementation
export * from './api';

// Entity handlers
export * from './handlers';

// Plugin definition
export * from './plugin';

// Dexie-backed entity stores registration (Peer/Group/Relations)
try {
  const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
  // dynamic import to avoid SSR/Node issues
  import('@hierarchidb/runtime-worker/entity/store-registry').then(async ({ storeRegistry }) => {
    if (hasIndexedDB) {
      try {
        const { ShapeEntitiesDB } = await import('./shapeEntitiesDB');
        const db = new ShapeEntitiesDB();
        await db.open();
        if (!storeRegistry.getPeer('shape')) {
          const { createShapePeerStoreDexie } = await import('./shapePeerStore.dexie');
          storeRegistry.registerPeer('shape', createShapePeerStoreDexie(db));
        }
        if (!storeRegistry.getGroup('shape')) {
          const { createShapeGroupStoreDexie } = await import('./shapeGroupStore.dexie');
          storeRegistry.registerGroup('shape', createShapeGroupStoreDexie(db));
        }
        if (!storeRegistry.getRelations('shape')) {
          const { createShapeRelationStoreDexie } = await import('./shapeRelationStore.dexie');
          storeRegistry.registerRelations('shape', createShapeRelationStoreDexie(db));
        }
      } catch {
        // If Dexie fails, no-op; dev stores can be registered elsewhere if needed
      }
    }
  }).catch(() => {});
} catch {}
