/**
 * Location Plugin - Services entry
 * Aggregates service-layer utilities for consumption by the app.
 */

export {
  LocationBuildManager,
  /** @deprecated Use LocationBuildManager. */
  LocationBatchManager,
  type LocationBuildProgressEvent,
  /** @deprecated Use LocationBuildProgressEvent. */
  type LocationBatchProgressEvent,
  type LocationBuildSession,
  /** @deprecated Use LocationBuildSession. */
  type LocationBatchSession,
  type LocationBuildTask,
  /** @deprecated Use LocationBuildTask. */
  type LocationBatchTask,
} from './LocationBatchManager.js';
export {
  appendLocationPoints,
  replaceLocationPoints,
  replaceLocationPointsChunked,
  listLocationPoints,
  deleteLocationPoints,
  clearLocationPoints,
} from './pointRepository.js';
export type { LocationPointWriteProgress } from './pointRepository.js';
