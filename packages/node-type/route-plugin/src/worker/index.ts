// Worker registration for route-plugin Dexie stores
try {
  const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
  import('@hierarchidb/runtime-worker').then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;
    try {
      const { RouteEntitiesDB } = await import('./routeEntitiesDB');
      const db = new RouteEntitiesDB();
      await db.open();
      if (!storeRegistry.getPeer('route')) {
        const { createRoutePeerStoreDexie } = await import('./routePeerStore.dexie');
        storeRegistry.registerPeer('route', createRoutePeerStoreDexie(db));
      }
    } catch {}
  }).catch(() => {});
} catch {}

