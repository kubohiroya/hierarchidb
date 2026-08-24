import type { NodeId } from '@hierarchidb/core-types';
import { resolveLocationAttribution } from '@hierarchidb/location-plugin/common';
import type { LocationType } from '@hierarchidb/location-store';
import type { RouteDataSourceConfig } from '@hierarchidb/route-plugin/common';
import { ROUTE_DATA_SOURCES } from '@hierarchidb/route-plugin/common';
import type { DataSourceConfig as ShapeDataSourceConfig } from '@hierarchidb/shape-plugin/common';
import { SHAPE_DATA_SOURCES } from '@hierarchidb/shape-plugin/common';
import type {
  LayerSetId,
  LayerSetVisibility,
  MapAttributionItem,
  MapFeatureIdentifyResult,
  MapLibreGeoJSONFeature,
  MapToggleSelection,
  MapViewState,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  buildCategoryFilter,
  DEFAULT_LAYER_SETS,
  DEFAULT_MAP_CONFIG,
  mergeFilters,
  ResourceLayerMap,
  ScreenCenterSnackbar,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import { ensureWorkerAPI } from '@hierarchidb/ui-worker-client';
import {
  loadTreeConsoleSettings,
  TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
  TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
} from '@hierarchidb/util';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useLoaderData, useParams, useSearch } from '@tanstack/react-router';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import useGeolocationImport from 'react-hook-geolocation';
import { canonicalBuildFeatureFlags } from '~/config/canonicalBuildFeatureFlags.js';
import type { MapViewState as LoaderMapViewState } from '~/router/loaders/mapLoader';
import { ModelessDialogManager } from '~/router/routes/modeless/ModelessDialogManager';
import type { MapLayerInfo } from '~/state/mapSearch.atoms';
import { mapLayerInfoAtom, mapStylerToggleAtom } from '~/state/mapSearch.atoms';
import {
  BUILT_IN_STYLE_URLS,
  LOCATION_TYPE_COLORS,
  LOCATION_TYPE_OPTIONS,
  ROUTE_MODE_OPTIONS,
  SEARCH_TARGET_DEFINITIONS,
  SEARCH_TARGET_GROUPS,
} from './constants.js';
import type { MapSearch } from './types.js';
import { useFolderLayers } from './useFolderLayers.js';
import { useLocationVectorLayers } from './useLocationVectorLayers.js';
import { useLocationViewportLayers } from './useLocationViewportLayers.js';
import { useMapImageCaptureIntent } from './useMapImageCaptureIntent.js';
import { useMapViewState } from './useMapViewState.js';
import '@watergis/maplibre-gl-export/dist/maplibre-gl-export.css';

const LOCATION_INTERACTION_RADIUS_PX = 8;
const CIRCLE_RADIUS_MIN = 2;
const LOCATION_MAX_ZOOM = 11;
const CIRCLE_RADIUS_SLOPE = 0.6;
const CIRCLE_RADIUS_AT_MAX = CIRCLE_RADIUS_MIN + LOCATION_MAX_ZOOM * CIRCLE_RADIUS_SLOPE;
const ICON_SIZE_MIN = 0.7;
const ICON_SIZE_SLOPE = 0.05;
const ICON_SIZE_AT_MAX = ICON_SIZE_MIN + LOCATION_MAX_ZOOM * ICON_SIZE_SLOPE;
const FIT_BOUNDS_PADDING_PX = 64;

type MapDebugFlags = {
  skipModelessDialogs: boolean;
  skipResourceLayerMap: boolean;
  skipVectorTileLayers: boolean;
  locationMvtEnabled: boolean;
};

