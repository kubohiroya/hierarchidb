/**
 * @file unified-map-props.ts
 * @description Unified type definitions for map components to ensure consistent API
 *
 * DESIGN RATIONALE:
 *
 * 1. **Consistent Naming Convention**:
 *    - Previously: onLoad/onMapLoad, onClick/onMapClick (inconsistent)
 *    - Now: onLoad, onViewStateChange, onClick (unified across all components)
 *
 * 2. **Layered Interface Design**:
 *    - BaseMapProps: Core functionality shared by all map components
 *    - Specialized interfaces: Extend base with component-specific features
 *    - Composition over inheritance: Mix interfaces as needed
 *
 * 3. **Default Value Centralization**:
 *    - Previously: Scattered default values (height: 400px vs 500px)
 *    - Now: Single source of truth in DEFAULT_MAP_CONFIG
 *
 * 4. **Type Safety & Reusability**:
 *    - Shared types prevent duplication and ensure consistency
 *    - Generic interfaces allow for future extensibility
 *    - Clear separation between data source and display configuration
 */

import type { MapLibreFilter, MapLibreMapInstance, MapLibreStyle } from './maplibre-public.js';

/**
 * Base map view state - shared across all map components
 *
 * UNIFIED REASON: All three components used identical MapViewState
 * No changes needed - already consistent across components
 */
export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

/**
 * Base map interaction options - shared across all map components
 *
 * UNIFIED REASON: Both MapLibreMap and MapWithVectorTiles had identical mapOptions
 * Extracted to prevent duplication and ensure consistent interaction behavior
 */
export interface MapInteractionOptions {
  interactive?: boolean;
  scrollZoom?: boolean;
  dragPan?: boolean;
  dragRotate?: boolean;
  doubleClickZoom?: boolean;
  touchZoomRotate?: boolean;
}

/**
 * Base map dimensions and styling - shared across all map components
 *
 * UNIFIED REASON: All components had identical dimension props
 * Extracted to common interface for consistency and reusability
 */
export interface MapDimensionsProps {
  /** Map container width */
  width?: string | number;

  /** Map container height */
  height?: string | number;

  /** Additional CSS styles for the container */
  style?: React.CSSProperties;
}

/**
 * Unified map event handlers - consistent naming across all components
 *
 * MAJOR UNIFICATION:
 * - MapLibreMap:        onLoad, onViewStateChange, onClick
 * - MapWithVectorTiles: onMapLoad, onViewStateChange, onMapClick
 *
 * UNIFIED TO: onLoad, onViewStateChange, onClick
 *
 * RATIONALE: Consistent naming prevents confusion when switching between components
 * All callbacks now follow the same pattern: on[Event] instead of on[Map][Event]
 */
export interface MapEventHandlers {
  /** Callback when map loads and is ready for interaction */
  onLoad?: (map: MapLibreMapInstance) => void;

  /** Callback when view state changes (pan, zoom, rotate) */
  onViewStateChange?: (viewState: MapViewState) => void;

  /** Callback when map is clicked */
  onClick?: (event: any) => void;
}

/**
 * Base map configuration - shared core settings
 *
 * DESIGN PATTERN: Composition of smaller interfaces
 * - Combines dimensions, event handlers, and core map settings
 * - Serves as foundation for all map component props
 * - Enables consistent API across MapLibreMap and MapWithVectorTiles
 */
export interface BaseMapProps extends MapDimensionsProps, MapEventHandlers {
  /** Initial view state for the map */
  initialViewState: MapViewState;

  /** Map style URL or style object */
  mapStyle?: string | MapLibreStyle;

  /** Map interaction options */
  mapOptions?: MapInteractionOptions;
}

/**
 * Vector tile specific layer configuration
 *
 * UNIFICATION FROM:
 * - MapWithVectorTiles.LayerOptions (high-level config)
 * - VectorTileLayer props (low-level MapLibre config)
 *
 * UNIFIED APPROACH:
 * - Single interface covering all layer configuration needs
 * - Clear defaults prevent configuration conflicts
 * - Consistent property naming across components
 */
export interface VectorTileLayerConfig {
  /** Unique layer identifier */
  layerId?: string;

  /** Source identifier */
  sourceId?: string;

  /** Layer paint properties */
  paint?: Record<string, unknown>;

  /** Layer layout properties */
  layout?: Record<string, unknown>;

  /** Layer filter specification */
  filter?: MapLibreFilter;

  /** Minimum zoom level */
  minzoom?: number;

  /** Maximum zoom level */
  maxzoom?: number;

  /** Layer type */
  layerType?: 'fill' | 'line' | 'circle' | 'symbol' | 'raster' | 'background';

  /** Source layer name (for vector tiles) */
  sourceLayer?: string;

  /** Layer visibility */
  visible?: boolean;
}

/**
 * Vector tile data source options
 *
 * SEPARATION OF CONCERNS:
 * - Previously mixed in MapWithVectorTiles with display options
 * - Now clearly separated: data source vs display configuration
 * - Enables reusable data source configuration across components
 */
export interface VectorTileDataSource {
  /** Database name for vector tiles */
  dbName?: string;

  /** Node ID for data lookup */
  nodeId?: string;

  /** Custom vector tile URLs */
  tiles?: string[];

  /** Custom tile data provider function */
  tileDataProvider?: (z: number, x: number, y: number, nodeId?: string) => Promise<ArrayBuffer | null>;
}

// Complete vector tile props combining all configurations
export interface VectorTileProps extends VectorTileDataSource, VectorTileLayerConfig {
  /** Map instance reference */
  map?: MapLibreMapInstance;
}

/**
 * Default values to ensure consistency across all components
 *
 * CENTRALIZED DEFAULTS SOLUTION:
 *
 * BEFORE (inconsistent):
 * - MapLibreMap:        height='400px', mapStyle='https://...'
 * - MapWithVectorTiles: height='500px', mapStyle='https://...'
 * - Different layer configs with different IDs and paint styles
 *
 * AFTER (consistent):
 * - Single source of truth for all default values
 * - Consistent dimensions, styles, and layer configurations
 * - Easy to modify defaults globally
 * - Type-safe with 'as const' assertion
 */
export const DEFAULT_MAP_CONFIG = {
  viewState: {
    longitude: 0,
    latitude: 0,
    zoom: 2,
  } as MapViewState,

  dimensions: {
    width: '100%',
    height: '400px',  // Standardized to 400px (was 400px/500px)
  },

  mapStyle: 'https://demotiles.maplibre.org/style.json',

  interactionOptions: {
    interactive: true,
    scrollZoom: true,
    dragPan: true,
    dragRotate: true,
    doubleClickZoom: true,
    touchZoomRotate: true,
  } as MapInteractionOptions,

  vectorTileLayer: {
    layerId: 'vector-tile-layer',
    sourceId: 'vector-tile-source',
    paint: {
      'fill-color': 'rgba(0, 136, 136, 0.7)',
      'fill-outline-color': '#004444',
    },
    layerType: 'fill' as const,
    minzoom: 0,
    maxzoom: 22,  // Standardized to 22 (was 14/22)
    visible: true,
  } as VectorTileLayerConfig,
} as const;
