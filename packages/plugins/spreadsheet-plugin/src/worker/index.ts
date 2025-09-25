// Dexie-backed stores auto-registration for spreadsheet plugin
import { importRuntimeWorker } from '@hierarchidb/runtime-shared-module-paths';

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;

importRuntimeWorker()
  .then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;
    try {
      const { SpreadsheetEntitiesDB } = await import('./spreadsheetEntitiesDB.js');
      const db = new SpreadsheetEntitiesDB();
      await db.open();
      if (!storeRegistry.getPeer('spreadsheet')) {
        const { createSpreadsheetPeerStoreDexie } = await import('./spreadsheetPeerStore.dexie.js');
        storeRegistry.registerPeer('spreadsheet', createSpreadsheetPeerStoreDexie(db));
      }
      if (!storeRegistry.getGroup('spreadsheet')) {
        const { createSpreadsheetGroupStoreDexie } = await import('./spreadsheetGroupStore.dexie.js');
        storeRegistry.registerGroup('spreadsheet', createSpreadsheetGroupStoreDexie(db));
      }
      if (!storeRegistry.getRelations('spreadsheet')) {
        const { createSpreadsheetRelationStoreDexie } = await import('./spreadsheetRelationStore.dexie.js');
        storeRegistry.registerRelations('spreadsheet', createSpreadsheetRelationStoreDexie(db));
      }
    } catch {
      // ignore
    }
  })
  .catch(() => {});

export async function loadSpreadsheetEntitiesDbModule() {
  return import(/* @vite-ignore */ './spreadsheetEntitiesDB.js');
}
