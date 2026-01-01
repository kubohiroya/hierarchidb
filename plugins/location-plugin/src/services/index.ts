/**
 * Location Plugin - Services entry
 * Aggregates service-layer utilities for consumption by the app.
 */

export { LocationBatchManager, type LocationBatchProgressEvent } from './LocationBatchManager.js';
export {
  appendLocationPoints,
  replaceLocationPoints,
  replaceLocationPointsChunked,
  listLocationPoints,
  deleteLocationPoints,
  clearLocationPoints,
} from './pointRepository.js';
export type { LocationPointWriteProgress } from './pointRepository.js';
export { LocationBatchSessionManager } from './batch/BatchSessionManager.js';
