/**
 * Shared types for Project plugin - UI/Worker共通で使用
 */

import type { PeerEntity, NodeId, EntityId, Timestamp } from '@hierarchidb/00-core';

/**
 * Main project entity representing a map composition project
 */
export interface ProjectEntity extends PeerEntity {
  id: EntityId;
  nodeId: NodeId;
  
  // Basic project information
  name: string;
  description: string;
  
  // Map configuration
  mapConfig: MapConfiguration;
  
  // Render configuration  
  renderConfig: RenderConfiguration;
  
  // Layer configurations for referenced resources
  layerConfigurations: Record<NodeId, LayerConfiguration>;
  
  // Export configurations and history
  exportConfigurations: ExportConfiguration[];
  
  // Aggregation metadata
  aggregationMetadata: AggregationMetadata;
  
  // Lifecycle
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

/**
 * Map configuration for initial viewport
 */
export interface MapConfiguration {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  bounds?: [[number, number], [number, number]];
}

/**
 * Rendering configuration for map display
 */
export interface RenderConfiguration {
  maxZoom: number;
  minZoom: number;
  pixelRatio: number;
  preserveDrawingBuffer: boolean;
}

/**
 * Layer configuration for a specific resource reference
 */
export interface LayerConfiguration {
  layerId: string;
  layerType: LayerType;
  layerOrder: number;
  isVisible: boolean;
  opacity: number;
  
  styleConfig: StyleConfiguration;
  interactionConfig: InteractionConfiguration;
  visibilityRules?: VisibilityRules;
}

export type LayerType = 
  | 'raster'
  | 'vector'
  | 'geojson'
  | 'image'
  | 'background';

export interface StyleConfiguration {
  source: LayerSource;
  paint?: Record<string, MapLibrePaintProperty>;
  layout?: Record<string, MapLibreLayoutProperty>;
  filter?: MapLibreFilterExpression;
}

export interface LayerSource {
  type: 'raster' | 'vector' | 'geojson' | 'image';
  url?: string;
  data?: GeoJSONData;
  tiles?: string[];
  bounds?: number[];
  attribution?: string;
  tileSize?: number;
  maxzoom?: number;
  minzoom?: number;
}

export interface GeoJSONData {
  type: 'FeatureCollection' | 'Feature' | 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
  features?: Array<{
    type: 'Feature';
    geometry: {
      type: string;
      coordinates: number[] | number[][] | number[][][];
    };
    properties: Record<string, string | number | boolean | null>;
  }>;
  geometry?: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
  properties?: Record<string, string | number | boolean | null>;
  coordinates?: number[] | number[][] | number[][][];
}

export type MapLibrePaintProperty = string | number | boolean | (string | number)[];
export type MapLibreLayoutProperty = string | number | boolean | (string | number)[];
export type MapLibreFilterExpression = (string | number | boolean | MapLibreFilterExpression)[];

export interface InteractionConfiguration {
  clickable: boolean;
  hoverable: boolean;
  popupTemplate?: string;
  tooltipTemplate?: string;
}

export interface VisibilityRules {
  minZoom?: number;
  maxZoom?: number;
  conditions?: VisibilityCondition[];
}

export interface VisibilityCondition {
  property: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=';
  value: string | number | boolean | null;
}

export interface ExportConfiguration {
  id: string;
  exportName: string;
  exportType: ExportType;
  exportFormat: ExportFormat;
  exportSettings: ExportSettings;
  createdAt: Timestamp;
  lastUsed?: Timestamp;
}

export type ExportType = 
  | 'image'
  | 'pdf'
  | 'data'
  | 'share';

export type ExportFormat = 
  | 'png'
  | 'jpeg'
  | 'pdf'
  | 'geojson'
  | 'kml'
  | 'shapefile';

export interface ExportSettings {
  width?: number;
  height?: number;
  dpi?: number;
  quality?: number;
  includeAttribution?: boolean;
}

export interface AggregationMetadata {
  lastAggregated: Timestamp;
  resourceCount: number;
  layerCount: number;
  hasErrors: boolean;
  errorMessages?: string[];
  aggregationTime?: number;
}

/**
 * Data for creating a new ProjectEntity
 */
export interface CreateProjectData {
  name: string;
  description?: string;
  mapConfig?: Partial<MapConfiguration>;
  renderConfig?: Partial<RenderConfiguration>;
  initialReferences?: NodeId[];
  layerConfigurations?: Record<string, LayerConfiguration>;
}

/**
 * Data for updating an existing ProjectEntity
 */
export interface UpdateProjectData {
  name?: string;
  description?: string;
  mapConfig?: Partial<MapConfiguration>;
  renderConfig?: Partial<RenderConfiguration>;
}

/**
 * Project statistics
 */
export interface ProjectStatistics {
  totalReferences: number;
  validReferences: number;
  totalLayers: number;
  visibleLayers: number;
  lastAggregated: Timestamp;
  exportCount: number;
}

/**
 * Validation types
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}