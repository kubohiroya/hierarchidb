import type {
  MapAttributionItem,
  MapLibreGeoJSONFeature,
  MapLibreMapInstance,
  MapToggleSelection,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  buildCategoryFilter,
  DEFAULT_MAP_CONFIG,
  MapPreviewSearchPanel,
  MapPreviewSearchSettingsDialog,
  ResourceLayerMap,
  defaultFeatureIdAccessor,
  useMapFeatureHoverCandidates,
  useMapFeatureHighlights,
  useMapFeatureSearch,
  useMapFeatureSelectionGestures,
  mergeFilters,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Close as CloseIcon, Tune as TuneIcon } from '@mui/icons-material';
import { useLoaderData, useParams, useSearch } from '@tanstack/react-router';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useGeolocationImport from 'react-hook-geolocation';
import { MaplibreExportControl } from '@watergis/maplibre-gl-export';
import { SHAPE_DATA_SOURCES } from '@hierarchidb/shape-plugin';
import { resolveLocationAttribution } from '@hierarchidb/location-plugin';
import { ROUTE_DATA_SOURCES } from '@hierarchidb/route-plugin';
import {
  mapHoverMatchAtom,
  mapLayerInfoAtom,
  mapSearchMatchesAtom,
  mapSearchTargetSelectionAtom,
  mapSearchTextAtom,
  mapSelectedMatchAtom,
  mapStylerToggleAtom,
  mapViewportFeatureIdsAtom,
} from '../../../state/mapSearch.atoms.js';
import type { MapFeatureIdSet, MapHighlightEntry, MapLayerInfo } from '../../../state/mapSearch.atoms.js';
import { ModelessDialogManager } from '../modeless/ModelessDialogManager.js';
import { LOCATION_TYPE_OPTIONS, ROUTE_MODE_OPTIONS, SEARCH_TARGET_DEFINITIONS, SEARCH_TARGET_GROUPS } from './constants.js';
import { useFolderLayers } from './useFolderLayers.js';
import { useMapViewState } from './useMapViewState.js';
import type { MapSearch } from './types.js';
import type { MapViewState as LoaderMapViewState } from '../../loaders/mapLoader.js';
import '@watergis/maplibre-gl-export/dist/maplibre-gl-export.css';

