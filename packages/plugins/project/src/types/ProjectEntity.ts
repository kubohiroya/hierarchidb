/**
 * ProjectEntity type definition - Main project entity
 */

import type { PeerEntity, NodeId, EntityId, Timestamp } from '@hierarchidb/00-core';

/**
 * Main project entity representing a map composition project
 * 
 * ProjectEntity is a PeerEntity that has a 1:1 relationship with TreeNode.
 * Resource references are stored in TreeNode.references, not as separate entities.
 */
export interface ProjectEntity extends PeerEntity {
  // Identity (from PeerEntity)
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
  center: [number, number];        // [longitude, latitude]
  zoom: number;                    // Initial zoom level
  bearing: number;                 // Map rotation in degrees
  pitch: number;                   // Map tilt in degrees
  bounds?: [[number, number], [number, number]]; // Optional bounds [[sw], [ne]]
}

/**
 * Rendering configuration for map display
 */
export interface RenderConfiguration {
  maxZoom: number;                 // Maximum zoom level
  minZoom: number;                 // Minimum zoom level
  pixelRatio: number;              // Device pixel ratio
  preserveDrawingBuffer: boolean;  // For screenshot capabilities
}

/**
 * Layer configuration for a specific resource reference
 */
export interface LayerConfiguration {
  layerId: string;                 // Unique layer identifier
  layerType: LayerType;            // Type of layer
  layerOrder: number;              // Layer z-index order
  isVisible: boolean;              // Whether layer is visible
  opacity: number;                 // Layer opacity (0-1)
  
  // Style configuration
  styleConfig: StyleConfiguration;
  
  // Interaction configuration
  interactionConfig: InteractionConfiguration;
  
  // Visibility rules
  visibilityRules?: VisibilityRules;
}

/**
 * Layer types
 */
export type LayerType = 
  | 'raster'                       // Raster tile layer
  | 'vector'                       // Vector tile layer  
  | 'geojson'                      // GeoJSON layer
  | 'image'                        // Static image layer
  | 'background';                  // Background color layer

/**
 * Style configuration for map layers
 */
// MapLibre-compatible type definitions
export type MapLibrePaintProperty = string | number | boolean | (string | number)[];
export type MapLibreLayoutProperty = string | number | boolean | (string | number)[];
export type MapLibreFilterExpression = (string | number | boolean | MapLibreFilterExpression)[];

export interface StyleConfiguration {
  source: LayerSource;             // Data source configuration
  paint?: Record<string, MapLibrePaintProperty>;     // MapLibre paint properties
  layout?: Record<string, MapLibreLayoutProperty>;    // MapLibre layout properties
  filter?: MapLibreFilterExpression;                  // MapLibre filter expression
}

/**
 * Layer data source configuration
 */
// GeoJSON data types
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

export interface LayerSource {
  type: 'raster' | 'vector' | 'geojson' | 'image';
  url?: string;                    // Source URL
  data?: GeoJSONData;             // Inline data (for GeoJSON)
  tiles?: string[];                // Tile URL templates
  bounds?: number[];               // Source bounds
  attribution?: string;            // Attribution text
  tileSize?: number;               // Tile size in pixels
  maxzoom?: number;                // Maximum zoom level
  minzoom?: number;                // Minimum zoom level
}

/**
 * Interaction configuration for layer events
 */
export interface InteractionConfiguration {
  clickable: boolean;              // Whether layer responds to clicks
  hoverable: boolean;              // Whether layer responds to hover
  popupTemplate?: string;          // Popup content template
  tooltipTemplate?: string;        // Tooltip content template
}

/**
 * Visibility rules for conditional layer display
 */
export interface VisibilityRules {
  minZoom?: number;                // Minimum zoom for visibility
  maxZoom?: number;                // Maximum zoom for visibility
  conditions?: VisibilityCondition[]; // Conditional visibility rules
}

/**
 * Conditional visibility based on data properties
 */
export interface VisibilityCondition {
  property: string;                // Property to check
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=';
  value: string | number | boolean | null;  // Comparison value
}

/**
 * Export configuration
 */
export interface ExportConfiguration {
  id: string;                      // Export configuration ID
  exportName: string;              // Export name
  exportType: ExportType;          // Export type
  exportFormat: ExportFormat;      // Output format
  exportSettings: ExportSettings;  // Export settings
  createdAt: Timestamp;            // Creation timestamp
  lastUsed?: Timestamp;            // Last used timestamp
}

/**
 * Export types
 */
export type ExportType = 
  | 'image'                        // Static image export
  | 'pdf'                          // PDF export
  | 'data'                         // Data export
  | 'share';                       // Sharing export

/**
 * Export formats
 */
export type ExportFormat = 
  | 'png'                          // PNG image
  | 'jpeg'                         // JPEG image
  | 'pdf'                          // PDF document
  | 'geojson'                      // GeoJSON data
  | 'kml'                          // KML data
  | 'shapefile';                   // Shapefile data

/**
 * Export settings
 */
export interface ExportSettings {
  width?: number;                  // Export width in pixels
  height?: number;                 // Export height in pixels
  dpi?: number;                    // Dots per inch for print
  quality?: number;                // Export quality (0-1)
  includeAttribution?: boolean;    // Include data attribution
}

/**
 * Aggregation metadata
 */
export interface AggregationMetadata {
  lastAggregated: Timestamp;       // Timestamp of last aggregation
  resourceCount: number;           // Number of referenced resources
  layerCount: number;              // Number of configured layers
  hasErrors: boolean;              // Whether aggregation encountered errors
  errorMessages?: string[];        // Error details if any
  aggregationTime?: number;        // Time taken for last aggregation (ms)
}

/**
 * Data for creating a new ProjectEntity
 */
export interface CreateProjectData {
  name: string;
  description?: string;
  mapConfig?: Partial<MapConfiguration>;
  renderConfig?: Partial<RenderConfiguration>;
  initialReferences?: NodeId[];    // Initial resource references
  layerConfigurations?: Record<string, LayerConfiguration>; // Layer configurations
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
  totalReferences: number;         // Total resource references
  validReferences: number;         // Valid resource references
  totalLayers: number;             // Total configured layers
  visibleLayers: number;           // Currently visible layers
  lastAggregated: Timestamp;       // Last aggregation time
  exportCount: number;             // Number of export configurations
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;                   // Field with error
  message: string;                 // Error message
  severity: 'error' | 'warning';   // Error severity
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;                // Whether validation passed
  errors: ValidationError[];       // List of validation errors
}

/**
 * Default configurations
 */
export const DEFAULT_MAP_CONFIG: MapConfiguration = {
  center: [0, 0],
  zoom: 2,
  bearing: 0,
  pitch: 0,
};

export const DEFAULT_RENDER_CONFIG: RenderConfiguration = {
  maxZoom: 18,
  minZoom: 0,
  pixelRatio: 1,
  preserveDrawingBuffer: false,
};

export const DEFAULT_AGGREGATION_METADATA: AggregationMetadata = {
  lastAggregated: 0,
  resourceCount: 0,
  layerCount: 0,
  hasErrors: false,
};

/**
 * UI-specific types for the Project plugin
 */

/**
 * Data structure for the layerConfigurations property
 * This will be stored in ProjectEntity but is also used by UI components
 */
export interface ProjectLayerConfigurations {
  [resourceId: string]: LayerConfiguration;
}