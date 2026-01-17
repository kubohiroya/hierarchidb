/**
 * @file ResourceLayerMap.tsx
 * @description Map component that composes basemap, vector layers, and style overrides.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Snackbar } from '@mui/material';
import { Close as CloseIcon, FitScreen as FitScreenIcon, Tune as TuneIcon } from '@mui/icons-material';
import { createPortal } from 'react-dom';
import type { MapLibreGeoJSONFeature, MapLibreMapInstance, MapLibreStyle } from '../types/maplibre-public.js';
import type { MapAttributionItem } from '../types/attribution.js';
import type { FeatureCollection } from 'geojson';
import { VectorTileLayer } from './VectorTileLayer.js';
import {
  DEFAULT_MAP_CONFIG,
  type BaseMapProps,
  type VectorTileDataSource,
  type VectorTileLayerConfig,
} from '../types/unified-map-props.js';
import type { MapLibreFilter } from '../types/maplibre-public.js';
import { MapLibreMap, type MapLibreMapProps } from './MapLibreMap.js';
import { MapPreviewSearchPanel } from '../preview/MapPreviewSearchPanel.js';
import { MapPreviewSearchSettingsDialog } from '../preview/MapPreviewSearchSettingsDialog.js';
import { useMapFeatureHighlights } from '../preview/useMapFeatureHighlights.js';
import { useMapFeatureHoverCandidates } from '../preview/useMapFeatureHoverCandidates.js';
import { useMapFeatureSearch } from '../preview/useMapFeatureSearch.js';
import { useMapFeatureSelectionGestures } from '../preview/useMapFeatureSelectionGestures.js';
import { defaultFeatureIdAccessor } from '../lib/feature-identification.js';
import type { MapSearchTargetDefinition, MapSearchTargetGroup } from '../preview/mapPreviewSearchTypes.js';
import {
  buildHighlightKey,
  mapHoverCandidatesAtom,
  mapHoverMatchesAtom,
  mapHoveredFeaturesAtom,
  mapSearchMatchesAtom,
  mapSearchTargetsAtom,
  mapSearchTextAtom,
  mapSelectedMatchesAtom,
  mapViewportFeatureIdsAtom,
  type MapHighlightEntry,
} from '../interaction/mapInteractionStore.js';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

type BasemapStyleEntry = {
  nodeId: string;
  absolutePath?: string;
  style: string | MapLibreStyle;
};

type MapLayerType = NonNullable<VectorTileLayerConfig['layerType']>;
type LayerStyleOverrides = Partial<Record<MapLayerType, Record<string, unknown>>>;

export type ResourceVectorLayer = VectorTileDataSource & {
  nodeId: string;
  nodeType: 'shape' | 'location' | 'route';
  dataSourceName?: string;
  absolutePath?: string;
  layerConfig?: VectorTileLayerConfig;
};

export type ResourceGeoJsonLayer = {
  layerId: string;
  sourceId: string;
  data: FeatureCollection;
  layerType: 'line' | 'circle' | 'fill' | 'symbol';
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: MapLibreFilter;
  beforeId?: string;
  absolutePath?: string;
};

export type ResourceLayerMapProps = BaseMapProps & {
  basemapStyles?: BasemapStyleEntry[];
  vectorLayers: ResourceVectorLayer[];
  geoJsonLayers?: ResourceGeoJsonLayer[];
  styleOverrides?: Record<string, unknown>;
  styleOverridesByType?: LayerStyleOverrides;
  highlightOverridesByType?: LayerStyleOverrides;
  attributionItems?: MapAttributionItem[];
  controls?: MapLibreMapProps['controls'];
  hoveredFeatures?: MapLibreGeoJSONFeature[];
  snackbar?: {
    position?: 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    renderContent?: (features: MapLibreGeoJSONFeature[]) => React.ReactNode;
    autoHideDuration?: number | null;
  };
  interaction?: {
    enabled?: boolean;
    highlightLayerIds?: string[];
    buildHighlightEntry?: (feature?: MapLibreGeoJSONFeature | null) => MapHighlightEntry | null;
    onMissingLayers?: (layerIds: string[]) => void;
    search?: {
      enabled?: boolean;
      targetDefinitions?: Record<string, MapSearchTargetDefinition>;
      targetGroups?: Array<MapSearchTargetGroup<string>>;
      placeholder?: string;
      showSettings?: boolean;
      fitOnSearch?: boolean;
      fitPadding?: number;
    };
    hover?: {
      enabled?: boolean;
      radius?: number;
    };
    selection?: {
      enabled?: boolean;
      radius?: number;
    };
    fitSelection?: {
      enabled?: boolean;
      padding?: number;
    };
    snackbar?: {
      enabled?: boolean;
      position?: 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      renderContent?: (features: MapLibreGeoJSONFeature[]) => React.ReactNode;
      autoHideDuration?: number | null;
    };
  };
};

const LAYER_PAINT_KEYS: Record<MapLayerType, Set<string>> = {
  fill: new Set(['fill-color', 'fill-opacity', 'fill-outline-color']),
  line: new Set(['line-color', 'line-opacity', 'line-width']),
  circle: new Set(['circle-color', 'circle-opacity', 'circle-radius']),
  symbol: new Set(['text-color', 'text-halo-color', 'text-halo-width']),
  raster: new Set(['raster-opacity', 'raster-brightness-max', 'raster-brightness-min', 'raster-contrast']),
  background: new Set(['background-color', 'background-opacity', 'background-pattern']),
};

const pickStyleOverrides = (
  layerType: VectorTileLayerConfig['layerType'] | undefined,
  overrides?: Record<string, unknown>,
  overridesByType?: LayerStyleOverrides,
): Record<string, unknown> => {
  const allowed = LAYER_PAINT_KEYS[layerType ?? 'fill'];
  if (!allowed) return {};
  const globalOverrides = overrides ?? {};
  const typedOverrides = overridesByType?.[layerType ?? 'fill'] ?? {};
  return Object.fromEntries(
    Object.entries({ ...typedOverrides, ...globalOverrides }).filter(([key]) => allowed.has(key))
  );
};

type SortableLayer = {
  absolutePath?: string;
  nodeId?: string;
  layerId?: string;
  sourceId?: string;
};

const sortByPath = <T extends SortableLayer>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aKey = a.absolutePath ?? a.nodeId ?? a.layerId ?? a.sourceId ?? '';
    const bKey = b.absolutePath ?? b.nodeId ?? b.layerId ?? b.sourceId ?? '';
    return aKey.localeCompare(bKey);
  });

export const ResourceLayerMap: React.FC<ResourceLayerMapProps> = (props) => {
  const {
    basemapStyles,
    vectorLayers,
    geoJsonLayers,
    styleOverrides,
    styleOverridesByType,
    highlightOverridesByType,
    hoveredFeatures,
    snackbar,
    interaction,
    mapStyleUrl,
    mapStyleObject,
    onLoad,
    attributionItems,
    controls,
    ...baseMapProps
  } = props as ResourceLayerMapProps & {
    mapStyleUrl?: string;
    mapStyleObject?: MapLibreStyle;
  };

  const resolvedControls = useMemo(() => {
    if (!attributionItems || attributionItems.length === 0) return controls;
    if (controls?.attribution === false) return controls;
    const existing = typeof controls?.attribution === 'object' ? controls.attribution : {};
    return {
      ...controls,
      attribution: {
        ...existing,
        items: attributionItems,
      },
    };
  }, [attributionItems, controls]);

  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const [mapControlContainer, setMapControlContainer] = useState<HTMLElement | null>(null);
  const [searchSettingsOpen, setSearchSettingsOpen] = useState(false);

  const orderedBasemaps = useMemo(() => (basemapStyles ? sortByPath(basemapStyles) : []), [basemapStyles]);
  const orderedLayers = useMemo(() => sortByPath(vectorLayers), [vectorLayers]);
  const orderedGeoJsonLayers = useMemo(
    () => (geoJsonLayers ? sortByPath(geoJsonLayers) : []),
    [geoJsonLayers]
  );

  const resolvedBaseStyle = useMemo(() => {
    if (orderedBasemaps.length) return orderedBasemaps[0]?.style;
    if (mapStyleObject) return mapStyleObject;
    return mapStyleUrl ?? DEFAULT_MAP_CONFIG.mapStyleUrl;
  }, [mapStyleObject, mapStyleUrl, orderedBasemaps]);

  const mapStyleProps =
    typeof resolvedBaseStyle === 'string'
      ? { mapStyleUrl: resolvedBaseStyle }
      : { mapStyleObject: resolvedBaseStyle };

  const handleMapLoad = useCallback(
    (map: MapLibreMapInstance) => {
      setMapInstance(map);
      onLoad?.(map);
    },
    [onLoad]
  );

  useEffect(() => {
    if (!mapInstance) {
      setMapControlContainer(null);
      return;
    }
    const container = mapInstance.getContainer().querySelector('.maplibregl-ctrl-top-right');
    setMapControlContainer(container instanceof HTMLElement ? container : null);
  }, [mapInstance]);

  useEffect(() => {
    if (!mapInstance || !orderedGeoJsonLayers.length) return;
    const map = mapInstance as MapLibreMapInstance & {
      addSource: (id: string, source: unknown) => void;
      addLayer: (layer: Record<string, unknown>, beforeId?: string) => void;
      getLayer: (id: string) => unknown;
      getSource: (id: string) => unknown;
      removeLayer: (id: string) => void;
      removeSource: (id: string) => void;
    };
    const sourceData = new Map<string, FeatureCollection>();
    orderedGeoJsonLayers.forEach((layer) => {
      if (!sourceData.has(layer.sourceId)) {
        sourceData.set(layer.sourceId, layer.data);
      }
    });

    orderedGeoJsonLayers.forEach((layer) => {
      if (map.getLayer(layer.layerId)) map.removeLayer(layer.layerId);
    });

    sourceData.forEach((_data, sourceId) => {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    });

    sourceData.forEach((data, sourceId) => {
      map.addSource(sourceId, { type: 'geojson', data });
    });

    orderedGeoJsonLayers.forEach((layer) => {
      map.addLayer(
        {
          id: layer.layerId,
          type: layer.layerType,
          source: layer.sourceId,
          paint: layer.paint ?? {},
          layout: layer.layout ?? {},
          ...(layer.filter ? { filter: layer.filter } : {}),
        },
        layer.beforeId,
      );
    });

    return () => {
      orderedGeoJsonLayers.forEach((layer) => {
        if (map.getLayer(layer.layerId)) map.removeLayer(layer.layerId);
      });
      sourceData.forEach((_data, sourceId) => {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });
    };
  }, [mapInstance, orderedGeoJsonLayers]);

  const interactionEnabled = interaction ? (interaction.enabled ?? true) : false;
  const searchConfig = interaction?.search;
  const hoverConfig = interaction?.hover;
  const selectionConfig = interaction?.selection;
  const fitSelectionConfig = interaction?.fitSelection;
  const interactionSnackbar = interaction?.snackbar;

  const searchEnabled = interactionEnabled && Boolean(searchConfig?.enabled ?? searchConfig?.targetDefinitions);
  const hoverEnabled = interactionEnabled && (hoverConfig?.enabled ?? true);
  const selectionEnabled = interactionEnabled && (selectionConfig?.enabled ?? true);
  const fitSelectionEnabled = interactionEnabled && (fitSelectionConfig?.enabled ?? true);
  const snackbarEnabled = interactionEnabled ? (interactionSnackbar?.enabled ?? true) : Boolean(snackbar);

  const highlightLayerIds = useMemo(() => {
    if (interaction?.highlightLayerIds?.length) return interaction.highlightLayerIds;
    return [
      ...orderedLayers.map((layer) => layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`),
      ...orderedGeoJsonLayers.map((layer) => layer.layerId),
    ];
  }, [interaction?.highlightLayerIds, orderedGeoJsonLayers, orderedLayers]);

  const buildHighlightEntry = useCallback(
    (feature?: MapLibreGeoJSONFeature | null) => {
      if (interaction?.buildHighlightEntry) {
        return interaction.buildHighlightEntry(feature);
      }
      if (!feature) return null;
      const id = defaultFeatureIdAccessor(feature);
      const source = typeof feature.source === 'string' ? feature.source : undefined;
      if (id === undefined || id === null || !source) return null;
      const layerId = typeof feature.layer?.id === 'string' ? feature.layer.id : undefined;
      return { source, id, layerId };
    },
    [interaction?.buildHighlightEntry],
  );

  const [searchText, setSearchText] = useAtom(mapSearchTextAtom);
  const [searchTargets, setSearchTargets] = useAtom(mapSearchTargetsAtom);
  const setSearchMatches = useSetAtom(mapSearchMatchesAtom);
  const setHoverCandidates = useSetAtom(mapHoverCandidatesAtom);
  const setHoverMatches = useSetAtom(mapHoverMatchesAtom);
  const searchMatches = useAtomValue(mapSearchMatchesAtom);
  const hoverMatches = useAtomValue(mapHoverMatchesAtom);
  const hoveredInteractionFeatures = useAtomValue(mapHoveredFeaturesAtom);
  const selectedMatches = useAtomValue(mapSelectedMatchesAtom);
  const setSelectedMatches = useSetAtom(mapSelectedMatchesAtom);
  const setViewportFeatureIds = useSetAtom(mapViewportFeatureIdsAtom);

  useEffect(() => {
    if (!searchEnabled || !searchConfig?.targetDefinitions) return;
    if (Object.keys(searchTargets).length > 0) return;
    const defaults = Object.fromEntries(
      Object.keys(searchConfig.targetDefinitions).map((targetId) => [targetId, true]),
    );
    setSearchTargets(defaults);
  }, [searchConfig?.targetDefinitions, searchEnabled, searchTargets, setSearchTargets]);

  const dedupeEntries = useCallback((entries: MapHighlightEntry[]) => {
    const map = new Map<string, MapHighlightEntry>();
    entries.forEach((entry) => {
      map.set(buildHighlightKey(entry), entry);
    });
    return Array.from(map.values());
  }, []);

  const applySelectionChange = useCallback(
    (mode: 'replace' | 'toggle' | 'add' | 'clear' | 'box', entries: MapHighlightEntry[]) => {
      if (mode === 'clear') {
        setSelectedMatches([]);
        return;
      }
      if (mode === 'replace') {
        setSelectedMatches(dedupeEntries(entries));
        return;
      }
      if (mode === 'box') {
        setSelectedMatches((prev) => {
          const next = new Map(prev.map((entry) => [buildHighlightKey(entry), entry]));
          entries.forEach((entry) => {
            next.set(buildHighlightKey(entry), entry);
          });
          return Array.from(next.values());
        });
        return;
      }
      setSelectedMatches((prev) => {
        const next = new Map(prev.map((entry) => [buildHighlightKey(entry), entry]));
        entries.forEach((entry) => {
          const key = buildHighlightKey(entry);
          if (mode === 'toggle') {
            if (next.has(key)) {
              next.delete(key);
            } else {
              next.set(key, entry);
            }
          } else {
            next.set(key, entry);
          }
        });
        return Array.from(next.values());
      });
    },
    [dedupeEntries, setSelectedMatches],
  );

  const fitPadding = fitSelectionConfig?.padding ?? 64;
  const fitSearchPadding = searchConfig?.fitPadding ?? 64;

  const visitCoordinates = useCallback(
    (coords: unknown, bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null) => {
      if (!Array.isArray(coords)) return bounds;
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        const [lng, lat] = coords;
        if (!bounds) {
          return { minLng: lng, minLat: lat, maxLng: lng, maxLat: lat };
        }
        return {
          minLng: Math.min(bounds.minLng, lng),
          minLat: Math.min(bounds.minLat, lat),
          maxLng: Math.max(bounds.maxLng, lng),
          maxLat: Math.max(bounds.maxLat, lat),
        };
      }
      return coords.reduce(
        (current, entry) => visitCoordinates(entry, current),
        bounds,
      );
    },
    [],
  );

  const fitToFeatures = useCallback(
    (features: MapLibreGeoJSONFeature[], padding: number) => {
      if (!mapInstance || features.length === 0) return;
      let bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null = null;
      features.forEach((feature) => {
        const geometry = (feature as { geometry?: { coordinates?: unknown } }).geometry;
        if (!geometry?.coordinates) return;
        bounds = visitCoordinates(geometry.coordinates, bounds);
      });
      if (!bounds) return;
      mapInstance.fitBounds(
        [
          [bounds.minLng, bounds.minLat],
          [bounds.maxLng, bounds.maxLat],
        ],
        { padding },
      );
    },
    [mapInstance, visitCoordinates],
  );

  const handleFitSelection = useCallback(() => {
    if (!mapInstance || selectedMatches.length === 0) return;
    const selectedKeySet = new Set(selectedMatches.map(buildHighlightKey));
    const canvas = mapInstance.getCanvas();
    const queryBounds: [[number, number], [number, number]] = [
      [0, 0],
      [canvas.width, canvas.height],
    ];
    let features: MapLibreGeoJSONFeature[] = [];
    try {
      features = mapInstance.queryRenderedFeatures(queryBounds, { layers: highlightLayerIds }) as MapLibreGeoJSONFeature[];
    } catch (error) {
      console.debug('[ResourceLayerMap] Failed to query selected features', error);
      return;
    }
    const matched = features.filter((feature) => {
      const source = typeof feature.source === 'string' ? feature.source : undefined;
      const id = defaultFeatureIdAccessor(feature);
      if (!source || id === undefined || id === null) return false;
      return selectedKeySet.has(`${source}:${id}`);
    });
    fitToFeatures(matched, fitPadding);
  }, [fitPadding, fitToFeatures, highlightLayerIds, mapInstance, selectedMatches]);

  const {
    runSearch,
    handleSearchClear,
    handleSearchTargetToggle,
  } = useMapFeatureSearch({
    mapInstance: searchEnabled ? mapInstance : null,
    highlightLayerIds,
    searchText,
    searchTargets,
    targetDefinitions: searchConfig?.targetDefinitions ?? {},
    buildHighlightEntry,
    onMatchesChange: (entries) => {
      setSearchMatches(entries);
    },
    onFeaturesChange: (features) => {
      if (searchConfig?.fitOnSearch) {
        fitToFeatures(features, fitSearchPadding);
      }
    },
    setSearchText,
    setSearchTargets: (updater) => setSearchTargets((prev) => updater(prev)),
    onMissingLayers: interaction?.onMissingLayers,
  });

  useMapFeatureHoverCandidates({
    mapInstance: hoverEnabled ? mapInstance : null,
    highlightLayerIds,
    buildHighlightEntry,
    radius: hoverConfig?.radius,
    onHoverChange: (entries, features) => {
      const candidates = features
        .map((feature) => {
          const entry = buildHighlightEntry(feature);
          if (!entry) return null;
          return { entry, feature };
        })
        .filter((candidate): candidate is { entry: MapHighlightEntry; feature: MapLibreGeoJSONFeature } => Boolean(candidate));
      setHoverCandidates(candidates);
      setHoverMatches(entries);
    },
  });

  useMapFeatureSelectionGestures({
    mapInstance: selectionEnabled ? mapInstance : null,
    highlightLayerIds,
    buildHighlightEntry,
    radius: selectionConfig?.radius,
    onSelectionChange: applySelectionChange,
  });

  useMapFeatureHighlights({
    mapInstance: interactionEnabled ? mapInstance : null,
    highlightLayerIds,
    searchMatches,
    hoverMatches,
    selectedMatches,
    onViewportLayerIdsChange: interactionEnabled ? setViewportFeatureIds : undefined,
    onMissingLayers: interaction?.onMissingLayers,
  });

  const snackbarFeatures = interactionEnabled ? hoveredInteractionFeatures : (hoveredFeatures ?? []);
  const effectiveSnackbar = interactionEnabled ? (interactionSnackbar ?? snackbar ?? {}) : snackbar;
  const snackbarPosition = effectiveSnackbar?.position ?? 'bottom';
  const anchorOrigin = (() => {
    switch (snackbarPosition) {
      case 'top':
        return { vertical: 'top', horizontal: 'center' } as const;
      case 'top-left':
        return { vertical: 'top', horizontal: 'left' } as const;
      case 'top-right':
        return { vertical: 'top', horizontal: 'right' } as const;
      case 'bottom-left':
        return { vertical: 'bottom', horizontal: 'left' } as const;
      case 'bottom-right':
        return { vertical: 'bottom', horizontal: 'right' } as const;
      default:
        return { vertical: 'bottom', horizontal: 'center' } as const;
    }
  })();
  const snackbarContent =
    effectiveSnackbar?.renderContent?.(snackbarFeatures)
    ?? (snackbarFeatures.length ? `(${snackbarFeatures.length} features)` : '');

  return (
    <>
      <MapLibreMap
        {...baseMapProps}
        {...mapStyleProps}
        onLoad={handleMapLoad}
        controls={resolvedControls}
      >
        {mapInstance &&
          orderedLayers.map((layer) => {
            const layerConfig = { ...DEFAULT_MAP_CONFIG.vectorTileLayer, ...layer.layerConfig };
            const layerType = layerConfig.layerType ?? 'fill';
            const paintOverrides = pickStyleOverrides(layerType, styleOverrides, styleOverridesByType);
            const highlightOverrides = highlightOverridesByType?.[layerType] ?? {};
            const layerPaint = { ...(layerConfig.paint ?? {}), ...paintOverrides, ...highlightOverrides };
            const layerId = layerConfig.layerId ?? `resource-layer-${layer.nodeId}`;
            const sourceId = layerConfig.sourceId ?? `resource-source-${layer.nodeId}`;

            return (
              <VectorTileLayer
                key={layerId}
                map={mapInstance}
                dbName={layer.dbName}
                nodeId={layer.nodeId}
                tiles={layer.tiles}
                tileDataProvider={layer.tileDataProvider}
                layerId={layerId}
                sourceId={sourceId}
                promoteId={layer.promoteId}
                featureState={layer.featureState}
                paint={layerPaint}
                layout={layerConfig.layout}
                filter={layerConfig.filter}
                minzoom={layerConfig.minzoom}
                maxzoom={layerConfig.maxzoom}
                layerType={layerType}
                sourceLayer={layerConfig.sourceLayer}
                visible={layerConfig.visible}
              />
            );
          })}
      </MapLibreMap>
      {searchEnabled && searchConfig?.targetDefinitions ? (
        <>
          <MapPreviewSearchPanel
            searchText={searchText}
            onSearchTextChange={setSearchText}
            onSearch={runSearch}
            onClear={handleSearchClear}
            onOpenSettings={() => setSearchSettingsOpen(true)}
            clearIcon={<CloseIcon fontSize="small" />}
            settingsIcon={<TuneIcon fontSize="small" />}
            showSettingsButton={searchConfig.showSettings ?? Boolean(searchConfig.targetGroups?.length)}
            placeholder={searchConfig.placeholder}
            showFitScreenButton={false}
          />
          {searchConfig.targetGroups ? (
            <MapPreviewSearchSettingsDialog
              open={searchSettingsOpen}
              searchTargets={searchTargets as Record<string, boolean>}
              targetGroups={searchConfig.targetGroups}
              targetDefinitions={searchConfig.targetDefinitions}
              onClose={() => setSearchSettingsOpen(false)}
              onToggleTarget={(targetId) => handleSearchTargetToggle(targetId)}
            />
          ) : null}
        </>
      ) : null}
      {fitSelectionEnabled && mapControlContainer ? (
        createPortal(
          <Box className="maplibregl-ctrl" sx={{ mt: 2 }}>
            <Button
              aria-label="Fit selection"
              size="large"
              variant="outlined"
              onClick={handleFitSelection}
              disabled={selectedMatches.length === 0}
              sx={{
                minWidth: 0,
                height: 32,
                minHeight: 32,
                padding: 0.5,
                m: 0.5,
                bgcolor: 'background.paper',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <FitScreenIcon fontSize="small" />
            </Button>
          </Box>,
          mapControlContainer,
        )
      ) : null}
      {effectiveSnackbar && (
        <Snackbar
          open={snackbarEnabled && snackbarFeatures.length > 0}
          autoHideDuration={effectiveSnackbar.autoHideDuration ?? null}
          message={snackbarContent}
          anchorOrigin={anchorOrigin}
        />
      )}
    </>
  );
};