export default function MapPage() {
  const useGeolocation =
    (useGeolocationImport as unknown as { default?: typeof useGeolocationImport }).default ??
    useGeolocationImport;
  const theme = useTheme();
  const { nodeId } = useParams({ from: '/map/$nodeId' });
  const search = useSearch({ from: '/map/$nodeId' }) as MapSearch;
  const loaderViewState = useLoaderData({ from: '/map/$nodeId' }) as LoaderMapViewState;
  const geolocation = useGeolocation();
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const [searchSettingsOpen, setSearchSettingsOpen] = useState(false);
  const [hoveredFeatures, setHoveredFeatures] = useState<MapLibreGeoJSONFeature[]>([]);
  const [searchText, setSearchText] = useAtom(mapSearchTextAtom);
  const [stylerToggles, setStylerToggles] = useAtom(mapStylerToggleAtom);
  const [searchTargets, setSearchTargets] = useAtom(mapSearchTargetSelectionAtom);
  const [searchMatchIds, setSearchMatchIds] = useAtom(mapSearchMatchesAtom);
  const [hoverMatchIds, setHoverMatchIds] = useAtom(mapHoverMatchAtom);
  const [selectedMatchIds, setSelectedMatchIds] = useAtom(mapSelectedMatchAtom);
  const setViewportFeatureIds = useSetAtom(mapViewportFeatureIdsAtom);
  const [locationTypeSelection, setLocationTypeSelection] = useState<MapToggleSelection>(() =>
    Object.fromEntries(LOCATION_TYPE_OPTIONS.map((option) => [option.id, true])) as MapToggleSelection
  );
  const [routeModeSelection, setRouteModeSelection] = useState<MapToggleSelection>(() =>
    Object.fromEntries(ROUTE_MODE_OPTIONS.map((option) => [option.id, true])) as MapToggleSelection
  );
  const mapInstanceRef = useRef<MapLibreMapInstance | null>(null);
  const exportControlRef = useRef<MaplibreExportControl | null>(null);

  const { initialViewState, formattedZxy, handleViewStateChange, applyPersistedZxy } = useMapViewState({
    nodeId,
    searchZxy: search?.zxy,
    loaderViewState,
    geolocation,
  });

  const { basemapStyles, vectorLayers, geoJsonLayers, styleOverridesByType, mapInfo, stylerSummaries } = useFolderLayers({
    nodeId,
    searchZxy: search?.zxy,
    onPersistedZxy: applyPersistedZxy,
    stylerToggles,
  });

  const setMapLayerInfo = useSetAtom(mapLayerInfoAtom);
  const { list: layerInfoList, byId: layerInfoById, bySource: layerInfoBySource } = useMemo(() => {
    const list: MapLayerInfo[] = [];
    const byId = new Map<string, MapLayerInfo>();
    const bySource = new Map<string, MapLayerInfo>();
    vectorLayers.forEach((layer) => {
      const layerId = layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`;
      const sourceId = layer.layerConfig?.sourceId ?? `resource-source-${layer.nodeId}`;
      const info = {
        nodeId: layer.nodeId,
        nodeType: layer.nodeType,
        layerId,
        sourceId,
      };
      list.push(info);
      byId.set(layerId, info);
      bySource.set(sourceId, info);
    });
    return { list, byId, bySource };
  }, [vectorLayers]);

  useEffect(() => {
    setMapLayerInfo(layerInfoList);
  }, [layerInfoList, setMapLayerInfo]);

  useEffect(() => {
    if (stylerSummaries.length === 0) return;
    setStylerToggles((prev) => {
      const next = { ...prev };
      let changed = false;
      stylerSummaries.forEach((entry) => {
        if (next[entry.nodeId] === undefined) {
          next[entry.nodeId] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [setStylerToggles, stylerSummaries]);

  const highlightLayerIds = useMemo(
    () => vectorLayers.map((layer) => layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`),
    [vectorLayers],
  );


  const layerInfoByNodeType = useMemo(() => {
    const map = new Map<string, MapLayerInfo>();
    layerInfoList.forEach((info) => {
      map.set(`${info.nodeId}:${info.nodeType}`, info);
    });
    return map;
  }, [layerInfoList]);

  const buildEntriesFromIdSet = useCallback(
    (idSet: MapFeatureIdSet): MapHighlightEntry[] => {
      const entries: MapHighlightEntry[] = [];
      Object.entries(idSet).forEach(([nodeId, byType]) => {
        if (!byType) return;
        Object.entries(byType).forEach(([nodeType, ids]) => {
          if (!ids) return;
          const info = layerInfoByNodeType.get(`${nodeId}:${nodeType}`);
          if (!info) return;
          ids.forEach((id) => {
            entries.push({
              source: info.sourceId,
              id,
              layerId: info.layerId,
              nodeId: info.nodeId,
              nodeType: info.nodeType,
            });
          });
        });
      });
      return entries;
    },
    [layerInfoByNodeType],
  );

  const buildHighlightEntry = useCallback(
    (feature?: MapLibreGeoJSONFeature | null) => {
      if (!feature) return null;
      const id = defaultFeatureIdAccessor(feature);
      const source = typeof feature.source === 'string' ? feature.source : undefined;
      if (id === undefined || id === null || !source) return null;
      const layerId = typeof feature.layer?.id === 'string' ? feature.layer.id : undefined;
      const meta = layerId ? layerInfoById.get(layerId) : undefined;
      const resolved = meta ?? (typeof feature.source === 'string' ? layerInfoBySource.get(feature.source) : undefined);
      return {
        source,
        id,
        layerId,
        nodeId: resolved?.nodeId,
        nodeType: resolved?.nodeType,
      };
    },
    [layerInfoById, layerInfoBySource]
  );

  const handleViewportLayerIdsChange = useCallback(
    (layerIds: Map<string, Set<string | number>>) => {
      const next: MapFeatureIdSet = {};
      layerInfoById.forEach((info, layerId) => {
        const ids = layerIds.get(layerId);
        if (!ids) return;
        if (!next[info.nodeId]) next[info.nodeId] = {};
        next[info.nodeId]![info.nodeType] = new Set(ids);
      });
      setViewportFeatureIds(next);
    },
    [layerInfoById, setViewportFeatureIds]
  );

  const searchMatchEntries = useMemo(
    () => buildEntriesFromIdSet(searchMatchIds),
    [buildEntriesFromIdSet, searchMatchIds],
  );
  const hoverEntries = useMemo(
    () => buildEntriesFromIdSet(hoverMatchIds),
    [buildEntriesFromIdSet, hoverMatchIds],
  );
  const selectedEntries = useMemo(
    () => buildEntriesFromIdSet(selectedMatchIds),
    [buildEntriesFromIdSet, selectedMatchIds],
  );

  useMapFeatureHighlights({
    mapInstance,
    highlightLayerIds,
    searchMatches: searchMatchEntries,
    hoverMatches: hoverEntries,
    selectedMatches: selectedEntries,
    onViewportLayerIdsChange: handleViewportLayerIdsChange,
  });

  const updateIdSetFromEntries = useCallback(
    (entries: MapHighlightEntry[]): MapFeatureIdSet => {
      const next: MapFeatureIdSet = {};
      entries.forEach((entry) => {
        if (!entry.nodeId || !entry.nodeType) return;
        if (!next[entry.nodeId]) next[entry.nodeId] = {};
        const typeSet = next[entry.nodeId]![entry.nodeType] ?? new Set<string | number>();
        typeSet.add(entry.id);
        next[entry.nodeId]![entry.nodeType] = typeSet;
      });
      return next;
    },
    [],
  );

  const { runSearch, handleSearchClear, handleSearchTargetToggle } = useMapFeatureSearch({
    mapInstance,
    highlightLayerIds,
    searchText,
    searchTargets,
    targetDefinitions: SEARCH_TARGET_DEFINITIONS,
    buildHighlightEntry,
    onMatchesChange: (entries) => {
      setSearchMatchIds(updateIdSetFromEntries(entries));
    },
    setSearchText,
    setSearchTargets,
  });

  useMapFeatureHoverCandidates({
    mapInstance,
    highlightLayerIds,
    buildHighlightEntry,
    onHoverChange: (entries, features) => {
      setHoverMatchIds(updateIdSetFromEntries(entries));
      setHoveredFeatures(features);
    },
  });

  const applySelectionChange = useCallback(
    (mode: 'replace' | 'toggle' | 'add' | 'clear' | 'box', entries: MapHighlightEntry[]) => {
      if (mode === 'clear') {
        setSelectedMatchIds({});
        return;
      }
      if (mode === 'replace') {
        setSelectedMatchIds(updateIdSetFromEntries(entries));
        return;
      }
      if (mode === 'box') {
        setSelectedMatchIds(updateIdSetFromEntries(entries));
        return;
      }
      setSelectedMatchIds((prev) => {
        const next: MapFeatureIdSet = {};
        Object.entries(prev).forEach(([nodeId, byType]) => {
          next[nodeId] = {};
          if (!byType) return;
          Object.entries(byType).forEach(([nodeType, ids]) => {
            if (!ids) return;
            next[nodeId]![nodeType as MapLayerInfo['nodeType']] = new Set(ids);
          });
        });
        entries.forEach((entry) => {
          if (!entry.nodeId || !entry.nodeType) return;
          if (!next[entry.nodeId]) next[entry.nodeId] = {};
          const current = next[entry.nodeId]![entry.nodeType] ?? new Set<string | number>();
          if (mode === 'toggle') {
            if (current.has(entry.id)) {
              current.delete(entry.id);
            } else {
              current.add(entry.id);
            }
          } else if (mode === 'add') {
            current.add(entry.id);
          }
          next[entry.nodeId]![entry.nodeType] = current;
        });
        return next;
      });
    },
    [setSelectedMatchIds, updateIdSetFromEntries],
  );

  useMapFeatureSelectionGestures({
    mapInstance,
    highlightLayerIds,
    buildHighlightEntry,
    onSelectionChange: applySelectionChange,
  });

  const routeModeOptions = useMemo(
    () => ROUTE_MODE_OPTIONS.map(({ id, label, icon }) => ({ id, label, icon })),
    [],
  );

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    console.log('[MapPage] Map loaded', map);
    mapInstanceRef.current = map;
    setMapInstance(map);
    if (!exportControlRef.current) {
      const control = new MaplibreExportControl({
        Format: 'pdf',
        Local: 'ja',
        Filename: nodeId ? `map-${nodeId}` : 'map-export',
      });
      map.addControl(control, 'bottom-left');
      exportControlRef.current = control;
    }
  }, [nodeId]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current && exportControlRef.current) {
        mapInstanceRef.current.removeControl(exportControlRef.current);
        exportControlRef.current = null;
      }
    };
  }, []);

  const mapStyleUrl = useMemo(() => {
    if (basemapStyles.length) return undefined;
    return DEFAULT_MAP_CONFIG.mapStyleUrl;
  }, [basemapStyles.length]);

  const locationKinds = useMemo(
    () => LOCATION_TYPE_OPTIONS.map((option) => option.id),
    []
  );
  const enabledLocationKinds = useMemo(
    () => LOCATION_TYPE_OPTIONS.filter((option) => locationTypeSelection[option.id]).map((option) => option.id),
    [locationTypeSelection],
  );
  const routeModeValues = useMemo(
    () => Array.from(new Set(ROUTE_MODE_OPTIONS.flatMap((option) => option.modes))),
    []
  );
  const enabledRouteModes = useMemo(
    () => ROUTE_MODE_OPTIONS.filter((option) => routeModeSelection[option.id]).flatMap((option) => option.modes),
    [routeModeSelection],
  );
  const filteredVectorLayers = useMemo(() => {
    const locationFilter = buildCategoryFilter(enabledLocationKinds, locationKinds, ['kind', 'type']);
    const routeFilter = buildCategoryFilter(enabledRouteModes, routeModeValues, ['routeMode', 'mode', 'route_mode']);
    return vectorLayers.map((layer) => {
      if (layer.nodeType === 'location') {
        const baseConfig = layer.layerConfig ?? {};
        const nextVisible = enabledLocationKinds.length === 0 ? false : baseConfig.visible;
        return {
          ...layer,
          layerConfig: {
            ...baseConfig,
            visible: nextVisible,
            filter: mergeFilters(baseConfig.filter, locationFilter),
          },
        };
      }
      if (layer.nodeType === 'route') {
        const baseConfig = layer.layerConfig ?? {};
        const nextVisible = enabledRouteModes.length === 0 ? false : baseConfig.visible;
        return {
          ...layer,
          layerConfig: {
            ...baseConfig,
            visible: nextVisible,
            filter: mergeFilters(baseConfig.filter, routeFilter),
          },
        };
      }
      return layer;
    });
  }, [enabledLocationKinds, enabledRouteModes, locationKinds, routeModeValues, vectorLayers]);

  const attributionItems = useMemo<MapAttributionItem[]>(() => {
    const items: MapAttributionItem[] = [];
    const resolveShape = (dataSourceName?: string | null) => {
      if (!dataSourceName) return null;
      const normalized = dataSourceName.toLowerCase();
      const config = SHAPE_DATA_SOURCES.find((source) => source.name.toLowerCase() === normalized);
      if (!config) return null;
      return {
        id: `shape:${config.name}`,
        label: config.displayName ?? config.name,
        attribution: config.attribution,
        license: config.license,
        licenseUrl: config.licenseUrl,
      } satisfies MapAttributionItem;
    };
    const resolveRoute = (dataSourceName?: string | null) => {
      if (!dataSourceName) return null;
      const normalized = dataSourceName.toLowerCase();
      const config = ROUTE_DATA_SOURCES.find((source) => source.name.toLowerCase() === normalized);
      if (!config) return null;
      return {
        id: `route:${config.name}`,
        label: config.displayName ?? config.name,
        attribution: config.attribution,
        url: config.website,
        license: config.license,
        licenseUrl: config.licenseUrl,
      } satisfies MapAttributionItem;
    };

    filteredVectorLayers.forEach((layer) => {
      const dataSourceName = layer.dataSourceName ?? null;
      if (!dataSourceName) return;
      if (layer.nodeType === 'shape') {
        const item = resolveShape(dataSourceName);
        if (item) items.push(item);
        return;
      }
      if (layer.nodeType === 'route') {
        const item = resolveRoute(dataSourceName);
        if (item) items.push(item);
        return;
      }
      if (layer.nodeType === 'location') {
        const info = resolveLocationAttribution(dataSourceName);
        if (!info) return;
        items.push({
          id: `location:${info.id}`,
          label: info.label,
          attribution: info.attribution,
          url: info.url,
          license: info.license,
          licenseUrl: info.licenseUrl,
        });
      }
    });

    return items;
  }, [filteredVectorLayers]);

  const highlightPaintByType = useMemo(() => {
    const searchColor = '#ffd54f';
    const hoverColor = '#ffecb3';
    const selectedColor = theme.palette.primary.main;
    const baseFillColor = styleOverridesByType.fill?.['fill-color'] ?? '#6aa6ff';
    const baseLineColor = styleOverridesByType.line?.['line-color'] ?? '#f24c3d';
    const baseCircleColor = styleOverridesByType.circle?.['circle-color'] ?? '#2f74ff';
    const baseLineWidth = styleOverridesByType.line?.['line-width'] ?? 2;
    const baseCircleRadius = styleOverridesByType.circle?.['circle-radius'] ?? 4;

    const hasSearch = ['boolean', ['feature-state', 'hdbSearch'], false];
    const hasHover = ['boolean', ['feature-state', 'hdbHover'], false];
    const hasSelected = ['boolean', ['feature-state', 'hdbSelected'], false];

    const colorExpression = (base: unknown) => [
      'case',
      hasSelected,
      selectedColor,
      hasHover,
      hoverColor,
      hasSearch,
      searchColor,
      base,
    ];

    return {
      fill: {
        'fill-color': colorExpression(baseFillColor),
        'fill-outline-color': colorExpression(styleOverridesByType.fill?.['fill-outline-color'] ?? baseFillColor),
        'fill-opacity': [
          'case',
          hasSelected,
          0.65,
          hasHover,
          0.55,
          hasSearch,
          0.45,
          styleOverridesByType.fill?.['fill-opacity'] ?? 0.3,
        ],
      },
      line: {
        'line-color': colorExpression(baseLineColor),
        'line-width': [
          'case',
          hasSelected,
          3.5,
          hasHover,
          2.8,
          hasSearch,
          2.4,
          baseLineWidth,
        ],
        'line-opacity': [
          'case',
          hasSelected,
          0.95,
          hasHover,
          0.9,
          hasSearch,
          0.85,
          styleOverridesByType.line?.['line-opacity'] ?? 0.8,
        ],
        'line-blur': [
          'case',
          hasHover,
          1.4,
          hasSearch,
          1.2,
          hasSelected,
          0.6,
          styleOverridesByType.line?.['line-blur'] ?? 0,
        ],
      },
      circle: {
        'circle-color': colorExpression(baseCircleColor),
        'circle-radius': [
          'case',
          hasSelected,
          7,
          hasHover,
          6,
          hasSearch,
          5,
          baseCircleRadius,
        ],
        'circle-opacity': [
          'case',
          hasSelected,
          0.95,
          hasHover,
          0.9,
          hasSearch,
          0.85,
          styleOverridesByType.circle?.['circle-opacity'] ?? 0.8,
        ],
        'circle-blur': [
          'case',
          hasHover,
          0.8,
          hasSearch,
          0.6,
          hasSelected,
          0.4,
          styleOverridesByType.circle?.['circle-blur'] ?? 0,
        ],
        'circle-stroke-color': colorExpression(styleOverridesByType.circle?.['circle-stroke-color'] ?? baseCircleColor),
        'circle-stroke-width': [
          'case',
          hasSelected,
          2,
          hasHover,
          1.5,
          hasSearch,
          1,
          styleOverridesByType.circle?.['circle-stroke-width'] ?? 0,
        ],
      },
    };
  }, [styleOverridesByType, theme.palette.primary.main]);

  const handleLocationTypeToggle = useCallback((id: string) => {
    setLocationTypeSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleRouteModeToggle = useCallback((id: string) => {
    setRouteModeSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return (
    <Box sx={{ width: '100vw', height: '100vh', position: 'relative', overscrollBehavior: 'contain' }}>
      {nodeId ? (
        <ModelessDialogManager
          nodeId={nodeId}
          formattedZxy={formattedZxy}
          basemapStyles={basemapStyles}
          vectorLayers={vectorLayers}
          geoJsonLayers={geoJsonLayers}
          mapInfo={mapInfo}
          stylerSummaries={stylerSummaries}
          stylerToggles={stylerToggles}
          onToggleStyler={(stylerId, enabled) => {
            setStylerToggles((prev) => ({ ...prev, [stylerId]: enabled }));
          }}
          locationTypeOptions={LOCATION_TYPE_OPTIONS}
          routeModeOptions={routeModeOptions}
          locationTypeSelection={locationTypeSelection}
          routeModeSelection={routeModeSelection}
          onToggleLocationType={handleLocationTypeToggle}
          onToggleRouteMode={handleRouteModeToggle}
        />
      ) : null}

      <MapPreviewSearchPanel
        searchText={searchText}
        onSearchTextChange={setSearchText}
        onSearch={runSearch}
        onClear={handleSearchClear}
        onOpenSettings={() => setSearchSettingsOpen(true)}
        clearIcon={<CloseIcon fontSize="small" />}
        settingsIcon={<TuneIcon fontSize="small" />}
      />

      <MapPreviewSearchSettingsDialog
        open={searchSettingsOpen}
        searchTargets={searchTargets}
        targetGroups={SEARCH_TARGET_GROUPS}
        targetDefinitions={SEARCH_TARGET_DEFINITIONS}
        onClose={() => setSearchSettingsOpen(false)}
        onToggleTarget={handleSearchTargetToggle}
      />

      <ResourceLayerMap
        initialViewState={initialViewState}
        width="100%"
        height="100%"
        mapStyleUrl={mapStyleUrl}
        basemapStyles={basemapStyles}
        vectorLayers={filteredVectorLayers}
        geoJsonLayers={geoJsonLayers}
        attributionItems={attributionItems}
        styleOverridesByType={styleOverridesByType}
        highlightOverridesByType={highlightPaintByType}
        hoveredFeatures={hoveredFeatures}
        snackbar={{
          position: 'bottom',
          renderContent: (features) => {
            if (features.length === 0) return null;
            const labels = features.slice(0, 3).map((feature) => {
              const props = (feature.properties ?? {}) as Record<string, unknown>;
              const label =
                (props.name as string | undefined) ??
                (props.NAME as string | undefined) ??
                (props.label as string | undefined) ??
                (props.id as string | number | undefined);
              return label ? String(label) : 'Feature';
            });
            return labels.join(' / ');
          },
        }}
        onLoad={handleMapLoad}
        onViewStateChange={handleViewStateChange}
        identifyFeatureOnClick={{ layerIds: highlightLayerIds, radius: 6, disableDefaultSnackbar: true }}
        controls={{ navigation: { position: 'top-right' } }}
        mapOptions={{
          interactive: true,
          scrollZoom: true,
          dragPan: true,
          dragRotate: true,
          doubleClickZoom: true,
          touchZoomRotate: true,
        }}
      />
    </Box>
  );
}
