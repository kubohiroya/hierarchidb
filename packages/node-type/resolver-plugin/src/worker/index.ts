// Worker registration for resolver-plugin Dexie stores
try {
  const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
  import('@hierarchidb/runtime-worker').then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;
    try {
      const { ResolverEntitiesDB } = await import('./resolverEntitiesDB');
      const db = new ResolverEntitiesDB();
      await db.open();
      if (!storeRegistry.getPeer('resolver')) {
        const { createResolverPeerStoreDexie } = await import('./resolverPeerStore.dexie');
        storeRegistry.registerPeer('resolver', createResolverPeerStoreDexie(db));
      }
    } catch {}
  }).catch(() => {});
} catch {}

