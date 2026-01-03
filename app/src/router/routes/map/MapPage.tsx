import type {
  MapLibreMapInstance,
  MapToggleSelection,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  buildCategoryFilter,
  DEFAULT_MAP_CONFIG,
  ResourceLayerMap,
  mergeFilters,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useLoaderData, useParams, useSearch } from '@tanstack/react-router';
import { useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useGeolocationImport from 'react-hook-geolocation';
import { MaplibreExportControl } from '@watergis/maplibre-gl-export';
import { mapLayerInfoAtom } from '../../../state/mapSearch.atoms.js';
import type { MapLayerInfo } from '../../../state/mapSearch.atoms.js';
import { ModelessDialogManager } from '../modeless/ModelessDialogManager.js';
import { LOCATION_TYPE_OPTIONS, ROUTE_MODE_OPTIONS } from './constants.js';
import { SearchPanel } from './SearchPanel.js';
import { SearchSettingsDialog } from './SearchSettingsDialog.js';
import { useFolderLayers } from './useFolderLayers.js';
import { useMapHighlights } from './useMapHighlights.js';
import { useMapSearch } from './useMapSearch.js';
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

  const { basemapStyles, vectorLayers, geoJsonLayers, styleOverridesByType, mapInfo } = useFolderLayers({
    nodeId,
    searchZxy: search?.zxy,
    onPersistedZxy: applyPersistedZxy,
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

  const highlightLayerIds = useMemo(
    () => vectorLayers.map((layer) => layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`),
    [vectorLayers],
  );

  const { buildHighlightEntry, handleIdentify } = useMapHighlights({
    mapInstance,
    highlightLayerIds,
    layerInfoById,
    layerInfoBySource,
  });

  const {
    searchText,
    searchTargets,
    setSearchText,
    runSearch,
    handleSearchClear,
    handleSearchTargetToggle,
  } = useMapSearch({
    mapInstance,
    highlightLayerIds,
    buildHighlightEntry,
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
          locationTypeOptions={LOCATION_TYPE_OPTIONS}
          routeModeOptions={routeModeOptions}
          locationTypeSelection={locationTypeSelection}
          routeModeSelection={routeModeSelection}
          onToggleLocationType={handleLocationTypeToggle}
          onToggleRouteMode={handleRouteModeToggle}
        />
      ) : null}

      <SearchPanel
        searchText={searchText}
        onSearchTextChange={setSearchText}
        onSearch={runSearch}
        onClear={handleSearchClear}
        onOpenSettings={() => setSearchSettingsOpen(true)}
      />

      <SearchSettingsDialog
        open={searchSettingsOpen}
        searchTargets={searchTargets}
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
        styleOverridesByType={styleOverridesByType}
        highlightOverridesByType={highlightPaintByType}
        onLoad={handleMapLoad}
        onViewStateChange={handleViewStateChange}
        identifyFeatureOnClick={{
          layerIds: highlightLayerIds,
          radius: 6,
          onIdentify: handleIdentify,
          disableDefaultSnackbar: true,
        }}
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
