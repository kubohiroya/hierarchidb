/**
 * Shape plugin constants
 */

import type { ProcessingConfig, DataSourceConfig } from './types';

export const DEFAULT_PROCESSING_CONFIG: ProcessingConfig = {
  concurrentDownloads: 2,
  corsProxyBaseURL: '',
  enableFeatureFiltering: false,
  featureFilterMethod: 'hybrid',
  featureAreaThreshold: 0.1,
  concurrentProcesses: 2,
  maxZoomLevel: 12,
  tileBufferSize: 256,
  simplificationTolerance: 0.01,
} as const;

export const SHAPE_LEVELS = [
  { level: 0, label: 'Country', icon: '🌍' },
  { level: 1, label: 'State/Province', icon: '🏛️' },
  { level: 2, label: 'County/District', icon: '🏘️' },
  { level: 3, label: 'Municipality', icon: '🏢' },
  { level: 4, label: 'Ward/Borough', icon: '🏠' },
  { level: 5, label: 'Neighborhood', icon: '📍' },
] as const;

export const DEFAULT_DATA_SOURCES = [
  {
    name: 'naturalearth',
    displayName: 'Natural Earth',
    description: 'Free vector and raster map data at 1:10m, 1:50m, and 1:110m scales',
    license: 'Public Domain',
    licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
    attribution: 'Made with Natural Earth',
    color: '#2E8B57',
    icon: '🌍',
    maxAdminLevel: 2
  },
  {
    name: 'geoboundaries',
    displayName: 'geoBoundaries',
    description: 'Open administrative boundaries for all countries',
    license: 'CC BY 4.0',
    licenseUrl: 'https://www.geoboundaries.org/globalLicense.html',
    attribution: 'geoBoundaries Global Database',
    color: '#4169E1',
    icon: '🗺️',
    maxAdminLevel: 5
  },
  {
    name: 'gadm',
    displayName: 'GADM',
    description: 'Global Administrative Areas database',
    license: 'Custom (Academic Use)',
    licenseUrl: 'https://gadm.org/license.html',
    attribution: 'GADM.org',
    color: '#FF6347',
    icon: '🌐',
    maxAdminLevel: 4
  },
  {
    name: 'openstreetmap',
    displayName: 'OpenStreetMap',
    description: 'Community-driven geographic data',
    license: 'ODbL',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
    attribution: '© OpenStreetMap contributors',
    color: '#7EDD00',
    icon: '🛣️',
    maxAdminLevel: 3
  }
] as DataSourceConfig[];

// Batch processing constants
export const BATCH_CONSTANTS = {
  MAX_CONCURRENT_DOWNLOADS: 10,
  MAX_CONCURRENT_PROCESSES: 8,
  DEFAULT_WORKER_POOL_SIZE: 4,
  MAX_RETRY_ATTEMPTS: 3,
  TASK_TIMEOUT_MS: 300000, // 5 minutes
  SESSION_CLEANUP_INTERVAL_MS: 60000, // 1 minute
  MAX_BATCH_TASKS: 1000
} as const;

// File and storage constants
export const STORAGE_CONSTANTS = {
  MAX_FEATURE_BUFFER_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_TILE_CACHE_SIZE: 100 * 1024 * 1024, // 100MB
  FEATURE_INDEX_CHUNK_SIZE: 10000,
  VECTOR_TILE_COMPRESSION: 'gzip',
  DEFAULT_TILE_SIZE: 256
} as const;

// UI constants
export const UI_CONSTANTS = {
  DIALOG_MAX_WIDTH: 'lg',
  STEPPER_STEPS: [
    'Basic Information',
    'Data Source',
    'License Agreement', 
    'Processing Configuration',
    'Country Selection'
  ],
  BATCH_MONITOR_REFRESH_INTERVAL: 1000,
  PROGRESS_UPDATE_THROTTLE: 500
} as const;