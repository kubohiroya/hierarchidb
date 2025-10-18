/**
 * Location Plugin - Services entry
 * Aggregates service-layer utilities for consumption by the app.
 */

export { getEphemeralLocationDB, closeEphemeralLocationDB } from './database/EphemeralLocationDB.js';
export { LocationVectorTileService } from './tiles/LocationVectorTileService.js';
export { LocationBatchManager, type LocationBatchProgressEvent } from './LocationBatchManager.js';
export {
  appendLocationPoints,
  replaceLocationPoints,
  listLocationPoints,
  deleteLocationPoints,
  clearLocationPoints,
} from './pointRepository.js';

// Batch Session manager and unified adapters
export { LocationBatchSessionManager } from './batch/BatchSessionManager.js';
export { registerLocationRuntimeWorkerAdapters } from './batch/adapters/registerRuntimeWorker.js';
export { registerLocationDownloadServiceFactory, configureLocationDownloadDefaults } from './download/registry.js';
