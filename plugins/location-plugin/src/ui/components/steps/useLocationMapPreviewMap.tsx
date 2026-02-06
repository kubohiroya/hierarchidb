import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import type { NodeId } from '@hierarchidb/core-types';
import type { LocationGroupItem } from '@hierarchidb/location-api';
import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { TreeNodeData } from '@hierarchidb/tree-api';
import type { Remote } from 'comlink';
import type { MapToggleSelection, MapViewState, ResourceGeoJsonLayer } from '@hierarchidb/ui-map';
import {
  buildCategoryFilter,
  clampTileZoom,
  filterItemsByTileIdSet,
  formatTileId,
  getViewportTileIdSet,
  lonLatToTileXY,
  resolveTileIdField,
} from '@hierarchidb/ui-map';
import type {
  LocationIconConfig,
  LocationLabelConfig,
  LocationRepresentationByZoomLevelConfig,
  LocationType,
} from '../../../common/types/index.js';
import type { MapLibreMapInstance } from '@hierarchidb/ui-map';
import { renderToStaticMarkup } from 'react-dom/server';
import { LOCATION_TYPE_STYLES } from './locationTypes.js';
import {
  CIRCLE_RADIUS_AT_MAX,
  CIRCLE_RADIUS_MAX_ZOOM,
  CIRCLE_RADIUS_MIN,
  DEBUG_PREFIX,
  DEFAULT_ICON_IDS,
  DEFAULT_ICON_SIZE_RANGE,
  DEFAULT_LABEL_SIZE_RANGE,
  DEFAULT_TYPE_COLORS,
  HOVER_RADIUS_PX,
  ICON_BASE_PX,
  KNOWN_LOCATION_TYPES,
  LABEL_SIZE_SCALE,
  MAX_HOVER_RESULTS,
  MAX_ICON_SIZE,
  MAX_LABEL_SIZE,
  MAX_TILE_ID_ZOOM,
  MIN_ICON_SIZE,
  MIN_LABEL_SIZE,
  MIN_ZOOM_LEVEL,
  PREFETCH_MARGIN_PX,
  LOCATION_ICON_COMPONENTS,
} from './locationMapPreviewConstants.js';
import { resolveCountryFlag, resolveLocationType } from './locationMapPreviewUtils.js';

const normalizeRange = (value: number[] | number, min: number, max: number): [number, number] => {
  const array = Array.isArray(value) ? value : [value, value];
  const first = Math.min(max, Math.max(min, Number(array[0] ?? min)));
  const second = Math.min(max, Math.max(min, Number(array[1] ?? first)));
  return first <= second ? [first, second] : [second, first];
};

const buildTypeMatchExpression = (
  entries: Array<[LocationType, unknown]>,
  fallback: unknown,
): Array<string | unknown> => {
  const expression: Array<string | unknown> = ['match', ['get', 'type']];
  entries.forEach(([type, value]) => {
    expression.push(type, value);
  });
  expression.push(fallback);
  return expression;
};

type ZoomScaledMatchConfig = {
  startZoom: number;
  fixedZoom: number;
  minValue: number;
  maxValue: number;
};

type ThresholdZoomMatchConfig = ZoomScaledMatchConfig & {
  baseStartZoom: number;
};

const buildZoomScaledMatchExpression = (
  entries: Array<[LocationType, ZoomScaledMatchConfig]>,
  fallback: number,
  minZoom: number,
  maxZoom: number,
): Array<string | unknown> => {
  const stops = new Set<number>([minZoom, maxZoom]);
  entries.forEach(([, config]) => {
    stops.add(config.startZoom);
    stops.add(config.fixedZoom);
  });
  const sortedStops = Array.from(stops).sort((a, b) => a - b);
  const sizeAtZoom = (config: ZoomScaledMatchConfig, zoom: number) => {
    if (zoom < config.startZoom) return 0;
    if (zoom >= config.fixedZoom) return config.maxValue;
    if (config.fixedZoom === config.startZoom) return config.maxValue;
    const t = (zoom - config.startZoom) / (config.fixedZoom - config.startZoom);
    return config.minValue + (config.maxValue - config.minValue) * t;
  };
  const expression: Array<string | unknown> = ['interpolate', ['linear'], ['zoom']];
  sortedStops.forEach((zoom) => {
    const matchEntries: Array<[LocationType, number]> = entries.map(([type, config]) => [
      type,
      sizeAtZoom(config, zoom),
    ]);
    expression.push(zoom, buildTypeMatchExpression(matchEntries, fallback));
  });
  return expression;
};

