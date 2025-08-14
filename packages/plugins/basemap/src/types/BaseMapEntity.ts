/**
 * @file BaseMapEntity.ts
 * @description BaseMap entity type definitions
 * References:
 * - docs/7-aop-architecture.md
 * - ../eria-cartograph/app0/src/domains/resources/basemap/types/BaseMapEntity.ts
 */

import type { TreeNodeId } from '@hierarchidb/core';
import type { BaseEntity, BaseWorkingCopy } from '@hierarchidb/worker/registry';

/**
 * BaseMap entity representing map configuration
 * Based on MapLibreGL styles and configuration
 */
export interface BaseMapEntity extends BaseEntity {
  nodeId: TreeNodeId;
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
  thumbnailUrl?: string; // Preview thumbnail
  tags?: string[]; // Categorization tags

  // Timestamps (inherited from BaseEntity)
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
  metadata?: Record<string, any>;

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
      [key: string]: any;
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
    filter?: any[];
    layout?: Record<string, any>;
    paint?: Record<string, any>;
    metadata?: Record<string, any>;
  }>;

  // Sprite and glyphs
  sprite?: string;
  glyphs?: string;

  // Initial map position
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;

  // Additional properties
  [key: string]: any;
}

/**
 * BaseMap working copy for edit operations
 */
export interface BaseMapWorkingCopy extends BaseWorkingCopy {
  nodeId: TreeNodeId;
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
  workingCopyOf: TreeNodeId;
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
  name: 'New Map',
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
