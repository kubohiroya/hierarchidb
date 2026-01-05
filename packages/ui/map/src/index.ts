/**
 * @description Shared map components for HierarchiDB
 */

// Core map components
export { VectorTileLayer } from './components/VectorTileLayer.js';
export { ResourceLayerMap } from './components/ResourceLayerMap.js';
export { SimpleMapDisplay } from './components/SimpleMapDisplay.js';
export { FullMapDisplay } from './components/FullMapDisplay.js';
export const loadMapWithDeckGL = () =>
  import('./components/MapWithDeckGL.js') as Promise<typeof import('./components/MapWithDeckGL.js')>;
export const loadMapLibreMap = () =>
  import('./components/MapLibreMap.js') as Promise<typeof import('./components/MapLibreMap.js')>;
export const loadMapWithVectorTiles = () =>
  import('./components/MapWithVectorTiles.js') as Promise<typeof import('./components/MapWithVectorTiles.js')>;
// Direct component exports
export { MapLibreMap } from './components/MapLibreMap.js';
export { MapToggleCard } from './components/MapToggleCard.js';
export type { MapToggleOption, MapToggleSelection } from './components/MapToggleCard.js';

// Type exports - unified props
export type {
  MapViewState,
  MapInteractionOptions,
  MapDimensionsProps,
  MapEventHandlers,
  MapFeatureIdentifier,
  FeatureStateEntry,
  FeatureStateRecord,
  FeatureStateValue,
  MapClickEvent,
  MapFeatureIdentifyResult,
  MapFeatureIdentifyConfig,
  MapIdentifyProps,
  BaseMapProps,
  UrlBasedBaseMapProps,
  MapLibreStyleBasedBaseMapProps,
  VectorTileLayerConfig,
  VectorTileDataSource,
  VectorTileProps,
} from './types/unified-map-props.js';

// Default configuration
export { DEFAULT_MAP_CONFIG, DEFAULT_MAP_STYLE_URL } from './types/unified-map-props.js';

// Component-specific props
export type { MapLibreMapProps } from './components/MapLibreMap.js';
export type { VectorTileLayerProps } from './components/VectorTileLayer.js';
export type { MapWithVectorTilesProps, LayerOptions } from './components/MapWithVectorTiles.js';
export type { DeckOverlayProps } from './components/MapWithDeckGL.js';
export type { SimpleMapDisplayProps } from './components/SimpleMapDisplay.js';
export type { FullMapDisplayProps } from './components/FullMapDisplay.js';
export type {
  ResourceLayerMapProps,
  ResourceVectorLayer,
  ResourceGeoJsonLayer,
} from './components/ResourceLayerMap.js';
export type { MapAttributionItem, MapAttributionControlOptions } from './types/attribution.js';
export { buildCategoryFilter, mergeFilters } from './utils/layerFilters.js';

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

// Vector tile preview helpers
export { useVectorTilePreviewMetadata } from './preview/useVectorTilePreviewMetadata.js';
export { useVectorTilePreviewSearch } from './preview/useVectorTilePreviewSearch.js';
export { useVectorTilePreviewSelection } from './preview/useVectorTilePreviewSelection.js';
export { useVectorTilePreviewMapLayers } from './preview/useVectorTilePreviewMapLayers.js';
export { useMapFeatureSearch } from './preview/useMapFeatureSearch.js';
export { useMapFeatureHighlights } from './preview/useMapFeatureHighlights.js';
export { useMapFeatureHoverCandidates } from './preview/useMapFeatureHoverCandidates.js';
export { useMapFeatureSelectionGestures } from './preview/useMapFeatureSelectionGestures.js';
export { MapPreviewSearchPanel } from './preview/MapPreviewSearchPanel.js';
export { MapPreviewSearchSettingsDialog } from './preview/MapPreviewSearchSettingsDialog.js';
export type { MapSearchTargetDefinition, MapSearchTargetGroup } from './preview/mapPreviewSearchTypes.js';
export type { VectorTileMetadataLoader } from './preview/useVectorTilePreviewMetadata.js';
export type {
  SelectionResult,
  SelectionResolver,
  SelectionContextDeriver,
} from './preview/useVectorTilePreviewSelection.js';
