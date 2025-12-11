/**
 * Location Plugin - Services entry
 * Aggregates service-layer utilities for consumption by the app.
 */

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

export { getEphemeralLocationDB } from '../database/EphemeralLocationDB.js';
