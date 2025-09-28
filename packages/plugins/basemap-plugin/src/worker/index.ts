// Dexie-backed PeerStore auto-registration for basemap plugin
try {
  const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
  import('@hierarchidb/runtime-worker').then(async ({ storeRegistry }) => {
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
  }).catch(() => {
    // ignore
  });
} catch {
  // ignore (SSR/tests)
}

// Ensure this file is treated as a module under --isolatedModules
export {};

// Runtime worker lifecycle hook: follow default 3x2 entity cleanup rules
export const lifecycle = undefined;
