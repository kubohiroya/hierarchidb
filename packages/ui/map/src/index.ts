/**
 * @file openstreetmap-type.ts
 * @description Shared map components for HierarchiDB
 */

// Core map components
export { MapLibreMap } from './components/MapLibreMap';
export { VectorTileLayer } from './components/VectorTileLayer';
export { MapWithVectorTiles } from './components/MapWithVectorTiles';

// Type exports
export type { MapViewState, MapLibreMapProps } from './components/MapLibreMap';
export type { VectorTileLayerProps } from './components/VectorTileLayer';
export type { LayerOptions, MapWithVectorTilesProps } from './components/MapWithVectorTiles';

// Re-export important MapLibre types for convenience
export type {
  Map as MapLibreMapInstance,
  FilterSpecification,
  SourceSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl';