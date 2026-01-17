import type {
  MapAttributionItem,
  MapLibreGeoJSONFeature,
  MapLibreMapInstance,
  MapViewState,
  MapToggleSelection,
  ResourceGeoJsonLayer,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  buildCategoryFilter,
  DEFAULT_MAP_CONFIG,
  ResourceLayerMap,
  mergeFilters,
} from '@hierarchidb/ui-plugin-shell/ui-map';
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
import { MaplibreExportControl } from '@watergis/maplibre-gl-export';
import type { NodeId } from '@hierarchidb/common-types';
import { SHAPE_DATA_SOURCES } from '@hierarchidb/shape-plugin';
import { resolveLocationAttribution } from '@hierarchidb/location-plugin';
import { ROUTE_DATA_SOURCES } from '@hierarchidb/route-plugin';
import type { LocationQueryAPI } from '@hierarchidb/plugin-service-api';
import { ensureWorkerAPI } from '@hierarchidb/ui-worker-client';
import type { Feature } from 'geojson';
import type { LocationType } from '@hierarchidb/location-store';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  DirectionsBoat as DirectionsBoatIcon,
  FlightTakeoff as FlightTakeoffIcon,
  ForkRight as ForkRightIcon,
  LocationCity as LocationCityIcon,
  Train as TrainIcon,
} from '@mui/icons-material';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  mapLayerInfoAtom,
  mapStylerToggleAtom,
} from '../../../state/mapSearch.atoms.js';
import type { MapLayerInfo } from '../../../state/mapSearch.atoms.js';
import { ModelessDialogManager } from '../modeless/ModelessDialogManager.js';
import {
  BUILT_IN_STYLE_URLS,
  LOCATION_TYPE_COLORS,
  LOCATION_TYPE_OPTIONS,
  ROUTE_MODE_OPTIONS,
  SEARCH_TARGET_DEFINITIONS,
  SEARCH_TARGET_GROUPS,
} from './constants.js';
import { useFolderLayers } from './useFolderLayers.js';
import { useMapViewState } from './useMapViewState.js';
import type { MapSearch } from './types.js';
import type { MapViewState as LoaderMapViewState } from '../../loaders/mapLoader.js';
import '@watergis/maplibre-gl-export/dist/maplibre-gl-export.css';

const PREFETCH_MARGIN_PX = 64;
const LOCATION_INTERACTION_RADIUS_PX = 8;
const CIRCLE_RADIUS_MIN = 2;
const LOCATION_MAX_ZOOM = 11;
const CIRCLE_RADIUS_SLOPE = 0.6;
const CIRCLE_RADIUS_AT_MAX = CIRCLE_RADIUS_MIN + LOCATION_MAX_ZOOM * CIRCLE_RADIUS_SLOPE;
const ICON_SIZE_MIN = 0.7;
const ICON_SIZE_SLOPE = 0.05;
const ICON_SIZE_AT_MAX = ICON_SIZE_MIN + LOCATION_MAX_ZOOM * ICON_SIZE_SLOPE;
const FIT_BOUNDS_PADDING_PX = 64;

const LOCATION_ICON_COMPONENTS: Record<LocationType, SvgIconComponent> = {
  area_centroid: LocationCityIcon,
  airport: FlightTakeoffIcon,
  port: DirectionsBoatIcon,
  railway_station: TrainIcon,
  interchange: ForkRightIcon,
};

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
  const [missingLayerDialogOpen, setMissingLayerDialogOpen] = useState(false);
  const [missingLayerIds, setMissingLayerIds] = useState<string[]>([]);
  const [stylerToggles, setStylerToggles] = useAtom(mapStylerToggleAtom);
  const [locationTypeSelection, setLocationTypeSelection] = useState<MapToggleSelection>(() =>
    Object.fromEntries(LOCATION_TYPE_OPTIONS.map((option) => [option.id, true])) as MapToggleSelection
  );
  const [routeModeSelection, setRouteModeSelection] = useState<MapToggleSelection>(() =>
    Object.fromEntries(ROUTE_MODE_OPTIONS.map((option) => [option.id, true])) as MapToggleSelection
  );
  const mapInstanceRef = useRef<MapLibreMapInstance | null>(null);
  const exportControlRef = useRef<MaplibreExportControl | null>(null);
  const locationQueryPromiseRef = useRef<Promise<LocationQueryAPI> | null>(null);
  const locationQueryTimerRef = useRef<number | null>(null);
  const locationQueryRequestRef = useRef(0);
  const [locationGeoJsonLayers, setLocationGeoJsonLayers] = useState<ResourceGeoJsonLayer[]>([]);
  const [locationIconsReady, setLocationIconsReady] = useState(false);

  const { initialViewState, formattedZxy, handleViewStateChange, applyPersistedZxy } = useMapViewState({
    nodeId,
    searchZxy: search?.zxy,
    loaderViewState,
    geolocation,
  });

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

  const getLocationQueryAPI = useCallback(async (): Promise<LocationQueryAPI> => {
    if(locationQueryPromiseRef.current){
      return locationQueryPromiseRef.current;
    }
    locationQueryPromiseRef.current = ensureWorkerAPI().then((api) => api.getLocationQueryAPI());
    return locationQueryPromiseRef.current;
  }, []);

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

  const highlightLayerIds = useMemo(
    () => [
      ...vectorLayers.map((layer) => layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`),
      ...locationGeoJsonLayers.map((layer) => layer.layerId),
    ],
    [locationGeoJsonLayers, vectorLayers],
  );


  const buildHighlightEntry = useCallback(
    (feature?: MapLibreGeoJSONFeature | null) => {
      if (!feature) return null;
      const candidate = feature.id ?? feature.properties?.id ?? feature.properties?.__hdbOriginKey;
      const id = typeof candidate === 'string' || typeof candidate === 'number' ? candidate : undefined;
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

  const routeModeOptions = useMemo(
    () => ROUTE_MODE_OPTIONS.map(({ id, label, icon }) => ({ id, label, icon })),
    [],
  );

  const mapStyleUrl = useMemo(() => {
    if (basemapStyles.length) return undefined;
    return BUILT_IN_STYLE_URLS.terrain ?? DEFAULT_MAP_CONFIG.mapStyleUrl;
  }, [basemapStyles.length]);

  const locationKinds = useMemo(
    () => LOCATION_TYPE_OPTIONS.map((option) => option.id),
    []
  );
  const enabledLocationKinds = useMemo(
    () => LOCATION_TYPE_OPTIONS.filter((option) => locationTypeSelection[option.id]).map((option) => option.id),
    [locationTypeSelection],
  );
  const locationTypeFilter = useMemo(
    () => buildCategoryFilter(enabledLocationKinds, locationKinds, ['kind', 'type']),
    [enabledLocationKinds, locationKinds],
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
  }, [enabledLocationKinds, enabledRouteModes, locationTypeFilter, routeModeValues, vectorLayers]);

  const combinedGeoJsonLayers = useMemo(
    () => [...geoJsonLayers, ...locationGeoJsonLayers],
    [geoJsonLayers, locationGeoJsonLayers],
  );

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

  const highlightColors = useMemo(() => ({
    searchColor: '#ffd54f',
    hoverColor: '#ffecb3',
    selectedColor: theme.palette.primary.main,
  }), [theme.palette.primary.main]);

  const highlightPaintByType = useMemo(() => {
    const { searchColor, hoverColor, selectedColor } = highlightColors;
    const baseFillColor = styleOverridesByType.fill?.['fill-color'] ?? '#6aa6ff';
    const baseLineColor = styleOverridesByType.line?.['line-color'] ?? '#f24c3d';
    const baseCircleColor = styleOverridesByType.circle?.['circle-color'] ?? '#2f74ff';
    const baseLineWidth = styleOverridesByType.line?.['line-width'] ?? 2;
    const baseCircleRadius = styleOverridesByType.circle?.['circle-radius'] ?? 4;

    const hasSearch = ['boolean', ['feature-atoms', 'hdbSearch'], false];
    const hasHover = ['boolean', ['feature-atoms', 'hdbHover'], false];
    const hasSelected = ['boolean', ['feature-atoms', 'hdbSelected'], false];

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
  }, [highlightColors, styleOverridesByType]);

  const locationBaseColorExpression = useMemo(() => {
    const expression: Array<string | unknown> = ['match', ['get', 'kind']];
    Object.entries(LOCATION_TYPE_COLORS).forEach(([kind, color]) => {
      expression.push(kind, color);
    });
    expression.push(LOCATION_TYPE_COLORS.area_centroid);
    return expression;
  }, []);

  const locationCircleRadiusExpression = useMemo(
    () => (['interpolate', ['linear'], ['zoom'], 0, CIRCLE_RADIUS_MIN, LOCATION_MAX_ZOOM, CIRCLE_RADIUS_AT_MAX] as unknown),
    [],
  );

  const locationCirclePaint = useMemo<Record<string, unknown>>(() => {
    const { searchColor, hoverColor, selectedColor } = highlightColors;
    const hasSearch = ['boolean', ['feature-atoms', 'hdbSearch'], false];
    const hasHover = ['boolean', ['feature-atoms', 'hdbHover'], false];
    const hasSelected = ['boolean', ['feature-atoms', 'hdbSelected'], false];
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
        'case',
        hasSelected,
        7,
        hasHover,
        6,
        hasSearch,
        5,
        locationCircleRadiusExpression,
      ],
      'circle-opacity': [
        'case',
        hasSelected,
        0.95,
        hasHover,
        0.9,
        hasSearch,
        0.85,
        0.8,
      ],
      'circle-blur': [
        'case',
        hasHover,
        0.8,
        hasSearch,
        0.6,
        hasSelected,
        0.4,
        0,
      ],
      'circle-stroke-color': colorExpression,
      'circle-stroke-width': [
        'case',
        hasSelected,
        2,
        hasHover,
        1.5,
        hasSearch,
        1,
        0,
      ],
    };
  }, [highlightColors, locationBaseColorExpression, locationCircleRadiusExpression]);

  const locationIconImageExpression = useMemo(() => {
    const expression: Array<string | unknown> = ['match', ['get', 'kind']];
    (Object.keys(LOCATION_TYPE_COLORS) as LocationType[]).forEach((kind) => {
      expression.push(kind, `location-icon-${kind}`);
    });
    expression.push(`location-icon-area_centroid`);
    return expression;
  }, []);

  const locationIconSizeExpression = useMemo(
    () => (['interpolate', ['linear'], ['zoom'], 0, ICON_SIZE_MIN, LOCATION_MAX_ZOOM, ICON_SIZE_AT_MAX] as unknown),
    [],
  );

  const ensureLocationIcons = useCallback((map: MapLibreMapInstance) => {
    const mapWithImages = map as MapLibreMapInstance & {
      hasImage?: (id: string) => boolean;
      addImage?: (id: string, image: HTMLImageElement, options?: { sdf?: boolean }) => void;
    };
    if (!mapWithImages.addImage) return;
    const missing = (Object.entries(LOCATION_ICON_COMPONENTS) as Array<[LocationType, SvgIconComponent]>)
      .filter(([kind]) => !mapWithImages.hasImage?.(`location-icon-${kind}`));
    if (missing.length === 0) {
      setLocationIconsReady(true);
      return;
    }
    setLocationIconsReady(false);
    const loaders = missing.map(([kind, Icon]) => new Promise<void>((resolve) => {
      const iconId = `location-icon-${kind}`;
      const svg = renderToStaticMarkup(<Icon htmlColor={LOCATION_TYPE_COLORS[kind]} />);
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      const image = new Image();
      image.onload = () => {
        if (!mapWithImages.hasImage?.(iconId)) {
          mapWithImages.addImage?.(iconId, image);
        }
        resolve();
      };
      image.onerror = () => resolve();
      image.src = dataUrl;
    }));
    void Promise.all(loaders).then(() => setLocationIconsReady(true));
  }, []);

  const buildLocationLayersForNode = useCallback(
    (layer: typeof locationLayers[number], features: Array<Feature>): ResourceGeoJsonLayer[] => {
      const sourceId = layer.sourceId;
      const base = {
        data: {
          type: 'FeatureCollection' as const,
          features,
        },
        filter: locationTypeFilter ?? undefined,
        absolutePath: layer.absolutePath,
      };
      const layers: ResourceGeoJsonLayer[] = [
        {
          layerId: `${layer.layerId}-circle`,
          sourceId,
          layerType: 'circle',
          paint: locationCirclePaint,
          ...base,
        },
      ];
      if (locationIconsReady) {
        layers.push({
          layerId: `${layer.layerId}-icon`,
          sourceId,
          layerType: 'symbol',
          layout: {
            'icon-image': locationIconImageExpression,
            'icon-size': locationIconSizeExpression,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          ...base,
        });
      }
      return layers;
    },
    [
      locationCirclePaint,
      locationIconImageExpression,
      locationIconSizeExpression,
      locationIconsReady,
      locationTypeFilter,
    ],
  );

  const fetchLocationViewportPoints = useCallback(async (viewState?: MapViewState) => {
    if (!mapInstanceRef.current) return;
    if (locationLayers.length === 0) {
      setLocationGeoJsonLayers([]);
      return;
    }
    const map = mapInstanceRef.current;
    const bounds = map.getBounds?.();
    if (!bounds) return;
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];
    const canvas = map.getCanvas();
    const viewportSizePx = {
      width: canvas?.clientWidth ?? 0,
      height: canvas?.clientHeight ?? 0,
    };
    const requestId = ++locationQueryRequestRef.current;
    if (enabledLocationKinds.length === 0) {
      const emptyLayers = locationLayers.flatMap((layer) => buildLocationLayersForNode(layer, []));
      setLocationGeoJsonLayers(emptyLayers);
      return;
    }
    try {
      const api = await getLocationQueryAPI();
      const zoom = viewState?.zoom ?? map.getZoom();
      const layers = await Promise.all(
        locationLayers.map(async (layer) => {
          const items = await api.queryByViewport(
            layer.nodeId as NodeId,
            bbox,
            zoom,
            enabledLocationKinds,
            {
              prefetchMarginPx: PREFETCH_MARGIN_PX,
              viewportSizePx,
            },
          );
          const features: Array<Feature | null> = items.map((item) => {
            const data = item.data as {
              pointId?: string;
              name?: string;
              longitude?: number;
              latitude?: number;
              kind?: string;
              countryName?: string;
              countryCode?: string;
              admin1?: string;
              admin2?: string;
              admin1Code?: string;
              admin2Code?: string;
              metadata?: Record<string, string | number | null>;
            } | undefined;
            const longitude = data?.longitude;
            const latitude = data?.latitude;
            if (
              typeof longitude !== 'number'
              || !Number.isFinite(longitude)
              || typeof latitude !== 'number'
              || !Number.isFinite(latitude)
            ) {
              return null;
            }
            return {
              type: 'Feature' as const,
              id: String(item.id),
              geometry: {
                type: 'Point' as const,
                coordinates: [longitude, latitude],
              },
              properties: {
                id: String(item.id),
                pointId: data?.pointId ?? item.id,
                name: data?.name,
                kind: data?.kind ?? 'area_centroid',
                countryName: data?.countryName,
                countryCode: data?.countryCode,
                admin1: data?.admin1,
                admin2: data?.admin2,
                admin1Code: data?.admin1Code,
                admin2Code: data?.admin2Code,
                metadata: data?.metadata ?? {},
              },
            } satisfies Feature;
          });
          const filtered = features.filter((feature): feature is Feature => feature !== null);
          return buildLocationLayersForNode(layer, filtered);
        }),
      );
      if (requestId !== locationQueryRequestRef.current) return;
      setLocationGeoJsonLayers(layers.flat());
    } catch (error) {
      if (requestId === locationQueryRequestRef.current) {
        setLocationGeoJsonLayers(locationLayers.flatMap((layer) => buildLocationLayersForNode(layer, [])));
      }
      console.warn('[MapPage] Failed to query location viewport', error);
    }
  }, [
    buildLocationLayersForNode,
    enabledLocationKinds,
    getLocationQueryAPI,
    locationLayers,
  ]);

  const scheduleLocationQuery = useCallback((viewState?: MapViewState) => {
    if (locationQueryTimerRef.current) {
      window.clearTimeout(locationQueryTimerRef.current);
    }
    locationQueryTimerRef.current = window.setTimeout(() => {
      void fetchLocationViewportPoints(viewState);
    }, 150);
  }, [fetchLocationViewportPoints]);

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    console.log('[MapPage] Map loaded', map);
    mapInstanceRef.current = map;
    setMapInstance(map);
    ensureLocationIcons(map);
    scheduleLocationQuery();
    if (!exportControlRef.current) {
      const control = new MaplibreExportControl({
        Format: 'pdf',
        Local: 'ja',
        Filename: nodeId ? `map-${nodeId}` : 'map-export',
      });
      map.addControl(control, 'bottom-left');
      exportControlRef.current = control;
    }
  }, [ensureLocationIcons, nodeId, scheduleLocationQuery]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current && exportControlRef.current) {
        mapInstanceRef.current.removeControl(exportControlRef.current);
        exportControlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstance) return;
    const handleStyleData = () => {
      ensureLocationIcons(mapInstance);
    };
    mapInstance.on('styledata', handleStyleData);
    return () => {
      mapInstance.off('styledata', handleStyleData);
    };
  }, [ensureLocationIcons, mapInstance]);

  useEffect(() => {
    if (locationLayers.length > 0) {
      setLocationGeoJsonLayers(locationLayers.flatMap((layer) => buildLocationLayersForNode(layer, [])));
    } else {
      setLocationGeoJsonLayers([]);
    }
    scheduleLocationQuery();
    return () => {
      if (locationQueryTimerRef.current) {
        window.clearTimeout(locationQueryTimerRef.current);
        locationQueryTimerRef.current = null;
      }
    };
  }, [buildLocationLayersForNode, locationLayers, scheduleLocationQuery]);

  const handleLocationTypeToggle = useCallback((id: string) => {
    setLocationTypeSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleRouteModeToggle = useCallback((id: string) => {
    setRouteModeSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleLocationMoveEnd = useCallback((viewState: MapViewState) => {
    scheduleLocationQuery(viewState);
  }, [scheduleLocationQuery]);

  return (
    <Box sx={{ width: '100vw', height: '100vh', position: 'relative', overscrollBehavior: 'contain' }}>
      {nodeId ? (
        <ModelessDialogManager
          nodeId={nodeId}
          formattedZxy={formattedZxy}
          basemapStyles={basemapStyles}
          vectorLayers={vectorLayers}
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

      <ResourceLayerMap
        initialViewState={initialViewState}
        width="100%"
        height="100%"
        mapStyleUrl={mapStyleUrl}
        basemapStyles={basemapStyles}
        vectorLayers={filteredVectorLayers}
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
            setMissingLayerDialogOpen(true);
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
          },
        }}
        onLoad={handleMapLoad}
        onViewStateChange={handleViewStateChange}
        onMoveEnd={handleLocationMoveEnd}
        identifyFeatureOnClick={{ layerIds: highlightLayerIds, radius: LOCATION_INTERACTION_RADIUS_PX, disableDefaultSnackbar: true }}
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
