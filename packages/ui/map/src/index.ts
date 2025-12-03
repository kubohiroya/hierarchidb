/**
 * @description Shared map components for HierarchiDB
 */

// Core map components
export { VectorTileLayer } from './components/VectorTileLayer.js';
export const loadMapWithDeckGL = () =>
  import('./components/MapWithDeckGL.js') as Promise<typeof import('./components/MapWithDeckGL.js')>;
export const loadMapLibreMap = () =>
  import('./components/MapLibreMap.js') as Promise<typeof import('./components/MapLibreMap.js')>;
export const loadMapWithVectorTiles = () =>
  import('./components/MapWithVectorTiles.js') as Promise<typeof import('./components/MapWithVectorTiles.js')>;
// Direct component exports
export { MapLibreMap } from './components/MapLibreMap.js';

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
} from './types/maplibre-public.js';

// Feature identification helpers
export {
  DEFAULT_IDENTIFY_RADIUS,
  defaultFeatureIdAccessor,
  resolveIdentifyCandidates,
} from './lib/feature-identification.js';
export type { MapFeatureIdentifyCandidates } from './lib/feature-identification.js';
