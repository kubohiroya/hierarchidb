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

// TODO(resolver-runtime-worker-integration): migrate resolver plugin to use
// @hierarchidb/plugins-runtime-worker-factory for client registration when
// runtime-worker adapters become available (aligned with shape/location/route).

export type { ResolverEntitiesDB } from './resolverEntitiesDB.js';

export const loadResolverEntitiesDB = async () => {
  const module = await import('./resolverEntitiesDB.js');
  return module.ResolverEntitiesDB;
};
