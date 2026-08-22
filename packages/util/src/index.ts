/**
 * @hierarchidb/util
 * General purpose utility functions for HierarchiDB
 *
 * This package contains standalone utility functions that do not depend on
 * any other HierarchiDB packages. These utilities are designed to be
 * reusable across the entire project.
 */

export * from './dbNameUtils.js';
export * from './dualKeyMap.js';
export * from './env.js';
// Formatting utilities
export * from './formatUtils.js';
export { generateId } from './generateId.js';
export * from './retainedLegacyYamlDatabaseNames.js';
export { SingletonMixin } from './SingletonMixin.js';
export * from './sleep.js';
export * from './treeConsoleSettings.js';
// Validation utilities
export * from './validationUtils.js';
export * from './webCryptoUtils.js';
export type {
  ZoomBandRange,
  ZoomBandSettings,
  ZoomBandSettingsSource,
} from './zoomBandSettings.js';
export {
  areZoomBandBoundariesEqual,
  buildEvenZoomBandBoundaries,
  buildZoomBandRanges,
  DEFAULT_ZOOM_BAND_BOUNDARIES,
  normalizeZoomBandBoundaries,
  resolveZoomBandSettings,
  ZOOM_BAND_MAX_RANGES,
  ZOOM_BAND_MAX_ZOOM,
  ZOOM_BAND_MIN_RANGES,
  ZOOM_BAND_MIN_ZOOM,
} from './zoomBandSettings.js';
// Note: Dexie-specific helpers are internal; avoid leaking Dexie types to consumers
