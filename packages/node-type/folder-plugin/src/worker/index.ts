// Worker registration for folder-plugin Dexie stores
try {
  const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
  import('@hierarchidb/runtime-worker').then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;
    try {
      const { FolderEntitiesDB } = await import('./folderEntitiesDB');
      const db = new FolderEntitiesDB();
      await db.open();
      if (!storeRegistry.getPeer('folder')) {
        const { createFolderPeerStoreDexie } = await import('./folderPeerStore.dexie');
        storeRegistry.registerPeer('folder', createFolderPeerStoreDexie(db));
      }
    } catch {}
  }).catch(() => {});
} catch {}

