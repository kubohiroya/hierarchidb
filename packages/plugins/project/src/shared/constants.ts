/**
 * Constants for Project plugin - UI/Worker共通で使用
 */

import type { MapConfiguration, RenderConfiguration, AggregationMetadata } from './types';

export const PLUGIN_NAME = 'project' as const;
export const NODE_TYPE = 'project' as const;
export const PLUGIN_VERSION = '1.0.0' as const;

export const DATABASE_STORES = {
  PROJECTS: 'projects',
} as const;

export const LAYER_TYPES = {
  RASTER: 'raster',
  VECTOR: 'vector',
  GEOJSON: 'geojson',
  IMAGE: 'image',
  BACKGROUND: 'background'
} as const;

export const EXPORT_TYPES = {
  IMAGE: 'image',
  PDF: 'pdf',
  DATA: 'data',
  SHARE: 'share'
} as const;

export const EXPORT_FORMATS = {
  PNG: 'png',
  JPEG: 'jpeg',
  PDF: 'pdf',
  GEOJSON: 'geojson',
  KML: 'kml',
  SHAPEFILE: 'shapefile'
} as const;

export const DEFAULT_MAP_CONFIG: MapConfiguration = {
  center: [139.6917, 35.6895] as [number, number], // Tokyo
  zoom: 10,
  bearing: 0,
  pitch: 0
} as const;

export const DEFAULT_RENDER_CONFIG: RenderConfiguration = {
  maxZoom: 18,
  minZoom: 0,
  pixelRatio: 1,
  preserveDrawingBuffer: false
} as const;

export const DEFAULT_AGGREGATION_METADATA: AggregationMetadata = {
  lastAggregated: 0,
  resourceCount: 0,
  layerCount: 0,
  hasErrors: false,
} as const;

export const PERFORMANCE_LIMITS = {
  MAX_RESOURCE_REFERENCES: 50,
  MAX_LAYER_CONFIGURATIONS: 20,
  MAX_CONCURRENT_LOADS: 5,
  DEBOUNCE_DELAY: 300
} as const;