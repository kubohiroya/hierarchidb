/**
 * Location Plugin - Services entry
 * Aggregates service-layer utilities for consumption by the app via
 * the Vite-generated services registry (virtual:plugin-registry-services).
 */

export { getEphemeralLocationDB, closeEphemeralLocationDB } from './database/EphemeralLocationDB.js';
export { LocationVectorTileService } from './tiles/LocationVectorTileService.js';
export { LocationBatchManager, type LocationBatchProgressEvent } from './LocationBatchManager.js';

// Batch Session manager and unified adapters
export { LocationBatchSessionManager } from './batch/BatchSessionManager.js';
export { registerLocationRuntimeWorkerAdapters } from './batch/adapters/registerRuntimeWorker.js';
export { registerLocationSharedDownloadService } from './download/registerSharedDownloadService.js';
export { registerLocationDownloadServiceFactory, configureLocationDownloadDefaults } from './download/registry.js';

