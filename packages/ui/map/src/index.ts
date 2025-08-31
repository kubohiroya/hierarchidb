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

// NOTE: These type re-exports are intentional to provide a stable API surface
// Users of this package should not need to install maplibre-gl separately
export type {
  Map as MapLibreMapInstance,
  FilterSpecification,
  SourceSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl';