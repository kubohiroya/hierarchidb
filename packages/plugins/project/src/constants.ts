/**
 * Constants for the Project Plugin
 */

export const PLUGIN_NAME = 'project' as const;
export const PLUGIN_VERSION = '1.0.0' as const;

export const NODE_TYPE = 'project' as const;

export const DATABASE_STORES = {
  PROJECTS: 'projects',
  RESOURCE_REFERENCES: 'resourceReferences',
  LAYER_CONFIGURATIONS: 'layerConfigurations',
  EXPORT_CONFIGURATIONS: 'exportConfigurations'
} as const;

export const RESOURCE_REFERENCE_TYPES = {
  BASEMAP: 'basemap',
  SHAPE: 'shape',
  STYLEMAP: 'stylemap',
  LOCATION: 'location',
  ROUTE: 'route',
  FOLDER: 'folder'
} as const;

export const LAYER_TYPES = {
  RASTER: 'raster',
  VECTOR: 'vector',
  GEOJSON: 'geojson',
  SYMBOL: 'symbol',
  LINE: 'line',
  FILL: 'fill',
  HEATMAP: 'heatmap',
  HILLSHADE: 'hillshade'
} as const;

export const EXPORT_TYPES = {
  IMAGE: 'image',
  INTERACTIVE: 'interactive',
  DATA: 'data',
  CONFIGURATION: 'configuration',
  TEMPLATE: 'template'
} as const;

export const EXPORT_FORMATS = {
  PNG: 'png',
  JPEG: 'jpeg',
  SVG: 'svg',
  PDF: 'pdf',
  HTML: 'html',
  JSON: 'json',
  GEOJSON: 'geojson',
  MVT: 'mvt',
  MBTILES: 'mbtiles'
} as const;

export const DEFAULT_MAP_CONFIG = {
  center: [139.6917, 35.6895] as [number, number], // Tokyo
  zoom: 10,
  bearing: 0,
  pitch: 0
} as const;

export const DEFAULT_RENDER_CONFIG = {
  maxZoom: 18,
  minZoom: 0,
  pixelRatio: 1,
  preserveDrawingBuffer: false
} as const;

export const CACHE_SETTINGS = {
  RESOURCE_TTL: 5 * 60 * 1000, // 5 minutes
  LAYER_TTL: 10 * 60 * 1000,   // 10 minutes
  AGGREGATION_TTL: 2 * 60 * 1000, // 2 minutes
  MAX_CACHE_SIZE: 100
} as const;

export const PERFORMANCE_LIMITS = {
  MAX_RESOURCE_REFERENCES: 50,
  MAX_LAYER_CONFIGURATIONS: 20,
  MAX_CONCURRENT_LOADS: 5,
  DEBOUNCE_DELAY: 300
} as const;