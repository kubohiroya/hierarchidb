/**
 * @description Shared map components for HierarchiDB
 */

export { FullMapDisplay } from './components/FullMapDisplay.js';
export { ResourceLayerMap } from './components/ResourceLayerMap.js';
export { ScreenCenterSnackbar } from './components/ScreenCenterSnackbar.js';
export { SimpleMapDisplay } from './components/SimpleMapDisplay.js';
// Core map components
export { VectorTileLayer } from './components/VectorTileLayer.js';
export const loadMapWithDeckGL = () =>
  import('./components/MapWithDeckGL.js') as Promise<
    typeof import('./components/MapWithDeckGL.js')
  >;
export const loadMapLibreMap = () =>
  import('./components/MapLibreMap.js') as Promise<typeof import('./components/MapLibreMap.js')>;
export const loadMapWithVectorTiles = () =>
  import('./components/MapWithVectorTiles.js') as Promise<
    typeof import('./components/MapWithVectorTiles.js')
  >;
export type { FullMapDisplayProps } from './components/FullMapDisplay.js';
// Component-specific props
export type { MapLibreMapProps } from './components/MapLibreMap.js';
// Direct component exports
export { MapLibreMap } from './components/MapLibreMap.js';
export type { MapToggleOption, MapToggleSelection } from './components/MapToggleCard.js';
export { MapToggleCard } from './components/MapToggleCard.js';
export type { DeckOverlayProps } from './components/MapWithDeckGL.js';
export type { LayerOptions, MapWithVectorTilesProps } from './components/MapWithVectorTiles.js';
export type {
  ResourceGeoJsonLayer,
  ResourceLayerMapProps,
  ResourceVectorLayer,
} from './components/ResourceLayerMap.js';
export type { SimpleMapDisplayProps } from './components/SimpleMapDisplay.js';
export type { VectorTileLayerProps } from './components/VectorTileLayer.js';
export {
  MapInteractionProvider,
  type MapInteractionProviderProps,
} from './interaction/MapInteractionProvider.js';
export {
  buildHighlightKey,
  createMapInteractionStore,
  type MapHighlightEntry,
  type MapHoverCandidate,
  type MapInteractionInitialState,
  mapHoverCandidatesAtom,
  mapHoveredFeaturesAtom,
  mapHoverMatchesAtom,
  mapHoverMatchKeysAtom,
  mapSearchMatchesAtom,
  mapSearchMatchKeysAtom,
  mapSearchTargetsAtom,
  mapSearchTextAtom,
  mapSelectedMatchesAtom,
  mapSelectedMatchKeysAtom,
  mapViewportFeatureIdsAtom,
} from './interaction/mapInteractionStore.js';
export type { MapFeatureIdentifyCandidates } from './lib/feature-identification.js';
// Feature identification helpers
export {
  DEFAULT_IDENTIFY_RADIUS,
  defaultFeatureIdAccessor,
  resolveIdentifyCandidates,
} from './lib/feature-identification.js';

