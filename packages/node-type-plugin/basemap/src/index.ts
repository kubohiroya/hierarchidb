/**
 * BaseMap Plugin - Folder Extension
 * Following the Spreadsheet plugin pattern for clean folder extension
 */

// Main extension export (following spreadsheet pattern)
export { BaseMapExtension } from './extension/definition';

// Type exports for external usage
export type { 
  BaseMapEntity,
  BaseMapWorkingCopy
} from './extension/definition';

export type {
  BaseMapExtendedFields
} from './types/BaseMapEntity';

// Step components export
export { MapStyleStep } from './extension/components/MapStyleStep';
export { MapViewportStep } from './extension/components/MapViewportStep';
export { DisplayOptionsStep } from './extension/components/DisplayOptionsStep';

// Shared constants and utilities
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
  extends: 'folder',
  architecture: 'extension',
} as const;