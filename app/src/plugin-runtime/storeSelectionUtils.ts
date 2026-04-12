export const APP_WORKER_STORE_PRELOADS: Record<string, string[]> = {
  linker: ['registerLinkerWorkerStores', 'loadLinkerEntitiesDbModule'],
  location: ['registerLocationWorkerStores', 'loadLocationEntitiesDbModule'],
  route: ['registerRouteWorkerStores'],
  shape: ['registerShapeWorkerStores', 'loadShapeEntitiesDbModule'],
  spreadsheet: ['registerSpreadsheetWorkerStores'],
};

export { APP_DATABASE_NODE_TYPES, APP_DATABASE_NODE_TYPES_SET } from './database-store-loaders.ts';