// Layer presets
export * from './presets/vectorLayers.js';
export {
  type FeatureTableSearchConfig,
  FeatureTableToolbar,
  type FeatureTableToolbarProps,
} from './preview/FeatureTableToolbar.js';
export {
  buildFeatureCellEditRequest,
  commitFeatureTableCellEdit,
  type FeatureCellDependencyStatus,
  type FeatureCellEditRequest,
  type FeatureTableDependencyRole,
  type FeatureTableEditableColumn,
  type FeatureTableEditConfig,
  type FeatureTableEditOrigin,
  type FeatureTableEntityType,
  type FeatureTableValueKind,
  findFeatureTableEditableColumn,
} from './preview/featureTableEditContract.js';
export {
  buildLayerSetListItems,
  type LayerSetListItem,
  type LayerSetVisibility,
  LayerSetVisibilityPanel,
  type LayerSetVisibilityPanelProps,
} from './preview/LayerSetVisibilityPanel.js';
export {
  LocationPreviewList,
  type LocationPreviewListProps,
} from './preview/LocationPreviewList.js';
// Vector tile preview helpers
export {
  type AdminLevel,
  buildLayerSetEntryId,
  buildLocationLayerSetEntryId,
  buildRouteLayerSetEntryId,
  buildRouteSourceLayerName,
  buildShapeLayerEntryId,
  buildShapeLayerShortId,
  buildShapeSourceLayerName,
  buildShapeSourceLayerShortId,
  buildSourceLayerName,
  DEFAULT_LAYER_SETS,
  formatAdminLevelLabel,
  getLayerSetDefinition,
  type LayerSetDefinition,
  type LayerSetEntry,
  type LayerSetEntryId,
  type LayerSetId,
  LOCATION_POINTS_ENTRY_ID,
  LOCATION_SYMBOLS_ENTRY_ID,
  type LocationLayerSymbol,
  type NodeTypeSymbol,
  parseShapeSourceLayerName,
  type ResolvedLayerSetEntry,
  ROUTE_LINE_ENTRY_ID,
  type RouteLayerSymbol,
  resolveLayerSetEntries,
  type ShapeLayerBoundarySymbol,
  type ShapeLayerShortId,
  type ShapeLayerSymbol,
  toLayerSetEntryId,
} from './preview/layerSetDefinitions.js';
export {
  commitMapFeaturePopoverEdit,
  MapFeatureEditPopover,
  type MapFeatureEditPopoverProps,
} from './preview/MapFeatureEditPopover.js';
export {
  buildErrorSummaryById,
  type MapPreviewErrorColumnLabels,
  type MapPreviewErrorSummary,
  type MapPreviewErrorSummaryById,
  MapPreviewFloatingTable,
  type MapPreviewFloatingTableProps,
  type MapPreviewSearchConfig,
  type MapPreviewStatusLabels,
} from './preview/MapPreviewFloatingTable.js';
export { MapPreviewSearchPanel } from './preview/MapPreviewSearchPanel.js';
export { MapPreviewSearchSettingsDialog } from './preview/MapPreviewSearchSettingsDialog.js';
export { MapPreviewShell } from './preview/MapPreviewShell.js';
export type {
  MapSearchTargetDefinition,
  MapSearchTargetGroup,
} from './preview/mapPreviewSearchTypes.js';
export {
  buildRoutePreviewRows,
  type RoutePreviewColumnLabels,
  type RoutePreviewLineRow,
  RoutePreviewList,
  type RoutePreviewListCountLabels,
  type RoutePreviewListProps,
} from './preview/RoutePreviewList.js';
export {
  type ShapePreviewColumnLabels,
  type ShapePreviewFeatureRow,
  ShapePreviewList,
  type ShapePreviewListCountLabels,
  type ShapePreviewListProps,
} from './preview/ShapePreviewList.js';
export { useMapFeatureHighlights } from './preview/useMapFeatureHighlights.js';
export { useMapFeatureHoverCandidates } from './preview/useMapFeatureHoverCandidates.js';
export { useMapFeatureSearch } from './preview/useMapFeatureSearch.js';
export { useMapFeatureSelectionGestures } from './preview/useMapFeatureSelectionGestures.js';
export { useMonochromeBasemapStyleUrl } from './preview/useMonochromeBasemapStyleUrl.js';
export { useVectorTilePreviewMapLayers } from './preview/useVectorTilePreviewMapLayers.js';
export type { VectorTileMetadataLoader } from './preview/useVectorTilePreviewMetadata.js';
export { useVectorTilePreviewMetadata } from './preview/useVectorTilePreviewMetadata.js';
export { useVectorTilePreviewSearch } from './preview/useVectorTilePreviewSearch.js';
export type {
  SelectionContextDeriver,
  SelectionResolver,
  SelectionResult,
} from './preview/useVectorTilePreviewSelection.js';
export { useVectorTilePreviewSelection } from './preview/useVectorTilePreviewSelection.js';
export type { MapAttributionControlOptions, MapAttributionItem } from './types/attribution.js';
//  Stable public typings do not leak upstream maplibre-gl types
export type {
  MapLibreFeatureIdentifier,
  MapLibreFilter,
  MapLibreGeoJSONFeature,
  MapLibreLayer,
  MapLibreMapInstance,
  MapLibreMapMouseEvent,
  MapLibrePoint,
  MapLibreQueryGeometry,
  MapLibreStyle,
} from './types/maplibre-public.js';
// Type exports - unified props
export type {
  BaseMapProps,
  FeatureStateEntry,
  FeatureStateRecord,
  FeatureStateValue,
  MapClickEvent,
  MapDimensionsProps,
  MapEventHandlers,
  MapFeatureIdentifier,
  MapFeatureIdentifyConfig,
  MapFeatureIdentifyResult,
  MapIdentifyProps,
  MapInteractionOptions,
  MapLibreStyleBasedBaseMapProps,
  MapViewState,
  UrlBasedBaseMapProps,
  VectorTileDataSource,
  VectorTileLayerConfig,
  VectorTileProps,
  VectorTileRequestError,
  VectorTileRequestStats,
} from './types/unified-map-props.js';
// Default configuration
export { DEFAULT_MAP_CONFIG, DEFAULT_MAP_STYLE_URL } from './types/unified-map-props.js';
export { buildCategoryFilter, mergeFilters } from './utils/layerFilters.js';

export {
  clampTileZoom,
  filterItemsByTileIdSet,
  formatTileId,
  getViewportTileIdSet,
  lonLatToTileXY,
  resolveTileIdField,
} from './utils/tileIds.js';
