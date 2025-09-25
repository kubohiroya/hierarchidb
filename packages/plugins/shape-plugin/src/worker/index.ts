import { importRuntimeWorker } from '@hierarchidb/runtime-shared-module-paths';

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;

importRuntimeWorker()
  .then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;
    try {
      const { ShapeEntitiesDB } = await import('./shapeEntitiesDB.js');
      const db = new ShapeEntitiesDB();
      await db.open();

      if (!storeRegistry.getPeer('shape')) {
        const { createShapePeerStoreDexie } = await import('./shapePeerStore.dexie.js');
        storeRegistry.registerPeer('shape', createShapePeerStoreDexie(db));
      }

      if (!storeRegistry.getGroup('shape')) {
        const { createShapeGroupStoreDexie } = await import('./shapeGroupStore.dexie.js');
        storeRegistry.registerGroup('shape', createShapeGroupStoreDexie(db));
      }

      if (!storeRegistry.getRelations('shape')) {
        const { createShapeRelationStoreDexie } = await import('./shapeRelationStore.dexie.js');
        storeRegistry.registerRelations('shape', createShapeRelationStoreDexie(db));
      }
    } catch {
      // ignore errors in registration to avoid crashing worker boot
    }
  })
  .catch(() => {});

export async function loadShapeEntitiesDbModule() {
  return import(/* @vite-ignore */ './shapeEntitiesDB.js');
}

// Worker entry for shape-plugin providing standardized factory exports
export async function createEntityHandler() {
  const { ShapeEntityHandler } = await import('../handlers/ShapeEntityHandler.js');
  return new ShapeEntityHandler();
}

export const lifecycle = {} as const;
