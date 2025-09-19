// Worker registration for resolver-plugin Dexie stores

  const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
  import('@hierarchidb/runtime-worker').then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;

      const { ResolverEntitiesDB } = await import('./resolverEntitiesDB.js');
      const db = new ResolverEntitiesDB();
      if (typeof db.open === 'function') {
        await db.open();
      }
      if (!storeRegistry.getPeer('resolver')) {
        const { createResolverPeerStoreDexie } = await import('./resolverPeerStore.dexie.js');
        storeRegistry.registerPeer('resolver', createResolverPeerStoreDexie(db));
      }

  }).catch(() => {});


// Make this file a module under --isolatedModules
export { ResolverEntitiesDB } from './resolverEntitiesDB.js';
