/**
 * @file BaseMapEntity.ts
 * @description BaseMap entity type definitions
 * References:
 * - docs/7-aop-architecture.md
 * - ../eria-cartograph/app0/src/domains/resources/basemap/types/BaseMapEntity.ts
 */

import type { NodeId, EntityId, WorkingCopy } from '@hierarchidb/common-core';
import type { PeerEntity } from '@hierarchidb/common-core';

/**
 * MapLibre GL Style Expression types
 * Based on MapLibre GL Style Specification
 */
export type StyleExpression = 
  | string
  | number
  | boolean
  | (string | number | boolean)[]
  | { [key: string]: StyleExpression };

/**
 * Filter expression for layer filtering
 * Based on MapLibre GL Style Specification
 */
export type FilterExpression = 
  | ['==', string, StyleExpression]
  | ['!=', string, StyleExpression]
  | ['>', string, number]
  | ['>=', string, number]
  | ['<', string, number]
  | ['<=', string, number]
  | ['in', string, ...StyleExpression[]]
  | ['!in', string, ...StyleExpression[]]
  | ['has', string]
  | ['!has', string]
  | ['all', ...FilterExpression[]]
  | ['any', ...FilterExpression[]]
  | ['none', ...FilterExpression[]]
  | boolean;

/**
 * Layout properties for layers
 * Extensible record for different layer types
 */
export interface LayerLayoutProperties {
  visibility?: 'visible' | 'none';
  [key: string]: StyleExpression | undefined;
}

/**
 * Paint properties for layers
 * Extensible record for different layer types
 */
export interface LayerPaintProperties {
  [key: string]: StyleExpression | undefined;
}

/**
 * Layer metadata
 * Can contain any descriptive information
 */
export interface LayerMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Source metadata
 * Can contain any descriptive information about the source
 */
export interface SourceMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * BaseMap entity representing map configuration
 * Based on MapLibreGL styles and configuration
 */
export interface BaseMapEntity extends PeerEntity {
  id: EntityId;
  nodeId: NodeId;
  
  // Basic information
  name: string;
  description?: string;

  // Map style configuration
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain' | 'custom';

  // Custom style configuration (when mapStyle is 'custom')
  styleUrl?: string;
  styleConfig?: MapLibreStyleConfig;

  // Map viewport settings
  center: [number, number]; // [longitude, latitude]
  zoom: number; // Zoom level (0-22)
  bearing: number; // Rotation angle in degrees (0-360)
  pitch: number; // Tilt angle in degrees (0-60)

  // Map bounds (optional)
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };

  // Display options
  displayOptions?: {
    show3dBuildings?: boolean;
    showTraffic?: boolean;
    showTransit?: boolean;
    showTerrain?: boolean;
    showLabels?: boolean;
  };

  // Access configuration
  apiKey?: string; // API key for tile providers
  attribution?: string; // Map attribution text

  // Metadata
  thumbnailUrl?: string; // PreviewStep thumbnail
  tags?: string[]; // Categorization tags

  // Timestamps (inherited from PeerEntity)
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * MapLibre GL style configuration
 * Subset of MapLibre GL Style Specification
 */
export interface MapLibreStyleConfig {
  version: number;
  name?: string;
  metadata?: SourceMetadata;

  // Data sources
  sources: Record<
    string,
    {
      type: 'vector' | 'raster' | 'raster-dem' | 'geojson' | 'image' | 'video';
      tiles?: string[];
      url?: string;
      minzoom?: number;
      maxzoom?: number;
      tileSize?: number;
      scheme?: 'xyz' | 'tms';
      attribution?: string;
      metadata?: SourceMetadata;
    }
  >;

  // Map layers
  layers: Array<{
    id: string;
    type:
      | 'fill'
      | 'line'
      | 'symbol'
      | 'circle'
      | 'heatmap'
      | 'fill-extrusion'
      | 'raster'
      | 'hillshade'
      | 'background';
    source?: string;
    'source-layer'?: string;
    minzoom?: number;
    maxzoom?: number;
    filter?: FilterExpression[];
    layout?: LayerLayoutProperties;
    paint?: LayerPaintProperties;
    metadata?: LayerMetadata;
  }>;

  // Sprite and glyphs
  sprite?: string;
  glyphs?: string;

  // Initial map position
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;

  // Additional style properties (extensible for custom properties)
  [key: string]: unknown;
}

/**
 * BaseMap working copy for edit operations
 */
export interface BaseMapWorkingCopy extends WorkingCopy {
  nodeId: NodeId;
  name: string;
  description?: string;

  // All BaseMapEntity fields for editing
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain' | 'custom';
  styleUrl?: string;
  styleConfig?: MapLibreStyleConfig;
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  displayOptions?: {
    show3dBuildings?: boolean;
    showTraffic?: boolean;
    showTransit?: boolean;
    showTerrain?: boolean;
    showLabels?: boolean;
  };
  apiKey?: string;
  attribution?: string;
  thumbnailUrl?: string;
  tags?: string[];

  // Working copy specific fields (inherited from BaseWorkingCopy)
  workingCopyId: string;
  workingCopyOf: NodeId;
  copiedAt: number;
  isDirty: boolean;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * Predefined basemap styles
 */
export enum PredefinedMapStyle {
  // Open source styles
  OSM_BRIGHT = 'osm-bright',
  OSM_LIBERTY = 'osm-liberty',
  POSITRON = 'positron',
  DARK_MATTER = 'dark-matter',

  // Terrain styles
  TERRAIN_RGB = 'terrain-rgb',
  HILLSHADE = 'hillshade',

  // Satellite styles
  SATELLITE = 'satellite',
  SATELLITE_STREETS = 'satellite-streets',

  // Custom
  CUSTOM = 'custom',
}

/**
 * Default map configuration
 */
export const DEFAULT_MAP_CONFIG: Partial<BaseMapEntity> = {
  // name: 'New Map',
  mapStyle: 'streets',
  center: [0, 0],
  zoom: 10,
  bearing: 0,
  pitch: 0,
  displayOptions: {
    show3dBuildings: false,
    showTraffic: false,
    showTransit: false,
    showTerrain: false,
    showLabels: true,
  },
};

/**
 * Map style presets
 */
export const MAP_STYLE_PRESETS: Record<string, Partial<MapLibreStyleConfig>> = {
  streets: {
    version: 8,
    name: 'Streets',
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  },
  satellite: {
    version: 8,
    name: 'Satellite',
    sources: {
      satellite: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '© Esri',
      },
    },
    layers: [
      {
        id: 'satellite',
        type: 'raster',
        source: 'satellite',
      },
    ],
  },
};
