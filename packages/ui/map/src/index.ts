/**
 * @file index.ts
 * @description Shared map components for HierarchiDB
 */

// Core map components
export { MapLibreMap } from './components/MapLibreMap.js';
export { VectorTileLayer } from './components/VectorTileLayer.js';
export { MapWithVectorTiles } from './components/MapWithVectorTiles.js';
export { MapWithDeckGL } from './components/MapWithDeckGL.js';

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
} from './types/unified-map-props.js';

// Default configuration
export { DEFAULT_MAP_CONFIG } from './types/unified-map-props.js';

// Component-specific props
export type { MapLibreMapProps } from './components/MapLibreMap.js';
export type { VectorTileLayerProps } from './components/VectorTileLayer.js';
export type { MapWithVectorTilesProps, LayerOptions } from './components/MapWithVectorTiles.js';
export type { DeckOverlayProps } from './components/MapWithDeckGL.js';

// Layer presets
export * from './presets/vectorLayers.js';

//  Stable public typings do not leak upstream maplibre-gl types
export type { MapLibreMapInstance, MapLibreStyle, MapLibreLayer, MapLibreFilter } from './types/maplibre-public.js';
