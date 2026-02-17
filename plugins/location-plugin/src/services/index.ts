/**
 * Location Plugin - Services entry
 * Aggregates service-layer utilities for consumption by the app.
 */

export {
  LocationBuildManager,
  type LocationBuildProgressEvent,
  type LocationBuildSession,
  type LocationBuildTask,
} from './LocationBuildManager.js';
export {
  appendLocationPoints,
  replaceLocationPoints,
  replaceLocationPointsChunked,
  listLocationPoints,
  deleteLocationPoints,
  clearLocationPoints,
} from './pointRepository.js';
export type { LocationPointWriteProgress } from './pointRepository.js';
