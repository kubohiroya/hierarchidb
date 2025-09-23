// Worker registration for folder-plugin Dexie stores
const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
import('@hierarchidb/runtime-worker').then(async ({ storeRegistry }) => {
  if (!hasIndexedDB) return;
  const { FolderEntitiesDB } = await import('./folderEntitiesDB.js');
  const db = new FolderEntitiesDB();
  const dexieLike = db as unknown as { open?: () => Promise<unknown> };
  if (typeof dexieLike.open === 'function') {
    await dexieLike.open();
  }
  if (!storeRegistry.getPeer('folder')) {
    const { createFolderPeerStoreDexie } = await import('./folderPeerStore.dexie.js');
    storeRegistry.registerPeer('folder', createFolderPeerStoreDexie(db));
  }
}).catch(() => {});

export { FolderEntitiesDB } from './folderEntitiesDB.js';
