// Dexie-backed stores auto-registration for spreadsheet plugin
try {
  const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;
  import('@hierarchidb/runtime-worker').then(async ({ storeRegistry }) => {
    if (!hasIndexedDB) return;
    try {
      const { SpreadsheetEntitiesDB } = await import('./spreadsheetEntitiesDB');
      const db = new SpreadsheetEntitiesDB();
      await db.open();
      if (!storeRegistry.getPeer('spreadsheet')) {
        const { createSpreadsheetPeerStoreDexie } = await import('./spreadsheetPeerStore.dexie');
        storeRegistry.registerPeer('spreadsheet', createSpreadsheetPeerStoreDexie(db));
      }
      if (!storeRegistry.getGroup('spreadsheet')) {
        const { createSpreadsheetGroupStoreDexie } = await import('./spreadsheetGroupStore.dexie');
        storeRegistry.registerGroup('spreadsheet', createSpreadsheetGroupStoreDexie(db));
      }
      if (!storeRegistry.getRelations('spreadsheet')) {
        const { createSpreadsheetRelationStoreDexie } = await import('./spreadsheetRelationStore.dexie');
        storeRegistry.registerRelations('spreadsheet', createSpreadsheetRelationStoreDexie(db));
      }
    } catch {
      // ignore
    }
  }).catch(() => {
  });
} catch {
}
