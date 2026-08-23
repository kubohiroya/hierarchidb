/// <reference types="vite/client" />

import { getVTStoreRegistry } from '@hierarchidb/runtime-worker';
import { getShapeDB, initializeShapeDB } from '@hierarchidb/shape-store';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import { createShapeVectorTileStoreDexie } from '../shapeVectorTileStoreDexieUtils.js';

export interface RegisterShapeWorkerStoresOptions {
  signal?: AbortSignal;
}

export async function registerShapeWorkerStores(
  options: RegisterShapeWorkerStoresOptions = {}
): Promise<void> {
  if (options.signal?.aborted) return;
  const db = resolveShapeDB();
  await db.open?.();
  getVTStoreRegistry().registerVectorTiles('shape', createShapeVectorTileStoreDexie(db));
}

const resolveShapeDB = (): ReturnType<typeof getShapeDB> => {
  try {
    return getShapeDB();
  } catch {
    return initializeShapeDB(getDBName(getBuildDatabasePrefix(), 'shape'));
  }
};

/*
export async function loadShapeEntitiesDbModule() {
  return import('../shapeEntitiesDB.js');
}
 */