const buildThresholdedZoomMatchExpression = (
  entries: Array<[LocationType, ThresholdZoomMatchConfig]>,
  fallback: number,
  minZoom: number,
  maxZoom: number,
): Array<string | unknown> => {
  const stops = new Set<number>([minZoom, maxZoom]);
  entries.forEach(([, config]) => {
    stops.add(config.startZoom);
    if (config.startZoom + 1 <= maxZoom) {
      stops.add(config.startZoom + 1);
    }
    stops.add(config.fixedZoom);
  });
  const sortedStops = Array.from(stops).sort((a, b) => a - b);
  const sizeAtZoom = (config: ThresholdZoomMatchConfig, zoom: number) => {
    if (zoom <= config.startZoom) return 0;
    const denom = config.fixedZoom - config.baseStartZoom;
    if (denom <= 0) return config.maxValue;
    const clampedZoom = Math.min(Math.max(zoom, config.baseStartZoom), config.fixedZoom);
    const t = (clampedZoom - config.baseStartZoom) / denom;
    return config.minValue + (config.maxValue - config.minValue) * t;
  };
  const expression: Array<string | unknown> = ['interpolate', ['linear'], ['zoom']];
  sortedStops.forEach((zoom) => {
    const matchEntries: Array<[LocationType, number]> = entries.map(([type, config]) => [
      type,
      sizeAtZoom(config, zoom),
    ]);
    expression.push(zoom, buildTypeMatchExpression(matchEntries, fallback));
  });
  return expression;
};

const toIconScaleRange = (sizeRange: [number, number]): [number, number] => [
  sizeRange[0] / ICON_BASE_PX,
  sizeRange[1] / ICON_BASE_PX,
];

type PreviewPoint = {
  id: string;
  name?: string;
  longitude: number;
  latitude: number;
  type: LocationType;
  tileId?: string;
};

type HoverMatch = {
  id: string;
  index: number;
  name?: string;
  type: LocationType;
  typeLabel: string;
  region?: string;
  countryLabel?: string;
  miniMapX: number;
  miniMapY: number;
  Icon: typeof LOCATION_ICON_COMPONENTS.public;
  color: string;
};

type UseLocationMapPreviewMapArgs = {
  nodeId?: NodeId;
  workerApi: Remote<WorkerAPI<TreeNodeData>> | null;
  workerLoading: boolean;
  workerError: Error | null;
  initializeWorker: () => Promise<void>;
  locationTypeSelection: MapToggleSelection;
  iconConfig: LocationIconConfig;
  labelConfig: LocationLabelConfig;
  representationConfig: LocationRepresentationByZoomLevelConfig;
  tilesMaxZoom: number;
  metadataById: Map<string, LocationGroupItem>;
  t: (key: string, fallback?: string) => string;
  isDarkMode: boolean;
};

type UseLocationMapPreviewMapResult = {
  previewPoints: PreviewPoint[];
  locationGeoJsonLayers: ResourceGeoJsonLayer[];
  locationPreviewSnackbar?: ReactNode;
  hoverMatches: HoverMatch[];
  handleMapLoad: (map: MapLibreMapInstance) => void;
  handleMapMoveEnd: (viewState: MapViewState) => void;
};

