// Dexie-backed PeerStore auto-registration for styler plugin
import { importRuntimeWorker } from '@hierarchidb/runtime-shared-module-paths';

try {
  const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
  importRuntimeWorker().then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;
    try {
      const { StylerEntitiesDB } = await import('./stylerEntitiesDB.js');
      const db = new StylerEntitiesDB();
      if (typeof db.open === 'function') {
        await db.open();
      }
      if (!storeRegistry.getPeer('styler')) {
        const { createStylerPeerStoreDexie } = await import('./stylerPeerStore.dexie.js');
        storeRegistry.registerPeer('styler', createStylerPeerStoreDexie(db));
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

export { StylerEntitiesDB } from './stylerEntitiesDB.js';
