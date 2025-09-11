// Worker registration for project-plugin Dexie stores
try {
  const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
  const workerModName: string = '@hierarchidb' + '/runtime-worker';
  import(/* @vite-ignore */ (workerModName as string)).then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;
    try {
      const { ProjectEntitiesDB } = await import('./projectEntitiesDB');
      const db = new ProjectEntitiesDB();
      await db.open();
      if (!storeRegistry.getPeer('project')) {
        const { createProjectPeerStoreDexie } = await import('./projectPeerStore.dexie');
        storeRegistry.registerPeer('project', createProjectPeerStoreDexie(db));
      }
    } catch {}
  }).catch(() => {});
} catch {}

export function register(): void {}
const mod = { register };
export default mod;
export {};
