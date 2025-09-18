// Worker registration for folder-plugin Dexie stores
const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
import('@hierarchidb/runtime-worker').then(async ({ storeRegistry }) => {
  if (!hasIndexedDB) return;
  const { FolderEntitiesDB } = await import('./folderEntitiesDB.js');
  const db = new FolderEntitiesDB();
  await db.open();
  if (!storeRegistry.getPeer('folder')) {
    const { createFolderPeerStoreDexie } = await import('./folderPeerStore.dexie.js');
    storeRegistry.registerPeer('folder', createFolderPeerStoreDexie(db));
  }
}).catch(() => {});
