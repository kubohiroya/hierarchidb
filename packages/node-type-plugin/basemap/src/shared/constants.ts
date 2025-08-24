/**
 * BaseMap plugin constants - shared between UI and Worker layers
 */

/**
 * Default configuration values
 */
export const DEFAULT_VALUES = {
  ZOOM: 10,
  CENTER: [0, 0] as [number, number],
  BEARING: 0,
  PITCH: 0,
  TILE_SIZE: 256,
  MAX_ZOOM: 22,
  MIN_ZOOM: 0,
} as const;

/**
 * Map style options
 */
export const MAP_STYLES = {
  STREETS: 'streets',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  TERRAIN: 'terrain',
  CUSTOM: 'custom',
} as const;

/**
 * Validation limits
 */
export const VALIDATION_LIMITS = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  TAGS_MAX_COUNT: 20,
  TAG_MAX_LENGTH: 50,
  ZOOM_MIN: 0,
  ZOOM_MAX: 22,
  BEARING_MIN: 0,
  BEARING_MAX: 360,
  PITCH_MIN: 0,
  PITCH_MAX: 60,
  LATITUDE_MIN: -85.05112878,
  LATITUDE_MAX: 85.05112878,
  LONGITUDE_MIN: -180,
  LONGITUDE_MAX: 180,
} as const;

/**
 * Error codes for validation
 */
export const ERROR_CODES = {
  INVALID_NAME: 'INVALID_NAME',
  INVALID_DESCRIPTION: 'INVALID_DESCRIPTION',
  INVALID_MAP_STYLE: 'INVALID_MAP_STYLE',
  INVALID_CENTER: 'INVALID_CENTER',
  INVALID_ZOOM: 'INVALID_ZOOM',
  INVALID_BEARING: 'INVALID_BEARING',
  INVALID_PITCH: 'INVALID_PITCH',
  INVALID_BOUNDS: 'INVALID_BOUNDS',
  INVALID_STYLE_URL: 'INVALID_STYLE_URL',
  INVALID_STYLE_CONFIG: 'INVALID_STYLE_CONFIG',
  INVALID_API_KEY: 'INVALID_API_KEY',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
} as const;

/**
 * Warning codes
 */
export const WARNING_CODES = {
  HIGH_ZOOM_LEVEL: 'HIGH_ZOOM_LEVEL',
  LARGE_BOUNDS: 'LARGE_BOUNDS',
  MISSING_ATTRIBUTION: 'MISSING_ATTRIBUTION',
  DEPRECATED_STYLE: 'DEPRECATED_STYLE',
  PERFORMANCE_WARNING: 'PERFORMANCE_WARNING',
} as const;

/**
 * Performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  HIGH_ZOOM_WARNING: 18,
  LARGE_BOUNDS_WARNING: 10000, // square kilometers
  MAX_TILE_COUNT_WARNING: 10000,
  MAX_DATA_SIZE_WARNING: 100 * 1024 * 1024, // 100MB
} as const;

/**
 * Tile provider configurations
 */
export const TILE_PROVIDERS = {
  OPENSTREETMAP: {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  },
  ESRI_SATELLITE: {
    name: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    maxZoom: 19,
  },
  CARTO_POSITRON: {
    name: 'Carto Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© CARTO',
    maxZoom: 19,
  },
  CARTO_DARK: {
    name: 'Carto Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© CARTO',
    maxZoom: 19,
  },
} as const;

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  MAX_CACHE_SIZE: 50 * 1024 * 1024, // 50MB
  CACHE_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 days
  MAX_TILE_CACHE_COUNT: 1000,
} as const;

/**
 * File size limits
 */
export const FILE_LIMITS = {
  MAX_THUMBNAIL_SIZE: 1 * 1024 * 1024, // 1MB
  MAX_STYLE_FILE_SIZE: 5 * 1024 * 1024, // 5MB
} as const;