const parseDebugFlag = (value: string | null): boolean => {
  if (value === null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
};

const getMapDebugFlags = (): MapDebugFlags => {
  if (typeof window === 'undefined') {
    return {
      skipModelessDialogs: false,
      skipResourceLayerMap: false,
      skipVectorTileLayers: false,
      locationMvtEnabled: false,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const resolveFlag = (name: string): boolean => {
    const queryValue = params.get(name);
    if (queryValue !== null) {
      return parseDebugFlag(queryValue);
    }
    const storageValue = window.localStorage.getItem(name);
    return parseDebugFlag(storageValue);
  };

  return {
    skipModelessDialogs: resolveFlag('hdbNoModelessDialogs'),
    skipResourceLayerMap: resolveFlag('hdbNoResourceLayerMap'),
    skipVectorTileLayers: resolveFlag('hdbNoVectorTileLayers'),
    locationMvtEnabled: resolveFlag('hdbLocationMvt'),
  };
};

const resolveCommonZoomBounds = () => {
  const settings = loadTreeConsoleSettings();
  const boundaries = Array.isArray(settings.zoomBandBoundaries)
    ? settings.zoomBandBoundaries.filter(
        (value) => typeof value === 'number' && Number.isFinite(value)
      )
    : [];
  if (boundaries.length === 0) {
    return {
      minZoom: TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
      maxZoom: TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
    };
  }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const minZoom = sorted[0] ?? TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM;
  const maxZoom = sorted[sorted.length - 1] ?? TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM;
  return {
    minZoom,
    maxZoom: Math.max(minZoom, maxZoom),
  };
};

export default function MapPage() {
  const useGeolocation =
    (useGeolocationImport as { default?: typeof useGeolocationImport }).default ??
    useGeolocationImport;
  const theme = useTheme();
  const { nodeId } = useParams({ from: '/map/$nodeId' });
  const debugFlags = useMemo(() => getMapDebugFlags(), []);
  const locationMvtEnabled = canonicalBuildFeatureFlags.locationMvt;
  const search = useSearch({ from: '/map/$nodeId' }) as MapSearch;
  const loaderViewState = useLoaderData({ from: '/map/$nodeId' }) as LoaderMapViewState;
  const captureIntentState = useMapImageCaptureIntent({
    nodeId,
    captureIntentId: search?.captureIntentId,
  });
  const geolocation = useGeolocation();
  const [missingLayerDialogOpen, setMissingLayerDialogOpen] = useState(false);
  const [missingLayerIds, setMissingLayerIds] = useState<string[]>([]);
  const [stylerToggles, setStylerToggles] = useAtom(mapStylerToggleAtom);
  const [locationTypeSelection, setLocationTypeSelection] = useState<MapToggleSelection>(
    () =>
      Object.fromEntries(
        LOCATION_TYPE_OPTIONS.map((option) => [option.id, true])
      ) as MapToggleSelection
  );
  const [routeModeSelection, setRouteModeSelection] = useState<MapToggleSelection>(
    () =>
      Object.fromEntries(
        ROUTE_MODE_OPTIONS.map((option) => [option.id, true])
      ) as MapToggleSelection
  );

  const [layerSetVisibility, setLayerSetVisibility] = useState<LayerSetVisibility>({
    location: true,
    route: true,
    shape: true,
  });
  const lastZoomRef = useRef<number | null>(null);
  const [zoomSnackbarMessage, setZoomSnackbarMessage] = useState('');
  const [zoomSnackbarOpen, setZoomSnackbarOpen] = useState(false);

  const { initialViewState, formattedZxy, handleViewStateChange, applyPersistedZxy } =
    useMapViewState({
      nodeId,
      searchZxy: search?.zxy,
      loaderViewState,
      geolocation,
    });

  const commonZoomBounds = useMemo(() => resolveCommonZoomBounds(), []);

  const {
    basemapStyles,
    vectorLayers,
    geoJsonLayers,
    locationLayers,
    styleOverridesByType,
    mapInfo,
    stylerSummaries,
  } = useFolderLayers({
    nodeId,
    searchZxy: search?.zxy,
    onPersistedZxy: applyPersistedZxy,
    stylerToggles,
  });

  const setMapLayerInfo = useSetAtom(mapLayerInfoAtom);
  const {
    list: layerInfoList,
    byId: layerInfoById,
    bySource: layerInfoBySource,
  } = useMemo(() => {
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
    locationLayers.forEach((layer) => {
      const base = {
        nodeId: layer.nodeId,
        nodeType: layer.nodeType,
        sourceId: layer.sourceId,
      };
      const circleLayerId = `${layer.layerId}-circle`;
      const iconLayerId = `${layer.layerId}-icon`;
      const circleInfo = { ...base, layerId: circleLayerId };
      const iconInfo = { ...base, layerId: iconLayerId };
      list.push(circleInfo, iconInfo);
      byId.set(circleLayerId, circleInfo);
      byId.set(iconLayerId, iconInfo);
      bySource.set(layer.sourceId, iconInfo);
    });
    return { list, byId, bySource };
  }, [locationLayers, vectorLayers]);

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

  const buildHighlightEntry = useCallback(
    (feature?: MapLibreGeoJSONFeature | null) => {
      if (!feature) return null;
      const candidate = feature.id ?? feature.properties?.id ?? feature.properties?.__hdbOriginKey;
      const id =
        typeof candidate === 'string' || typeof candidate === 'number' ? candidate : undefined;
      const source = typeof feature.source === 'string' ? feature.source : undefined;
      if (id === undefined || id === null || !source) return null;
      const layerId = typeof feature.layer?.id === 'string' ? feature.layer.id : undefined;
      const meta = layerId ? layerInfoById.get(layerId) : undefined;
      const resolved =
        meta ??
        (typeof feature.source === 'string' ? layerInfoBySource.get(feature.source) : undefined);
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

  const handleIdentifyLocationPoint = useCallback(
    (result: MapFeatureIdentifyResult) => {
      if (!locationMvtEnabled || result.features.length === 0) return;
      const locationFeature = result.features.find((feature) => {
        const layerId = typeof feature.layer?.id === 'string' ? feature.layer.id : undefined;
        const sourceId = typeof feature.source === 'string' ? feature.source : undefined;
        const info =
          (layerId ? layerInfoById.get(layerId) : undefined) ??
          (sourceId ? layerInfoBySource.get(sourceId) : undefined);
        return info?.nodeType === 'location';
      });
      if (!locationFeature) return;
      const layerId =
        typeof locationFeature.layer?.id === 'string' ? locationFeature.layer.id : undefined;
      const sourceId = typeof locationFeature.source === 'string' ? locationFeature.source : '';
      const info =
        (layerId ? layerInfoById.get(layerId) : undefined) ?? layerInfoBySource.get(sourceId);
      if (!info?.nodeId) {
        throw new Error('Location MVT identify result is missing nodeId');
      }
      const pointIdCandidate = locationFeature.id ?? locationFeature.properties?.pointId;
      if (typeof pointIdCandidate !== 'string' && typeof pointIdCandidate !== 'number') {
        throw new Error('Location MVT identify result is missing pointId');
      }
      void ensureWorkerAPI()
        .then((api) => api.getLocationQueryAPI())
        .then((api) => api.getPoint(info.nodeId as NodeId, String(pointIdCandidate)))
        .then((point) => {
          if (!point) {
            throw new Error(`Location point metadata not found: ${String(pointIdCandidate)}`);
          }
          console.debug('[MapPage] Resolved location point metadata from SSOT', {
            nodeId: info.nodeId,
            pointId: pointIdCandidate,
            featureId: point.id,
          });
        })
        .catch((error) => {
          console.warn('[MapPage] Failed to resolve location point metadata from SSOT', error);
        });
    },
    [layerInfoById, layerInfoBySource, locationMvtEnabled]
  );

  const routeModeOptions = useMemo(
    () => ROUTE_MODE_OPTIONS.map(({ id, label, icon }) => ({ id, label, icon })),
    []
  );

  const mapStyleUrl = useMemo(() => {
    if (basemapStyles.length) return undefined;
    return BUILT_IN_STYLE_URLS.terrain ?? DEFAULT_MAP_CONFIG.mapStyleUrl;
  }, [basemapStyles.length]);

  const locationKinds = useMemo(() => LOCATION_TYPE_OPTIONS.map((option) => option.id), []);
  const enabledLocationKinds = useMemo(
    () =>
      LOCATION_TYPE_OPTIONS.filter((option) => locationTypeSelection[option.id]).map(
        (option) => option.id
      ),
    [locationTypeSelection]
  );
  const locationVectorLayers = useLocationVectorLayers({
    enabled: debugFlags.locationMvtEnabled,
    locationLayers,
    layerSetVisibility,
    enabledLocationKinds,
    maxZoom: Math.min(commonZoomBounds.maxZoom, 22),
  });
  const folderVectorLayers = useMemo(
    () => [...vectorLayers, ...locationVectorLayers],
    [locationVectorLayers, vectorLayers]
  );
  const locationTypeFilter = useMemo(
    () => buildCategoryFilter(enabledLocationKinds, locationKinds, ['type']),
    [enabledLocationKinds, locationKinds]
  );
  const routeModeValues = useMemo(
    () => Array.from(new Set(ROUTE_MODE_OPTIONS.flatMap((option) => option.modes))),
    []
  );
  const enabledRouteModes = useMemo(
    () =>
      ROUTE_MODE_OPTIONS.filter((option) => routeModeSelection[option.id]).flatMap(
        (option) => option.modes
      ),
    [routeModeSelection]
  );
  const filteredVectorLayers = useMemo(() => {
    const routeFilter = buildCategoryFilter(enabledRouteModes, routeModeValues, [
      'routeMode',
      'mode',
      'route_mode',
    ]);
    const activeVectorLayers = folderVectorLayers.filter((layer) => {
      if (!layer.layerSetId) return true;
      return layerSetVisibility[layer.layerSetId] ?? false;
    });
    return activeVectorLayers.map((layer) => {
      if (layer.nodeType === 'location') {
        const baseConfig = layer.layerConfig ?? {};
        const nextVisible = enabledLocationKinds.length === 0 ? false : baseConfig.visible;
        return {
          ...layer,
          layerConfig: {
            ...baseConfig,
            visible: nextVisible,
            filter: mergeFilters(baseConfig.filter, locationTypeFilter),
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
  }, [
    enabledLocationKinds,
    enabledRouteModes,
    locationTypeFilter,
    routeModeValues,
    folderVectorLayers,
    layerSetVisibility,
  ]);

  const attributionItems = useMemo<MapAttributionItem[]>(() => {
    const items: MapAttributionItem[] = [];
    const resolveShape = (dataSourceName?: string | null) => {
      if (!dataSourceName) return null;
      const normalized = dataSourceName.toLowerCase();
      const config = SHAPE_DATA_SOURCES.find(
        (source: ShapeDataSourceConfig) => source.name.toLowerCase() === normalized
      );
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
      const config = ROUTE_DATA_SOURCES.find(
        (source: RouteDataSourceConfig) => source.name.toLowerCase() === normalized
      );
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

    locationLayers.forEach((layer) => {
      if (!layer.dataSourceName) return;
      const info = resolveLocationAttribution(layer.dataSourceName);
      if (!info) return;
      items.push({
        id: `location:${info.id}:${layer.nodeId}`,
        label: info.label,
        attribution: info.attribution,
        url: info.url,
        license: info.license,
        licenseUrl: info.licenseUrl,
      });
    });

    return items;
  }, [filteredVectorLayers, locationLayers]);

  const highlightColors = useMemo(
    () => ({
      searchColor: '#ffd54f',
      hoverColor: '#ffecb3',
      selectedColor: theme.palette.primary.main,
    }),
    [theme.palette.primary.main]
  );

  const highlightPaintByType = useMemo(() => {
    const { searchColor, hoverColor, selectedColor } = highlightColors;
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
        'fill-outline-color': colorExpression(
          styleOverridesByType.fill?.['fill-outline-color'] ?? baseFillColor
        ),
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
        'line-width': ['case', hasSelected, 3.5, hasHover, 2.8, hasSearch, 2.4, baseLineWidth],
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
        'circle-radius': ['case', hasSelected, 7, hasHover, 6, hasSearch, 5, baseCircleRadius],
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
        'circle-stroke-color': colorExpression(
          styleOverridesByType.circle?.['circle-stroke-color'] ?? baseCircleColor
        ),
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
  }, [highlightColors, styleOverridesByType]);

  const locationBaseColorExpression = useMemo(() => {
    const expression: Array<string | unknown> = ['match', ['get', 'type']];
    Object.entries(LOCATION_TYPE_COLORS).forEach(([type, color]) => {
      expression.push(type, color);
    });
    expression.push(LOCATION_TYPE_COLORS.area_centroid);
    return expression;
  }, []);

  const locationCirclePaint = useMemo<Record<string, unknown>>(() => {
    const { searchColor, hoverColor, selectedColor } = highlightColors;
    const hasSearch = ['boolean', ['feature-state', 'hdbSearch'], false];
    const hasHover = ['boolean', ['feature-state', 'hdbHover'], false];
    const hasSelected = ['boolean', ['feature-state', 'hdbSelected'], false];
    const radiusByState = (baseRadius: number) => [
      'case',
      hasSelected,
      7,
      hasHover,
      6,
      hasSearch,
      5,
      baseRadius,
    ];
    const colorExpression = [
      'case',
      hasSelected,
      selectedColor,
      hasHover,
      hoverColor,
      hasSearch,
      searchColor,
      locationBaseColorExpression,
    ];
    return {
      'circle-color': colorExpression,
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0,
        radiusByState(CIRCLE_RADIUS_MIN),
        LOCATION_MAX_ZOOM,
        radiusByState(CIRCLE_RADIUS_AT_MAX),
      ],
      'circle-opacity': ['case', hasSelected, 0.95, hasHover, 0.9, hasSearch, 0.85, 0.8],
      'circle-blur': ['case', hasHover, 0.8, hasSearch, 0.6, hasSelected, 0.4, 0],
      'circle-stroke-color': colorExpression,
      'circle-stroke-width': ['case', hasSelected, 2, hasHover, 1.5, hasSearch, 1, 0],
    };
  }, [highlightColors, locationBaseColorExpression]);

  const locationIconImageExpression = useMemo(() => {
    const expression: Array<string | unknown> = ['match', ['get', 'type']];
    (Object.keys(LOCATION_TYPE_COLORS) as LocationType[]).forEach((type) => {
      expression.push(type, `location-icon-${type}`);
    });
    expression.push(`location-icon-area_centroid`);
    return expression;
  }, []);

  const locationIconSizeExpression = useMemo(
    () => [
      'interpolate',
      ['linear'],
      ['zoom'],
      0,
      ICON_SIZE_MIN,
      LOCATION_MAX_ZOOM,
      ICON_SIZE_AT_MAX,
    ],
    []
  );

  const { locationGeoJsonLayers, handleMapLoad, handleLocationMoveEnd } = useLocationViewportLayers(
    {
      nodeId,
      locationLayers,
      layerSetVisibility,
      enabledLocationKinds,
      locationTypeFilter,
      locationCirclePaint,
      locationIconImageExpression,
      locationIconSizeExpression,
      disabled: debugFlags.locationMvtEnabled,
    }
  );

  const combinedGeoJsonLayers = useMemo(
    () => [
      ...geoJsonLayers,
      ...(debugFlags.locationMvtEnabled
        ? []
        : layerSetVisibility.location
          ? locationGeoJsonLayers
          : []),
    ],
    [
      debugFlags.locationMvtEnabled,
      geoJsonLayers,
      layerSetVisibility.location,
      locationGeoJsonLayers,
    ]
  );

  const highlightLayerIds = useMemo(
    () => [
      ...filteredVectorLayers.map(
        (layer) => layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`
      ),
      ...combinedGeoJsonLayers.map((layer) => layer.layerId),
    ],
    [combinedGeoJsonLayers, filteredVectorLayers]
  );

  const handleLocationTypeToggle = useCallback((id: string) => {
    setLocationTypeSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleRouteModeToggle = useCallback((id: string) => {
    setRouteModeSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleLayerSetToggle = useCallback((id: LayerSetId) => {
    setLayerSetVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const handleZoomSnackbarClose = useCallback(() => {
    setZoomSnackbarOpen(false);
  }, []);

  const handleMapViewStateChange = useCallback(
    (viewState: MapViewState) => {
      handleViewStateChange(viewState);
      const zoom = Number(viewState.zoom);
      if (!Number.isFinite(zoom)) return;
      const lastZoom = lastZoomRef.current;
      if (lastZoom !== null && Math.abs(lastZoom - zoom) < 0.01) return;
      lastZoomRef.current = zoom;
      setZoomSnackbarMessage(`Zoom: ${zoom.toFixed(2)}`);
      setZoomSnackbarOpen(true);
    },
    [handleViewStateChange]
  );
  const effectiveVectorLayers = useMemo(
    () => (debugFlags.skipVectorTileLayers ? [] : filteredVectorLayers),
    [debugFlags.skipVectorTileLayers, filteredVectorLayers]
  );

  return (
    <Box
      data-map-image-capture-intent-id={search?.captureIntentId}
      data-map-image-capture-intent-status={captureIntentState.status}
      sx={{ width: '100vw', height: '100vh', position: 'relative', overscrollBehavior: 'contain' }}
    >
      {!debugFlags.skipModelessDialogs && nodeId ? (
        <ModelessDialogManager
          nodeId={nodeId}
          formattedZxy={formattedZxy}
          basemapStyles={basemapStyles}
          vectorLayers={effectiveVectorLayers}
          geoJsonLayers={combinedGeoJsonLayers}
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
          layerSets={DEFAULT_LAYER_SETS}
          layerSetVisibility={layerSetVisibility}
          onToggleLayerSet={handleLayerSetToggle}
        />
      ) : null}

      <Dialog
        open={missingLayerDialogOpen}
        onClose={() => setMissingLayerDialogOpen(false)}
        aria-labelledby="map-missing-layer-title"
      >
        <DialogTitle id={useId()}>まだビルドされていないノードがあります</DialogTitle>
        <DialogContent>
          <DialogContentText>
            対象ノードのビルドが完了していないため、プレビューに表示できません。ビルド完了後に再度お試しください。
          </DialogContentText>
          {missingLayerIds.length > 0 ? (
            <DialogContentText sx={{ mt: 2 }}>
              対象レイヤ: {missingLayerIds.join(', ')}
            </DialogContentText>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMissingLayerDialogOpen(false)}>OK</Button>
        </DialogActions>
      </Dialog>

      {debugFlags.skipResourceLayerMap ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}
        >
          Map rendering temporarily disabled by debug flag (hdbNoResourceLayerMap=1).
        </Box>
      ) : (
        <ResourceLayerMap
          initialViewState={initialViewState}
          width="100%"
          height="100%"
          mapStyleUrl={mapStyleUrl}
          basemapStyles={basemapStyles}
          vectorLayers={effectiveVectorLayers}
          geoJsonLayers={combinedGeoJsonLayers}
          attributionItems={attributionItems}
          styleOverridesByType={styleOverridesByType}
          highlightOverridesByType={highlightPaintByType}
          interaction={{
            enabled: true,
            highlightLayerIds,
            buildHighlightEntry,
            onMissingLayers: (layerIds) => {
              setMissingLayerIds(layerIds);
              setMissingLayerDialogOpen(layerIds.length > 0);
            },
            search: {
              enabled: true,
              targetDefinitions: SEARCH_TARGET_DEFINITIONS,
              targetGroups: SEARCH_TARGET_GROUPS,
              fitOnSearch: true,
              fitPadding: FIT_BOUNDS_PADDING_PX,
            },
            hover: { enabled: true, radius: LOCATION_INTERACTION_RADIUS_PX },
            selection: { enabled: true, radius: LOCATION_INTERACTION_RADIUS_PX },
            fitSelection: { enabled: true, padding: FIT_BOUNDS_PADDING_PX },
            snackbar: {
              position: 'bottom-center',
            },
          }}
          onLoad={handleMapLoad}
          onViewStateChange={handleMapViewStateChange}
          onMoveEnd={handleLocationMoveEnd}
          identifyFeatureOnClick={{
            layerIds: highlightLayerIds,
            radius: LOCATION_INTERACTION_RADIUS_PX,
            disableDefaultSnackbar: true,
            onIdentify: handleIdentifyLocationPoint,
          }}
          controls={{ navigation: { position: 'top-right' } }}
          mapOptions={{
            interactive: true,
            scrollZoom: true,
            dragPan: true,
            dragRotate: true,
            doubleClickZoom: true,
            touchZoomRotate: true,
            minZoom: commonZoomBounds.minZoom,
            maxZoom: commonZoomBounds.maxZoom,
          }}
        />
      )}
      <ScreenCenterSnackbar
        open={zoomSnackbarOpen}
        message={zoomSnackbarMessage}
        onClose={handleZoomSnackbarClose}
        containerSx={{ zIndex: 4 }}
      />
    </Box>
  );
}