export const useLocationMapPreviewMap = (
  args: UseLocationMapPreviewMapArgs,
): UseLocationMapPreviewMapResult => {
  const {
    nodeId,
    workerApi,
    workerLoading,
    workerError,
    initializeWorker,
    locationTypeSelection,
    iconConfig,
    labelConfig,
    representationConfig,
    tilesMaxZoom,
    metadataById,
    t,
    isDarkMode,
  } = args;

  const previewNodeId = nodeId ?? 'preview' as NodeId;
  const [previewPoints, setPreviewPoints] = useState<PreviewPoint[]>([]);
  const [hoverMatches, setHoverMatches] = useState<HoverMatch[]>([]);
  const [iconsReady, setIconsReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const styleImageMissingHandlerRef = useRef<((event: { id: string }) => void) | null>(null);
  const styleLoadHandlerRef = useRef<(() => void) | null>(null);
  const iconReloadingRef = useRef(false);
  const queryTimerRef = useRef<number | null>(null);
  const queryRequestRef = useRef(0);
  const hoverFrameRef = useRef<number | null>(null);
  const hoverPointRef = useRef<{ x: number; y: number } | null>(null);

  const enabledLocationTypes = useMemo(
    () => Object.keys(locationTypeSelection).filter((id) => locationTypeSelection[id]),
    [locationTypeSelection],
  );

  const fetchViewportPoints = useCallback(async (viewState?: MapViewState) => {
    console.info(DEBUG_PREFIX, 'viewport-fetch:request', {
      nodeId: previewNodeId,
      enabledTypes: enabledLocationTypes.length,
    });
    if (!previewNodeId || previewNodeId === 'preview') {
      setPreviewPoints([]);
      return;
    }
    if (!mapRef.current) return;
    if (enabledLocationTypes.length === 0) {
      setPreviewPoints([]);
      return;
    }
    if (!workerApi || workerLoading || workerError) {
      return;
    }
    const map = mapRef.current;
    const mapWithBounds = map as MapLibreMapInstance & {
      getBounds?: () => {
        getWest(): number;
        getSouth(): number;
        getEast(): number;
        getNorth(): number;
      };
    };
    const bounds = mapWithBounds.getBounds?.();
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
    const requestId = ++queryRequestRef.current;
    try {
      await initializeWorker();
      const api = await workerApi.getLocationQueryAPI();
      const zoomValue = viewState?.zoom ?? map.getZoom();
      const tileZoom = clampTileZoom(zoomValue, 0, MAX_TILE_ID_ZOOM);
      const tileIdField = resolveTileIdField(tileZoom, MAX_TILE_ID_ZOOM);
      const tileIdSet = getViewportTileIdSet(bbox, tileZoom, { minZoom: 0, maxZoom: MAX_TILE_ID_ZOOM });
      const items = (await api.queryByViewport(
        previewNodeId as NodeId,
        bbox,
        zoomValue,
        enabledLocationTypes,
        {
          prefetchMarginPx: PREFETCH_MARGIN_PX,
          viewportSizePx,
        },
      )) as LocationGroupItem[];
      if (requestId !== queryRequestRef.current) return;
      const points = items
        .map((item: LocationGroupItem) => {
          const data = item.data;
          if (!data) return null;
          const longitude = data.longitude;
          const latitude = data.latitude;
          if (typeof longitude !== 'number' || !Number.isFinite(longitude)) return null;
          if (typeof latitude !== 'number' || !Number.isFinite(latitude)) return null;
          const fallbackTile = (() => {
            const { x, y } = lonLatToTileXY(longitude, latitude, tileZoom);
            return formatTileId(tileZoom, x, y);
          })();
          const tileId = typeof data[tileIdField as keyof typeof data] === 'string'
            ? (data[tileIdField as keyof typeof data] as string)
            : fallbackTile;
          const name = typeof data.name === 'string' ? data.name : undefined;
          return {
            id: String(item.id),
            name,
            longitude,
            latitude,
            type: resolveLocationType(String(data.type ?? 'area_centroid')),
            tileId,
            [tileIdField]: tileId,
          } as PreviewPoint & Record<string, unknown>;
        })
        .filter(
          (point: PreviewPoint & Record<string, unknown> | null): point is PreviewPoint &
            Record<string, unknown> => Boolean(point)
        );
      const filtered = filterItemsByTileIdSet(points, tileIdSet, tileIdField);
      console.info(DEBUG_PREFIX, 'viewport-fetch:success', { nodeId: previewNodeId, count: filtered.length });
      setPreviewPoints(filtered as PreviewPoint[]);
    } catch (err) {
      console.error(DEBUG_PREFIX, 'viewport-fetch:error', { nodeId: previewNodeId, error: err });
    }
  }, [
    enabledLocationTypes,
    initializeWorker,
    previewNodeId,
    workerApi,
    workerError,
    workerLoading,
  ]);

  const scheduleViewportQuery = useCallback((viewState?: MapViewState) => {
    if (queryTimerRef.current) {
      window.clearTimeout(queryTimerRef.current);
    }
    queryTimerRef.current = window.setTimeout(() => {
      void fetchViewportPoints(viewState);
    }, 150);
  }, [fetchViewportPoints]);

  useEffect(() => {
    scheduleViewportQuery();
    return () => {
      if (queryTimerRef.current) {
        window.clearTimeout(queryTimerRef.current);
        queryTimerRef.current = null;
      }
    };
  }, [scheduleViewportQuery]);

  useEffect(() => () => {
    if (hoverFrameRef.current) {
      window.cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = null;
    }
  }, []);

  const knownLocationTypes = useMemo(() => KNOWN_LOCATION_TYPES.map((type) => type), []);
  const locationFilter = useMemo(
    () => buildCategoryFilter(enabledLocationTypes, knownLocationTypes, ['type']),
    [enabledLocationTypes, knownLocationTypes],
  );

  const iconAssets = useMemo(() => {
    return KNOWN_LOCATION_TYPES.map((type) => {
      const entry = iconConfig[type];
      const iconId = entry?.iconId ?? DEFAULT_ICON_IDS[type];
      const Icon = LOCATION_ICON_COMPONENTS[iconId] ?? LOCATION_TYPE_STYLES[type].icon;
      const color = entry?.color ?? DEFAULT_TYPE_COLORS[type];
      return {
        type,
        iconId,
        Icon,
        color,
        imageId: `location-preview-icon-${type}`,
      };
    });
  }, [iconConfig]);

  const iconAssetsById = useMemo(
    () => new Map(iconAssets.map((asset) => [asset.imageId, asset])),
    [iconAssets],
  );

  const loadIconImage = useCallback((map: MapLibreMapInstance, asset: {
    imageId: string;
    Icon: typeof LOCATION_ICON_COMPONENTS.public;
    color: string;
  }) => new Promise<void>((resolve) => {
    const mapWithImages = map as MapLibreMapInstance & {
      hasImage?: (id: string) => boolean;
      addImage?: (id: string, image: HTMLImageElement) => void;
    };
    if (!mapWithImages.addImage) {
      resolve();
      return;
    }
    if (mapWithImages.hasImage?.(asset.imageId)) {
      resolve();
      return;
    }
    const svg = renderToStaticMarkup(<asset.Icon htmlColor={asset.color} />);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const image = new Image();
    image.onload = () => {
      mapWithImages.addImage?.(asset.imageId, image);
      resolve();
    };
    image.onerror = () => resolve();
    image.src = dataUrl;
  }), []);

  const loadMapIcons = useCallback((map: MapLibreMapInstance) => {
    const mapWithImages = map as MapLibreMapInstance & {
      addImage?: (id: string, image: HTMLImageElement) => void;
    };
    if (!mapWithImages.addImage) return;
    setIconsReady(false);
    const loaders = iconAssets.map((asset) => loadIconImage(map, asset));
    void Promise.all(loaders).then(() => setIconsReady(true));
  }, [iconAssets, loadIconImage]);

  useEffect(() => {
    if (!mapRef.current) return;
    loadMapIcons(mapRef.current);
  }, [loadMapIcons]);

  useEffect(() => () => {
    if (!mapRef.current) return;
    const mapWithEvents = mapRef.current as MapLibreMapInstance & {
      off?: (type: string, listener: (event: { id: string }) => void) => void;
    };
    const handler = styleImageMissingHandlerRef.current;
    if (handler) {
      mapWithEvents.off?.('styleimagemissing', handler);
    }
    const styleLoadHandler = styleLoadHandlerRef.current;
    if (styleLoadHandler) {
      mapWithEvents.off?.('style.load', styleLoadHandler);
    }
  }, []);

  const circleColorExpression = useMemo(() => buildTypeMatchExpression(
    KNOWN_LOCATION_TYPES.map((type) => [type, iconConfig[type]?.color ?? DEFAULT_TYPE_COLORS[type]]),
    DEFAULT_TYPE_COLORS.area_centroid,
  ), [iconConfig]);

  const circleRadiusExpression = useMemo(() => {
    const entries: Array<[LocationType, ThresholdZoomMatchConfig]> = KNOWN_LOCATION_TYPES.map((type) => {
      const rep = representationConfig[type];
      return [
        type,
        {
          startZoom: rep.pointFromZoom,
          baseStartZoom: MIN_ZOOM_LEVEL,
          fixedZoom: CIRCLE_RADIUS_MAX_ZOOM,
          minValue: CIRCLE_RADIUS_MIN,
          maxValue: CIRCLE_RADIUS_AT_MAX,
        },
      ];
    });
    return buildThresholdedZoomMatchExpression(entries, CIRCLE_RADIUS_MIN, MIN_ZOOM_LEVEL, tilesMaxZoom);
  }, [representationConfig, tilesMaxZoom]);

  const iconImageExpression = useMemo(() => buildTypeMatchExpression(
    KNOWN_LOCATION_TYPES.map((type) => [type, `location-preview-icon-${type}`]),
    'location-preview-icon-area_centroid',
  ), []);

  const iconSizeExpression = useMemo(() => {
    const entries: Array<[LocationType, ZoomScaledMatchConfig]> = KNOWN_LOCATION_TYPES.map((type) => {
      const rep = representationConfig[type];
      const range = normalizeRange(iconConfig[type]?.sizeRange ?? DEFAULT_ICON_SIZE_RANGE, MIN_ICON_SIZE, MAX_ICON_SIZE);
      const [minScale, maxScale] = toIconScaleRange(range);
      const startZoom = rep.iconFromZoom;
      const fixedZoom = Math.max(startZoom, rep.iconFixedFromZoom);
      return [type, { startZoom, fixedZoom, minValue: minScale, maxValue: maxScale }];
    });
    return buildZoomScaledMatchExpression(entries, 0, MIN_ZOOM_LEVEL, tilesMaxZoom);
  }, [iconConfig, representationConfig, tilesMaxZoom]);

  const labelColorExpression = useMemo(() => buildTypeMatchExpression(
    KNOWN_LOCATION_TYPES.map((type) => [type, labelConfig[type]?.color ?? DEFAULT_TYPE_COLORS[type]]),
    DEFAULT_TYPE_COLORS.area_centroid,
  ), [labelConfig]);

  const labelSizeExpression = useMemo(() => {
    const entries: Array<[LocationType, ZoomScaledMatchConfig]> = KNOWN_LOCATION_TYPES.map((type) => {
      const entry = labelConfig[type];
      const zoomRange = normalizeRange(entry?.zoomRange ?? [MIN_ZOOM_LEVEL, tilesMaxZoom], MIN_ZOOM_LEVEL, tilesMaxZoom);
      const baseRange = normalizeRange(entry?.sizeRange ?? DEFAULT_LABEL_SIZE_RANGE, MIN_LABEL_SIZE, MAX_LABEL_SIZE);
      const scaledRange = normalizeRange(
        [baseRange[0] * LABEL_SIZE_SCALE, baseRange[1] * LABEL_SIZE_SCALE],
        MIN_LABEL_SIZE,
        MAX_LABEL_SIZE,
      );
      const startZoom = zoomRange[0];
      const fixedZoom = Math.max(startZoom, zoomRange[1]);
      return [type, { startZoom, fixedZoom, minValue: scaledRange[0], maxValue: scaledRange[1] }];
    });
    return buildZoomScaledMatchExpression(entries, 0, MIN_ZOOM_LEVEL, tilesMaxZoom);
  }, [labelConfig, tilesMaxZoom]);

  const labelHaloColor = useMemo(() => (isDarkMode ? '#000000' : '#ffffff'), [isDarkMode]);

  const labelOpacityExpression = useMemo(() => {
    const entries: Array<[LocationType, ThresholdZoomMatchConfig]> = KNOWN_LOCATION_TYPES.map((type) => {
      const entry = labelConfig[type];
      const zoomRange = normalizeRange(entry?.zoomRange ?? [MIN_ZOOM_LEVEL, tilesMaxZoom], MIN_ZOOM_LEVEL, tilesMaxZoom);
      const startZoom = zoomRange[0];
      return [type, { startZoom, fixedZoom: startZoom + 1, baseStartZoom: MIN_ZOOM_LEVEL, minValue: 0, maxValue: 1 }];
    });
    return buildThresholdedZoomMatchExpression(entries, 0, MIN_ZOOM_LEVEL, tilesMaxZoom);
  }, [labelConfig, tilesMaxZoom]);

  const locationGeoJsonLayers = useMemo<ResourceGeoJsonLayer[]>(() => {
    if (enabledLocationTypes.length === 0) return [];
    if (previewPoints.length === 0) return [];
    const labelFilter = locationFilter
      ? ['all', locationFilter, ['has', 'name']]
      : ['has', 'name'];
    const layers: ResourceGeoJsonLayer[] = [
      {
        layerId: `location-preview-${previewNodeId}-circle`,
        sourceId: `location-preview-source-${previewNodeId}`,
        layerType: 'circle',
        filter: locationFilter ?? undefined,
        data: {
          type: 'FeatureCollection',
          features: previewPoints.map((point) => ({
            type: 'Feature',
            id: point.id,
            geometry: {
              type: 'Point',
              coordinates: [point.longitude, point.latitude],
            },
            properties: {
              type: resolveLocationType(point.type),
              name: point.name ?? '',
            },
          })),
        },
        paint: {
          'circle-radius': circleRadiusExpression,
          'circle-color': circleColorExpression,
          'circle-opacity': 0.8,
        },
      },
    ];
    if (iconsReady) {
      layers.push({
        layerId: `location-preview-${previewNodeId}-icon`,
        sourceId: `location-preview-source-${previewNodeId}`,
        layerType: 'symbol',
        filter: locationFilter ?? undefined,
        data: {
          type: 'FeatureCollection',
          features: previewPoints.map((point) => ({
            type: 'Feature',
            id: point.id,
            geometry: {
              type: 'Point',
              coordinates: [point.longitude, point.latitude],
            },
            properties: {
              type: resolveLocationType(point.type),
              name: point.name ?? '',
            },
          })),
        },
        layout: {
          'icon-image': iconImageExpression,
          'icon-size': iconSizeExpression,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
    }
    layers.push({
      layerId: `location-preview-${previewNodeId}-label`,
      sourceId: `location-preview-source-${previewNodeId}`,
      layerType: 'symbol',
      filter: labelFilter ?? undefined,
      data: {
        type: 'FeatureCollection',
        features: previewPoints.map((point) => ({
          type: 'Feature',
          id: point.id,
          geometry: {
            type: 'Point',
            coordinates: [point.longitude, point.latitude],
          },
          properties: {
            type: resolveLocationType(point.type),
            name: point.name ?? '',
          },
        })),
      },
      layout: {
        'text-field': ['get', 'name'],
        'text-size': labelSizeExpression,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': labelColorExpression,
        'text-halo-color': labelHaloColor,
        'text-halo-width': 1,
        'text-opacity': labelOpacityExpression,
      },
    });
    return layers;
  }, [
    circleColorExpression,
    circleRadiusExpression,
    enabledLocationTypes.length,
    iconImageExpression,
    iconSizeExpression,
    iconsReady,
    labelColorExpression,
    labelHaloColor,
    labelOpacityExpression,
    labelSizeExpression,
    locationFilter,
    previewNodeId,
    previewPoints,
  ]);

  const clearHoverMatches = useCallback(() => {
    setHoverMatches([]);
  }, []);

  const resolveHoverMatches = useCallback((point: { x: number; y: number }) => {
    const map = mapRef.current as (MapLibreMapInstance & {
      project?: (lngLat: { lng: number; lat: number }) => { x: number; y: number };
    }) | null;
    if (!map?.project) {
      clearHoverMatches();
      return;
    }
    if (previewPoints.length === 0) {
      clearHoverMatches();
      return;
    }
    const radiusSquared = HOVER_RADIUS_PX * HOVER_RADIUS_PX;
    const zoomValue = typeof map.getZoom === 'function' ? map.getZoom() : MIN_ZOOM_LEVEL;
    const candidates = previewPoints
      .map((previewPoint) => {
        const projected = map.project?.({ lng: previewPoint.longitude, lat: previewPoint.latitude });
        if (!projected) return null;
        const dx = projected.x - point.x;
        const dy = projected.y - point.y;
        const distanceSquared = dx * dx + dy * dy;
        return {
          previewPoint,
          distanceSquared,
          projectedX: projected.x,
          projectedY: projected.y,
          dx,
          dy,
        };
      })
      .filter((entry): entry is {
        previewPoint: PreviewPoint;
        distanceSquared: number;
        projectedX: number;
        projectedY: number;
        dx: number;
        dy: number;
      } => {
        if (!entry) return false;
        return entry.distanceSquared <= radiusSquared;
      })
      .sort((a, b) => {
        if (a.projectedY !== b.projectedY) return a.projectedY - b.projectedY;
        if (a.projectedX !== b.projectedX) return a.projectedX - b.projectedX;
        return a.distanceSquared - b.distanceSquared;
      })
      .slice(0, MAX_HOVER_RESULTS);

    const nextMatches = candidates.map(({ previewPoint, dx, dy }, index) => {
      const metadata = metadataById.get(previewPoint.id);
      const data = metadata?.data;
      const type = previewPoint.type;
      const typeLabel = t(`locationTypes.${type}`, type);
      const name = data?.name ?? previewPoint.name;
      const representation = representationConfig[type];
      const useIcon = zoomValue >= representation.iconFromZoom;
      const admin1 = typeof data?.admin1 === 'string' ? data.admin1 : undefined;
      const admin2 = typeof data?.admin2 === 'string' ? data.admin2 : undefined;
      const region = [admin1, admin2].filter(Boolean).join(' / ') || undefined;
      const countryCode = typeof data?.admin0Code === 'string' ? data.admin0Code : undefined;
      const countryName = typeof data?.admin0 === 'string' ? data.admin0 : undefined;
      const countryFlag = resolveCountryFlag(countryCode);
      const countryLabel = countryName
        ? `${countryFlag ? `${countryFlag} ` : ''}${countryName}`
        : (countryFlag ? `${countryFlag}` : undefined);
      const iconEntry = iconConfig[type];
      const iconId = iconEntry?.iconId ?? DEFAULT_ICON_IDS[type];
      const Icon = LOCATION_ICON_COMPONENTS[iconId] ?? LOCATION_TYPE_STYLES[type].icon;
      const circleColor = iconEntry?.color ?? DEFAULT_TYPE_COLORS[type];
      const iconColor = iconEntry?.color ?? DEFAULT_TYPE_COLORS[type];
      const color = useIcon ? iconColor : circleColor;
      const miniMapX = 32 + dx * 4;
      const miniMapY = 32 + dy * 4;
      return {
        id: previewPoint.id,
        index: index + 1,
        name,
        type,
        typeLabel,
        region,
        countryLabel,
        miniMapX,
        miniMapY,
        Icon,
        color,
      };
    });

    const isSame =
      hoverMatches.length === nextMatches.length
      && hoverMatches.every((prev, index) => {
        const next = nextMatches[index];
        if (!next) return false;
        if (prev.id !== next.id) return false;
        const prevX = Math.round(prev.miniMapX);
        const prevY = Math.round(prev.miniMapY);
        const nextX = Math.round(next.miniMapX);
        const nextY = Math.round(next.miniMapY);
        return prevX === nextX && prevY === nextY;
      });
    if (!isSame) {
      setHoverMatches(nextMatches);
    }
  }, [clearHoverMatches, hoverMatches, iconConfig, metadataById, previewPoints, representationConfig, t]);

  const scheduleHoverLookup = useCallback((point: { x: number; y: number }) => {
    hoverPointRef.current = point;
    if (hoverFrameRef.current) {
      window.cancelAnimationFrame(hoverFrameRef.current);
    }
    hoverFrameRef.current = window.requestAnimationFrame(() => {
      if (!hoverPointRef.current) return;
      resolveHoverMatches(hoverPointRef.current);
    });
  }, [resolveHoverMatches]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current as (MapLibreMapInstance & {
      on?: (name: string, handler: (event: { point?: { x: number; y: number } }) => void) => void;
      off?: (name: string, handler: (event: { point?: { x: number; y: number } }) => void) => void;
    }) | null;
    if (!map?.on) return;
    const handleMouseMove = (event: { point?: { x: number; y: number } }) => {
      if (!event?.point) return;
      scheduleHoverLookup({ x: event.point.x, y: event.point.y });
    };
    const handleMouseLeave = () => {
      clearHoverMatches();
    };
    map.on('mousemove', handleMouseMove);
    map.on('mouseleave', handleMouseLeave);
    return () => {
      map.off?.('mousemove', handleMouseMove);
      map.off?.('mouseleave', handleMouseLeave);
    };
  }, [clearHoverMatches, mapReady, scheduleHoverLookup]);

  const locationPreviewSnackbar = useMemo(() => {
    if (hoverMatches.length === 0) return undefined;
    const snackbarBg = isDarkMode ? 'rgba(32,32,36,0.92)' : 'rgba(255,255,255,0.96)';
    const snackbarText = isDarkMode ? '#F5F5F7' : '#1F1F24';
    const radarFill = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
    const radarStroke = isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)';
    return (
      <Box sx={{ display: 'flex', gap: 1.5, minWidth: 320, color: snackbarText, bgcolor: snackbarBg, borderRadius: 1.5, px: 1.5, py: 1 }}>
        <Box sx={{ width: 64, height: 64, flex: '0 0 64px' }}>
          <svg width={64} height={64} viewBox="0 0 64 64">
            <title>miniRader</title>
            <circle cx={32} cy={32} r={32} fill={radarFill} />
            <circle cx={32} cy={32} r={31.5} fill="none" stroke={radarStroke} />
            {hoverMatches.map((match) => (
              <g key={match.id}>
                <text
                  x={match.miniMapX}
                  y={match.miniMapY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight="700"
                  fill={match.color}
                >
                  {match.index}
                </text>
              </g>
            ))}
          </svg>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 220 }}>
          {hoverMatches.map((match) => (
            <Box key={match.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ width: 18, textAlign: 'right' }}>
                {match.index}.
              </Typography>
              <match.Icon fontSize="small" htmlColor={match.color} />
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {match.name ? (
                  <Typography variant="body2" sx={{ fontWeight: 600, color: snackbarText }}>
                    {match.name}
                  </Typography>
                ) : null}
                <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(245,245,247,0.7)' : 'rgba(31,31,36,0.6)' }}>
                  {[
                    match.region,
                    match.countryLabel,
                  ].filter(Boolean).join(' / ')}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }, [hoverMatches, isDarkMode]);

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    mapRef.current = map;
    setMapReady(true);
    loadMapIcons(map);
    const mapWithEvents = map as MapLibreMapInstance & {
      on?: (type: string, listener: (event: { id: string }) => void) => void;
      off?: (type: string, listener: (event: { id: string }) => void) => void;
      hasImage?: (id: string) => boolean;
    };
    if (!styleImageMissingHandlerRef.current) {
      styleImageMissingHandlerRef.current = (event: { id: string }) => {
        const asset = iconAssetsById.get(event.id);
        if (!asset || !mapRef.current) return;
        void loadIconImage(mapRef.current, asset);
      };
    }
    const handler = styleImageMissingHandlerRef.current;
    if (handler) {
      mapWithEvents.off?.('styleimagemissing', handler);
      mapWithEvents.on?.('styleimagemissing', handler);
    }
    if (!styleLoadHandlerRef.current) {
      styleLoadHandlerRef.current = () => {
        const currentMap = mapRef.current;
        if (!currentMap) return;
        if (iconReloadingRef.current) return;
        const mapWithImages = currentMap as MapLibreMapInstance & {
          hasImage?: (id: string) => boolean;
        };
        const hasAllIcons = iconAssets.every((asset) => mapWithImages.hasImage?.(asset.imageId));
        if (hasAllIcons) return;
        iconReloadingRef.current = true;
        setIconsReady(false);
        void Promise.resolve(loadMapIcons(currentMap)).finally(() => {
          iconReloadingRef.current = false;
        });
      };
    }
    const styleLoadHandler = styleLoadHandlerRef.current;
    if (styleLoadHandler) {
      mapWithEvents.off?.('style.load', styleLoadHandler);
      mapWithEvents.on?.('style.load', styleLoadHandler);
    }
    scheduleViewportQuery();
  }, [iconAssets, iconAssetsById, loadIconImage, loadMapIcons, scheduleViewportQuery]);

  const handleMapMoveEnd = useCallback((viewState: MapViewState) => {
    scheduleViewportQuery(viewState);
  }, [scheduleViewportQuery]);

  return {
    previewPoints,
    locationGeoJsonLayers,
    locationPreviewSnackbar,
    hoverMatches,
    handleMapLoad,
    handleMapMoveEnd,
  };
};
