/**
 * @file index.ts
 * @description Shared map components for HierarchiDB
 */

// Core map components
export { MapLibreMap } from './components/MapLibreMap';
export { VectorTileLayer } from './components/VectorTileLayer';
export { MapWithVectorTiles } from './components/MapWithVectorTiles';
export { MapWithDeckGL } from './components/MapWithDeckGL';

// Type exports - unified props
export type {
  MapViewState,
  MapInteractionOptions,
  MapDimensionsProps,
  MapEventHandlers,
  MapFeatureIdentifier,
  MapClickEvent,
  MapFeatureIdentifyResult,
  MapFeatureIdentifyConfig,
  MapIdentifyProps,
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
export type { DeckOverlayProps } from './components/MapWithDeckGL';

// Layer presets
export * from './presets/vectorLayers';

//  Stable public typings do not leak upstream maplibre-gl types
export type {
  MapLibreMapInstance,
  MapLibreStyle,
  MapLibreLayer,
  MapLibreFilter,
  MapLibreGeoJSONFeature,
  MapLibreFeatureIdentifier,
  MapLibreMapMouseEvent,
  MapLibrePoint,
  MapLibreQueryGeometry,
} from './types/maplibre-public';
