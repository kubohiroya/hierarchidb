// Dexie-backed PeerStore auto-registration for basemap plugin
try {
  const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
  import('@hierarchidb/runtime-worker').then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;
    try {
      const { BasemapEntitiesDB } = await import('./basemapEntitiesDB');
      const db = new BasemapEntitiesDB();
      await db.open();
      if (!storeRegistry.getPeer('basemap')) {
        const { createBasemapPeerStoreDexie } = await import('./basemapPeerStore.dexie');
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

