/**
 * @hierarchidb/util
 * General purpose utility functions for HierarchiDB
 *
 * This package contains standalone utility functions that do not depend on
 * any other HierarchiDB packages. These utilities are designed to be
 * reusable across the entire project.
 */

// Formatting utilities
export * from './format.js';

// Validation utilities
export * from './validation.js';
export { SingletonMixin } from './SingletonMixin.js';
export { generateId } from './generateId.js';
export * from './db-name.js';
export * from './env.js';
export * from './webCrypto.js';
export * from './dualKeyMap.js';
export * from './treeConsoleSettings.js';
export {
  DEFAULT_ZOOM_BAND_BOUNDARIES,
  ZOOM_BAND_MAX_RANGES,
  ZOOM_BAND_MAX_ZOOM,
  ZOOM_BAND_MIN_RANGES,
  ZOOM_BAND_MIN_ZOOM,
  areZoomBandBoundariesEqual,
  buildEvenZoomBandBoundaries,
  buildZoomBandRanges,
  normalizeZoomBandBoundaries,
  resolveZoomBandSettings,
} from './zoomBandSettings.js';
export type { ZoomBandRange, ZoomBandSettings, ZoomBandSettingsSource } from './zoomBandSettings.js';
export * from './sleep.js';
// Note: Dexie-specific helpers are internal; avoid leaking Dexie types to consumers
