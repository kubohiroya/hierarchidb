/**
 * Location Plugin - Services entry
 * Aggregates service-layer utilities for consumption by the app via
 * the Vite-generated services registry (virtual:plugin-registry-services).
 */

export { getEphemeralLocationDB, closeEphemeralLocationDB } from './database/EphemeralLocationDB';
export { LocationVectorTileService } from './tiles/LocationVectorTileService';
export { LocationBatchManager, type LocationBatchProgressEvent } from './LocationBatchManager';

// Batch Session manager and unified adapters
export { LocationBatchSessionManager } from './batch/BatchSessionManager';
export { registerLocationRuntimeWorkerAdapters } from './batch/adapters/registerRuntimeWorker';
export { registerLocationSharedDownloadService } from './download/registerSharedDownloadService';
export { registerLocationDownloadServiceFactory, configureLocationDownloadDefaults } from './download/registry';

