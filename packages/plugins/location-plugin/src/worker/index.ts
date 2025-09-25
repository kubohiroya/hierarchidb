/**
 * Worker-safe entry for location-plugin
 * - No DOM/MUI imports
 * - Dexie-based stores/utilities may be imported here as needed
 * - Provides standardized worker exports (factory + lifecycle)
 */

import { registerLocationWorkerStores, loadLocationEntitiesDbModule } from '../worker-factory/registerLocationWorkerStores.js';

export { registerLocationWorkerStores, loadLocationEntitiesDbModule };
export type { RegisterLocationWorkerStoresOptions } from '../worker-factory/registerLocationWorkerStores.js';

// Legacy exports kept for backward compatibility (scheduled for removal once app loader migrates)
export async function createEntityHandler() {
  const { LocationEntityHandler } = await import('../entities/LocationEntityHandler.js');
  return new LocationEntityHandler();
}

export async function createBatchManager() {
  const { createLocationBatchManager } = await import('../services/batch/UnifiedLocationBatchManager.js');
  return createLocationBatchManager();
}

export class Lifecycle {
  static async onCreate(nodeId: any): Promise<void> {
    console.log(`[LocationPlugin] onCreate: ${nodeId}`);
  }
}

export default {
  registerLocationWorkerStores,
  loadLocationEntitiesDbModule,
};
