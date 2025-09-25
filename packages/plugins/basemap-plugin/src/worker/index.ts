// Dexie-backed PeerStore auto-registration for basemap plugin
import { importRuntimeWorker } from '@hierarchidb/runtime-shared-module-paths';

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;

importRuntimeWorker()
  .then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;

    try {
      const { BasemapEntitiesDB } = await import('./basemapEntitiesDB.js');
      const db = new BasemapEntitiesDB();
      await db.open();
      if (!storeRegistry.getPeer('basemap')) {
        const { createBasemapPeerStoreDexie } = await import('./basemapPeerStore.dexie.js');
        storeRegistry.registerPeer('basemap', createBasemapPeerStoreDexie(db));
      }
    } catch {
      // ignore
    }
  })
  .catch(() => {});

export async function loadBasemapEntitiesDbModule() {
  return import(/* @vite-ignore */ './basemapEntitiesDB.js');
}
