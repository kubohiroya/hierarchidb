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

// TODO(folder-runtime-worker-integration): tie this peer registration into the
// shared runtime worker factory when worker adapters are implemented.

export type FolderEntitiesDB = import('./folderEntitiesDB.js').FolderEntitiesDB;

export const loadFolderEntitiesDB = async () => {
  const module = await import('./folderEntitiesDB.js');
  return module.FolderEntitiesDB;
};

// Runtime worker lifecycle hook: no special logic
export const lifecycle = undefined;
