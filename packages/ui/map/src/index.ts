/**
 * @file index.ts
 * @description Shared map components for HierarchiDB
 */

// Core map components
export { MapLibreMap } from './components/MapLibreMap';
export { VectorTileLayer } from './components/VectorTileLayer';
export { MapWithVectorTiles } from './components/MapWithVectorTiles';

// Type exports - unified props
export type {
  MapViewState,
  MapInteractionOptions,
  MapDimensionsProps,
  MapEventHandlers,
  BaseMapProps,
  VectorTileLayerConfig,
  VectorTileDataSource,
  VectorTileProps,
} from './types/unified-map-props';

// Default configuration
export { DEFAULT_MAP_CONFIG } from './types/unified-map-props';

// Component-specific props
export type { MapLibreMapProps } from './components/MapLibreMap';
export type { VectorTileLayerProps } from './components/VectorTileLayer';
export type { MapWithVectorTilesProps, LayerOptions } from './components/MapWithVectorTiles';

// Re-export important MapLibre types for convenience
export type {
  Map as MapLibreMapInstance,
  FilterSpecification,
  SourceSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl';