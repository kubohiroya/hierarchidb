// Dexie-backed stores auto-registration for location plugin
try {
  const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
  import('@hierarchidb/runtime-worker').then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;
    try {
      const { LocationEntitiesDB } = await import('./locationEntitiesDB');
      const db = new LocationEntitiesDB();
      await db.open();
      if (!storeRegistry.getPeer('location')) {
        const { createLocationPeerStoreDexie } = await import('./locationPeerStore.dexie');
        storeRegistry.registerPeer('location', createLocationPeerStoreDexie(db));
      }
      if (!storeRegistry.getGroup('location')) {
        const { createLocationGroupStoreDexie } = await import('./locationGroupStore.dexie');
        storeRegistry.registerGroup('location', createLocationGroupStoreDexie(db));
      }
      if (!storeRegistry.getRelations('location')) {
        const { createLocationRelationStoreDexie } = await import('./locationRelationStore.dexie');
        storeRegistry.registerRelations('location', createLocationRelationStoreDexie(db));
      }
    } catch {
      // ignore
    }
  }).catch(() => {});
} catch {}
