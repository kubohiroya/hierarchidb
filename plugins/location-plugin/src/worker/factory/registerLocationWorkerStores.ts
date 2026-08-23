/// <reference types="vite/client" />

import { getLocationDB, initializeLocationDB } from '@hierarchidb/location-store';
import { getVTStoreRegistry } from '@hierarchidb/runtime-worker';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import { createLocationVectorTileStoreDexie } from '../createLocationVectorTileStoreDexie.js';

export interface RegisterLocationWorkerStoresOptions {
  signal?: AbortSignal;
}

export async function registerLocationWorkerStores(
  options: RegisterLocationWorkerStoresOptions = {}
): Promise<void> {
  if (options.signal?.aborted) return;
  const db = resolveLocationDB();
  await db.open?.();
  getVTStoreRegistry().registerVectorTiles('location', createLocationVectorTileStoreDexie(db));
}

const resolveLocationDB = (): ReturnType<typeof getLocationDB> => {
  try {
    return getLocationDB();
  } catch {
    return initializeLocationDB(getDBName(getBuildDatabasePrefix(), 'location'));
  }
};

type LocationEntitiesDbModule = typeof import('../locationEntitiesDB.js');

export async function loadLocationEntitiesDbModule(): Promise<LocationEntitiesDbModule | null> {
  try {
    return await import('~/worker/locationEntitiesDB');
  } catch {
    return null;
  }
}
