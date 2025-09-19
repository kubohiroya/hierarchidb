/**
 * BaseMap Plugin - Standard Structure Export
 * Following HierarchiDB plugin standard conventions
 */

// === Core Exports (Standard Structure) ===

// Entity/handler/definition exports
export * from './handlers/index.js';
// Plugin metadata is sourced from package.json (hierarchidb.plugin); no definitions export

// UI components
// UI components moved under subpath to keep root worker-safe

// Type exports (root)
export * from './types/index.js';

// Database
export * from './database/index.js';

// === Extension Exports (Legacy Compatibility)
// Removed: legacy extension layer is not present in this package.

// === Constants and Metadata ===

export const BASEMAP_CONSTANTS = {
  DEFAULT_VIEWPORT: {
    center: [139.6917, 35.6895] as [number, number], // Tokyo
    zoom: 10,
    bearing: 0,
    pitch: 0,
  },

  MAP_STYLE_PRESETS: {
    streets: 'Standard street map view',
    satellite: 'Satellite imagery view',
    terrain: 'Topographical terrain view',
    dark: 'Dark theme for low-light viewing',
    light: 'Clean light theme',
    custom: 'Custom MapLibre style URL',
  },

  VALIDATION_LIMITS: {
    LONGITUDE_MIN: -180,
    LONGITUDE_MAX: 180,
    LATITUDE_MIN: -90,
    LATITUDE_MAX: 90,
    ZOOM_MIN: 0,
    ZOOM_MAX: 24,
    BEARING_MIN: 0,
    BEARING_MAX: 360,
    PITCH_MIN: 0,
    PITCH_MAX: 60,
  },
} as const;

// Plugin information
export const PLUGIN_INFO = {
  id: 'com.hierarchidb.basemap',
  name: 'BaseMap Plugin',
  version: '1.0.0',
  extends: 'folder',
  architecture: 'extension',
} as const;

// Optional runtime wiring (no-op)
export class RuntimeWiring {}

// Folder dialog extension initializer (optional)
export { initializeBaseMapFolderExtension, baseMapFolderExtension } from './extensions/BaseMapFolderExtension.js';
