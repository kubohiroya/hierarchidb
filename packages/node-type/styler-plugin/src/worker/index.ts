// Dexie-backed PeerStore auto-registration for styler plugin
try {
  const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
  // Build specifier dynamically to avoid TS attempting resolution during DTS
  const workerModName: string = '@hierarchidb' + '/runtime-worker';
  import(/* @vite-ignore */ (workerModName as string)).then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;
    try {
      const { StylerEntitiesDB } = await import('./stylerEntitiesDB.js');
      const db = new StylerEntitiesDB();
      await db.open();
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
