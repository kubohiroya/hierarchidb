/**
 * BaseMap Plugin - Standard Structure Export
 * Following HierarchiDB plugin standard conventions
 */

// === Core Exports (Standard Structure) ===

// Entity exports
export * from './entities';
export * from './handlers';
export * from './definitions';

// UI components
export * from './components';
export * from './hooks';

// Shared code
export * from './shared';
export * from './types';

// Database
export * from './database';

// === Extension Exports (Legacy Compatibility) ===

// Main extension export (legacy compatibility)
export { BaseMapExtension } from './extension/definition';

// Extension components
export { MapStyleStep } from './extension/components/MapStyleStep';
export { MapViewportStep } from './extension/components/MapViewportStep';
export { DisplayOptionsStep } from './extension/components/DisplayOptionsStep';
export { PreviewStep } from './extension/components/PreviewStep';

// === Constants and Metadata ===

export const BASEMAP_CONSTANTS = {
  DEFAULT_VIEWPORT: {
    center: [139.6917, 35.6895] as [number, number], // Tokyo
    zoom: 10,
    bearing: 0,
    pitch: 0
  },
  
  MAP_STYLE_PRESETS: {
    streets: 'Standard street map view',
    satellite: 'Satellite imagery view',
    terrain: 'Topographical terrain view',
    dark: 'Dark theme for low-light viewing',
    light: 'Clean light theme',
    custom: 'Custom MapLibre style URL'
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
    PITCH_MAX: 60
  }
} as const;

// Plugin information
export const PLUGIN_INFO = {
  id: 'com.hierarchidb.basemap',
  name: 'BaseMap Plugin',
  version: '1.0.0',
  extends: 'folder-plugin',
  architecture: 'extension',
} as const;