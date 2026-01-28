/**
 * Map preview step for Location dialog.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { LocationOn } from '@mui/icons-material';
import { Anchor, FlightTakeoff, ForkRight, LocationCity, Public, Subway } from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/common-types';
import type {
  MapToggleSelection,
  MapViewState,
  MapAttributionItem,
  ResourceGeoJsonLayer,
} from '@hierarchidb/ui-map';
import {
  buildCategoryFilter,
  clampTileZoom,
  DEFAULT_MAP_CONFIG,
  filterItemsByTileIdSet,
  formatTileId,
  getViewportTileIdSet,
  lonLatToTileXY,
  MapToggleCard,
  LocationPreviewList,
  ResourceLayerMap,
  resolveTileIdField,
} from '@hierarchidb/ui-map';
import type {
  LocationEntity,
  LocationIconConfig,
  LocationIconId,
  LocationLabelConfig,
  LocationRepresentationByZoomLevelConfig,
  LocationType,
} from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { FloatingWindow, useFloatingWindow } from '@hierarchidb/ui-floating-window';
import { LOCATION_TYPE_STYLES } from './locationTypes.js';
import { resolveLocationAttribution } from '../../../common/datasources/attribution.js';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import type { MapLibreMapInstance } from '@hierarchidb/ui-map';
import type { LocationGroupItem } from '@hierarchidb/plugin-service-api';
import { renderToStaticMarkup } from 'react-dom/server';
import { useIdeGsmImportOnEntry } from '../../hooks/useIdeGsmImportOnEntry.js';

const KNOWN_LOCATION_TYPES: readonly LocationType[] = [
  'area_centroid',
  'airport',
  'port',
  'railway_station',
  'interchange',
];

const DEFAULT_TYPE_COLORS: Record<LocationType, string> = {
  area_centroid: '#d62728',
  airport: LOCATION_TYPE_STYLES.airport.color,
  port: '#1f77b4',
  railway_station: '#2ca02c',
  interchange: LOCATION_TYPE_STYLES.interchange.color,
};

const PREFETCH_MARGIN_PX = 64;
const CIRCLE_RADIUS_MIN = 2;
const CIRCLE_RADIUS_MAX_ZOOM = 11;
const CIRCLE_RADIUS_SLOPE = 0.6;
const CIRCLE_RADIUS_AT_MAX = CIRCLE_RADIUS_MIN + CIRCLE_RADIUS_MAX_ZOOM * CIRCLE_RADIUS_SLOPE;

const MAX_TILE_ID_ZOOM = 9;
const MIN_ZOOM_LEVEL = 0;
const MAX_ZOOM_LEVEL = 22;
const DEFAULT_MAX_ZOOM = 12;
const DEFAULT_ICON_SIZE_RANGE: [number, number] = [12, 28];
const DEFAULT_LABEL_SIZE_RANGE: [number, number] = [10, 18];
const LABEL_SIZE_SCALE = 1.3;
const MONOCHROME_STYLE_URLS = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};
const MIN_ICON_SIZE = 8;
const MAX_ICON_SIZE = 48;
const MIN_LABEL_SIZE = 8;
const MAX_LABEL_SIZE = 32;
const ICON_BASE_PX = 24;

const LOCATION_ICON_COMPONENTS: Record<LocationIconId, SvgIconComponent> = {
  public: Public,
  location_city: LocationCity,
  flight_takeoff: FlightTakeoff,
  directions_boat: Anchor,
  train: Subway,
  fork_right: ForkRight,
};


const DEFAULT_ICON_IDS: Record<LocationType, LocationIconId> = {
  area_centroid: 'location_city',
  airport: 'flight_takeoff',
  port: 'directions_boat',
  railway_station: 'train',
  interchange: 'fork_right',
};

const METADATA_COLUMNS_ORDER = [
  'id',
  'pointId',
  'name',
  'type',
  'latitude',
  'longitude',
  'countryCode',
  'countryName',
  'admin1',
  'admin2',
  'admin1Code',
  'admin2Code',
  'updatedAt',
  'metadata',
] as const;

const resolveLocationType = (value: string): LocationType => (
  (KNOWN_LOCATION_TYPES as readonly string[]).includes(value)
    ? value as LocationType
    : 'area_centroid'
);

const formatTimestamp = (value?: number): string | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return new Date(value).toISOString();
};

const buildMetadataRows = (items: LocationGroupItem[]): Array<Record<string, unknown>> => (
  items.map((item) => {
    const data = item.data;
    const rawType = typeof data?.type === 'string' ? data.type : undefined;
    return {
      id: item.id,
      pointId: data?.pointId,
      name: data?.name,
      type: rawType ? resolveLocationType(rawType) : 'area_centroid',
      latitude: data?.latitude,
      longitude: data?.longitude,
      countryCode: data?.countryCode,
      countryName: data?.countryName,
      admin1: data?.admin1,
      admin2: data?.admin2,
      admin1Code: data?.admin1Code,
      admin2Code: data?.admin2Code,
      updatedAt: formatTimestamp(item.updatedAt),
      metadata: data?.metadata,
    };
  })
);

const buildMetadataColumns = (rows: Array<Record<string, unknown>>): string[] => {
  const baseColumns = METADATA_COLUMNS_ORDER.filter((col) =>
    rows.some((row) => row[col] != null && row[col] !== ''),
  );
  const extra = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (METADATA_COLUMNS_ORDER.includes(key as typeof METADATA_COLUMNS_ORDER[number])) return;
      if (row[key] == null || row[key] === '') return;
      extra.add(key);
    });
  });
  return [...baseColumns, ...extra];
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeRange = (value: number[] | number, min: number, max: number): [number, number] => {
  const array = Array.isArray(value) ? value : [value, value];
  const first = clamp(Number(array[0] ?? min), min, max);
  const second = clamp(Number(array[1] ?? first), min, max);
  return first <= second ? [first, second] : [second, first];
};

const normalizeZoomStops = (values: number[], maxZoom: number): [number, number, number, number] => {
  const clamped = values.map((value) => clamp(Math.round(value), MIN_ZOOM_LEVEL, maxZoom));
  const normalized: number[] = [];
  let last = MIN_ZOOM_LEVEL;
  for (let index = 0; index < 4; index += 1) {
    const next = clamp(clamped[index] ?? last, last, maxZoom);
    normalized.push(next);
    last = next;
  }
  return normalized as [number, number, number, number];
};

const buildDefaultRepresentationConfig = (maxZoom: number): LocationRepresentationByZoomLevelConfig => {
  const stops = normalizeZoomStops([
    0,
    Math.round(maxZoom * 0.4),
    Math.round(maxZoom * 0.6),
    Math.round(maxZoom * 0.8),
  ], maxZoom);
  return KNOWN_LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = {
      pointFromZoom: stops[0],
      polygonFromZoom: stops[1],
      iconFromZoom: stops[2],
      iconFixedFromZoom: stops[3],
    };
    return acc;
  }, {} as LocationRepresentationByZoomLevelConfig);
};

const buildDefaultIconConfig = (): LocationIconConfig => (
  KNOWN_LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = {
      color: DEFAULT_TYPE_COLORS[type],
      iconId: DEFAULT_ICON_IDS[type],
      sizeRange: DEFAULT_ICON_SIZE_RANGE,
    };
    return acc;
  }, {} as LocationIconConfig)
);

const buildDefaultLabelConfig = (maxZoom: number): LocationLabelConfig => {
  const zoomRange = normalizeRange([
    Math.round(maxZoom * 0.6),
    Math.round(maxZoom * 0.8),
  ], MIN_ZOOM_LEVEL, maxZoom);
  return KNOWN_LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = {
      color: DEFAULT_TYPE_COLORS[type],
      zoomRange,
      sizeRange: DEFAULT_LABEL_SIZE_RANGE,
    };
    return acc;
  }, {} as LocationLabelConfig);
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


const LOCATION_TYPE_OPTIONS = (Object.entries(LOCATION_TYPE_STYLES) as Array<
  [LocationType, (typeof LOCATION_TYPE_STYLES)[LocationType]]
>).map(([key, value]) => {
  const Icon = value.icon;
  return {
    id: key,
    label: key,
    icon: <Icon fontSize="small" />,
  };
});

const buildInitialViewState = (bbox?: [number, number, number, number]): MapViewState => {
  if (!bbox) return DEFAULT_MAP_CONFIG.viewState;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const longitude = (minLon + maxLon) / 2;
  const latitude = (minLat + maxLat) / 2;
  return {
    longitude: Number.isFinite(longitude) ? longitude : DEFAULT_MAP_CONFIG.viewState.longitude,
    latitude: Number.isFinite(latitude) ? latitude : DEFAULT_MAP_CONFIG.viewState.latitude,
    zoom: DEFAULT_MAP_CONFIG.viewState.zoom,
  };
};

interface LocationMapPreviewStepProps {
  draft: Partial<LocationEntity>;
  nodeId?: NodeId;
  onUpdate?: (updates: Partial<LocationEntity>) => void;
}

type PreviewPoint = {
  id: string;
  name?: string;
  longitude: number;
  latitude: number;
  type: LocationType;
  tileId?: string;
};

export const LocationMapPreviewStep: React.FC<LocationMapPreviewStepProps> = ({ draft: _draft, nodeId, onUpdate }) => {
  const theme = useTheme();
  useIdeGsmImportOnEntry({ draft: _draft, nodeId, onUpdate });
  const { translations } = useTranslation();
  const previewNodeId = nodeId ?? 'preview' as NodeId;
  const [previewPoints, setPreviewPoints] = useState<PreviewPoint[]>([]);
  const [metadataRows, setMetadataRows] = useState<Array<Record<string, unknown>>>([]);
  const [metadataItems, setMetadataItems] = useState<LocationGroupItem[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [selectedMetadataIds, setSelectedMetadataIds] = useState<Set<string>>(new Set());
  const [metadataError, setMetadataError] = useState<string | undefined>();
  const metadataRequestRef = useRef(0);
  const [locationTypeSelection, setLocationTypeSelection] = useState<MapToggleSelection>(() =>
    Object.fromEntries(LOCATION_TYPE_OPTIONS.map((option) => [option.id, true])) as MapToggleSelection
  );
  const filteredMetadataRows = useMemo(() => {
    if (!metadataRows.length) return metadataRows;
    return metadataRows.filter((row) => {
      const type = typeof row.type === 'string' ? row.type : undefined;
      if (!type) return false;
      return Boolean(locationTypeSelection[type]);
    });
  }, [metadataRows, locationTypeSelection]);

  const filteredMetadataColumns = useMemo(
    () => buildMetadataColumns(filteredMetadataRows),
    [filteredMetadataRows],
  );

  const handleMetadataSelectionChange = useCallback((selected: Set<string | number>) => {
    const next = new Set<string>();
    selected.forEach((value) => next.add(String(value)));
    setSelectedMetadataIds(next);
  }, []);

  const isMetadataRecycling = useCallback((item: LocationGroupItem) => {
    const meta = item.data?.metadata;
    if (!meta || typeof meta !== 'object') return false;
    return (meta as Record<string, unknown>).recycling === 'true';
  }, []);

  const recyclingState = useMemo(() => {
    if (selectedMetadataIds.size === 0) return 'none' as const;
    const selectedItems = metadataItems.filter((item) => selectedMetadataIds.has(String(item.id)));
    if (selectedItems.length == 0) return 'none' as const;
    const recyclingCount = selectedItems.filter(isMetadataRecycling).length;
    if (recyclingCount == 0) return 'off' as const;
    if (recyclingCount == selectedItems.length) return 'on' as const;
    return 'partial' as const;
  }, [isMetadataRecycling, metadataItems, selectedMetadataIds]);

  const handleToggleRecycling = useCallback(async () => {
    if (!nodeId) return;
    if (selectedMetadataIds.size === 0) return;
    type LocationGroupItemWithData = LocationGroupItem & { data: NonNullable<LocationGroupItem['data']> };
    const selectedItems = metadataItems.filter(
      (item): item is LocationGroupItemWithData => (
        selectedMetadataIds.has(String(item.id)) && item.data?.schemaVersion === 2
      )
    );
    if (selectedItems.length == 0) return;
    const recyclingCount = selectedItems.filter(isMetadataRecycling).length;
    const nextValue = recyclingCount != selectedItems.length;
    const updatedItems: LocationGroupItem[] = selectedItems.map((item) => ({
      ...item,
      data: {
        ...item.data,
        metadata: {
          ...((item.data?.metadata ?? {}) as Record<string, unknown>),
          recycling: nextValue ? 'true' : 'false',
        },
      },
    }));
    const bridge = getWorkerBridge();
    await bridge.initialize();
    const api = await bridge.getLocationMutationAPI();
    await api.upsertLocationGroups(nodeId, updatedItems);
    const updatedMap = new Map(updatedItems.map((item) => [String(item.id), item]));
    const nextItems: LocationGroupItem[] = metadataItems.map((item) => updatedMap.get(String(item.id)) ?? item);
    setMetadataItems(nextItems);
    setMetadataRows(buildMetadataRows(nextItems));
  }, [isMetadataRecycling, metadataItems, nodeId, selectedMetadataIds]);

  const [iconsReady, setIconsReady] = useState(false);
  const [metadataWindowOpen, setMetadataWindowOpen] = useState(true);
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const styleImageMissingHandlerRef = useRef<((event: { id: string }) => void) | null>(null);
  const styleLoadHandlerRef = useRef<(() => void) | null>(null);
  const iconReloadingRef = useRef(false);
  const queryTimerRef = useRef<number | null>(null);
  const queryRequestRef = useRef(0);
  const dataSourceAttribution = useMemo(
    () => resolveLocationAttribution(_draft.dataSource ?? null),
    [_draft.dataSource],
  );
  const tilesMaxZoom = clamp(_draft.tilesMaxZoom ?? DEFAULT_MAX_ZOOM, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
  const representationConfig = useMemo(() => {
    const defaults = buildDefaultRepresentationConfig(tilesMaxZoom);
    return KNOWN_LOCATION_TYPES.reduce((acc, type) => {
      acc[type] = _draft.representationByZoomLevelConfig?.[type] ?? defaults[type];
      return acc;
    }, {} as LocationRepresentationByZoomLevelConfig);
  }, [_draft.representationByZoomLevelConfig, tilesMaxZoom]);
  const iconConfig = useMemo(() => {
    const defaults = buildDefaultIconConfig();
    return KNOWN_LOCATION_TYPES.reduce((acc, type) => {
      acc[type] = _draft.iconConfig?.[type] ?? defaults[type];
      return acc;
    }, {} as LocationIconConfig);
  }, [_draft.iconConfig]);
  const labelConfig = useMemo(() => {
    const defaults = buildDefaultLabelConfig(tilesMaxZoom);
    return KNOWN_LOCATION_TYPES.reduce((acc, type) => {
      acc[type] = _draft.labelConfig?.[type] ?? defaults[type];
      return acc;
    }, {} as LocationLabelConfig);
  }, [_draft.labelConfig, tilesMaxZoom]);

  useEffect(() => {
    if (!nodeId) {
      setMetadataRows([]);
      setMetadataLoading(false);
      setMetadataError(undefined);
      return;
    }
    let cancelled = false;
    const requestId = ++metadataRequestRef.current;
    setMetadataLoading(true);
    setMetadataError(undefined);

    const run = async () => {
      try {
        const bridge = getWorkerBridge();
        await bridge.initialize();
        const api = await bridge.getLocationQueryAPI();
        const items = await api.listLocationGroups(nodeId);
        if (cancelled || requestId !== metadataRequestRef.current) return;
        const rows = buildMetadataRows(items);
        setMetadataItems(items);
        setMetadataRows(rows);
        setMetadataLoading(false);
      } catch (error) {
        if (cancelled || requestId !== metadataRequestRef.current) return;
        const message = error instanceof Error ? error.message : String(error);
        setMetadataItems([]);
        setMetadataRows([]);
        setMetadataLoading(false);
        setMetadataError(message);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  const terrainToggleOptions = useMemo(() => (
    LOCATION_TYPE_OPTIONS.map((option) => {
      const type = option.id as LocationType;
      const Icon = LOCATION_TYPE_STYLES[type].icon;
      const iconColor = iconConfig[type]?.color ?? DEFAULT_TYPE_COLORS[type];
      const labelColor = labelConfig[type]?.color ?? DEFAULT_TYPE_COLORS[type];
      return {
        id: option.id,
        label: translations.locationTypes?.[type] ?? option.label,
        icon: <Icon fontSize="small" htmlColor={iconColor} />,
        labelColor,
      };
    })
  ), [iconConfig, labelConfig, translations.locationTypes]);

  const mapStyleUrl = useMemo(() => (
    theme.palette.mode === 'dark'
      ? MONOCHROME_STYLE_URLS.dark
      : MONOCHROME_STYLE_URLS.light
  ), [theme.palette.mode]);
  const terrainWindow = useFloatingWindow({
    persistKey: 'hierarchidb:ui:floating-window:location:terrain',
    initialPosition: { x: 80, y: 40 },
    initialSize: { width: 280, height: 280 },
  });

  const attributionItems = useMemo<MapAttributionItem[]>(() => {
    if (!dataSourceAttribution) return [];
    return [{
      id: `location:${dataSourceAttribution.id}`,
      label: dataSourceAttribution.label,
      attribution: dataSourceAttribution.attribution,
      url: dataSourceAttribution.url,
      license: dataSourceAttribution.license,
      licenseUrl: dataSourceAttribution.licenseUrl,
    }];
  }, [dataSourceAttribution]);


  const enabledLocationTypes = useMemo(
    () => LOCATION_TYPE_OPTIONS.filter((option) => locationTypeSelection[option.id]).map((option) => option.id),
    [locationTypeSelection],
  );

  const fetchViewportPoints = useCallback(async (viewState?: MapViewState) => {
    if (!previewNodeId || previewNodeId === 'preview') {
      setPreviewPoints([]);
      return;
    }
    if (!mapRef.current) return;
    if (enabledLocationTypes.length === 0) {
      setPreviewPoints([]);
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
      const bridge = getWorkerBridge();
      await bridge.initialize();
      const api = await bridge.getLocationQueryAPI();
      const zoomValue = viewState?.zoom ?? map.getZoom();
      const tileZoom = clampTileZoom(zoomValue, 0, MAX_TILE_ID_ZOOM);
      const tileIdField = resolveTileIdField(tileZoom, MAX_TILE_ID_ZOOM);
      const tileIdSet = getViewportTileIdSet(bbox, tileZoom, { minZoom: 0, maxZoom: MAX_TILE_ID_ZOOM });
      const items = await api.queryByViewport(
        previewNodeId as NodeId,
        bbox,
        zoomValue,
        enabledLocationTypes,
        {
          prefetchMarginPx: PREFETCH_MARGIN_PX,
          viewportSizePx,
        },
      );
      if (requestId !== queryRequestRef.current) return;
      const points = items
        .map((item) => {
          const data = item.data as Record<string, unknown> | undefined;
          if (!data) return null;
          const longitude = data.longitude as number | undefined;
          const latitude = data.latitude as number | undefined;
          if (typeof longitude !== 'number' || !Number.isFinite(longitude)) return null;
          if (typeof latitude !== 'number' || !Number.isFinite(latitude)) return null;
          const fallbackTile = (() => {
            const { x, y } = lonLatToTileXY(longitude, latitude, tileZoom);
            return formatTileId(tileZoom, x, y);
          })();
          const tileId = typeof data[tileIdField] === 'string' ? data[tileIdField] as string : fallbackTile;
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
        .filter((point): point is PreviewPoint & Record<string, unknown> => Boolean(point));
      const filtered = filterItemsByTileIdSet(points, tileIdSet, tileIdField);
      setPreviewPoints(filtered as PreviewPoint[]);
    } catch (err) {
      if (requestId === queryRequestRef.current) {
        setPreviewPoints([]);
      }
      console.warn('[LocationMapPreviewStep] viewport query failed', err);
    }
  }, [enabledLocationTypes, previewNodeId]);

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
  const knownLocationTypes = useMemo(() => LOCATION_TYPE_OPTIONS.map((option) => option.id), []);
  const locationFilter = useMemo(
    () => buildCategoryFilter(enabledLocationTypes, knownLocationTypes, ['type']),
    [enabledLocationTypes, knownLocationTypes],
  );
  const iconAssets = useMemo(() => {
    return KNOWN_LOCATION_TYPES.map((type) => {
      const entry = iconConfig[type];
      const iconId = entry?.iconId ?? DEFAULT_ICON_IDS[type];
      const Icon = LOCATION_ICON_COMPONENTS[iconId] ?? LocationCity;
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
    Icon: typeof LocationCity;
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
      hasImage?: (id: string) => boolean;
      addImage?: (id: string, image: HTMLImageElement) => void;
      removeImage?: (id: string) => void;
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

  const initialViewState = useMemo(
    () => buildInitialViewState(undefined),
    [],
  );
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
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
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
    labelSizeExpression,
    locationFilter,
    previewPoints,
    previewNodeId,
  ]);
  const handleLocationToggle = useCallback((id: string) => {
    setLocationTypeSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    mapRef.current = map;
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

  return (
    <Box display="flex" flexDirection="column" height="100%" minHeight={0} flex={1}>
      <Box
        flex={1}
        minHeight={0}
        height="100%"
        borderRadius={1}
        overflow="hidden"
        position="relative"
        sx={{ overscrollBehavior: 'contain', p: 0 }}
      >
        <ResourceLayerMap
          initialViewState={initialViewState}
          width="100%"
          height="100%"
          mapStyleUrl={mapStyleUrl}
          basemapStyles={[]}
          vectorLayers={[]}
          geoJsonLayers={locationGeoJsonLayers}
          attributionItems={attributionItems}
          mapOptions={DEFAULT_MAP_CONFIG.interactionOptions}
          onLoad={handleMapLoad}
          onMoveEnd={handleMapMoveEnd}
        />
        {terrainWindow.windowState.isVisible ? (
          <FloatingWindow
            title="Terrain Types"
            initialState={terrainWindow.windowState}
            onStateChange={terrainWindow.handlers.onStateChange}
            onClose={terrainWindow.handlers.onClose}
          >
            <Box sx={{ height: '100%', minHeight: 0 }}>
              <MapToggleCard
                title=""
                options={terrainToggleOptions}
                selection={locationTypeSelection}
                onToggle={handleLocationToggle}
              />
            </Box>
          </FloatingWindow>
        ) : (
          <Box position="absolute" top={8} right={8} zIndex={3}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              aria-label="Show terrain types"
              onClick={terrainWindow.handlers.show}
            >
              <LocationCity />
            </Button>
          </Box>
        )}
        {metadataWindowOpen ? (
          <LocationPreviewList
            title='Location'
            rows={filteredMetadataRows}
            columns={filteredMetadataColumns}
            loading={metadataLoading}
            loadingText={translations.mapPreview?.metadataLoading ?? 'Loading metadata...'}
            emptyText={translations.mapPreview?.metadataEmpty ?? 'No metadata available yet.'}
            errorText={metadataError}
            selectedRows={selectedMetadataIds}
            onSelectionChange={handleMetadataSelectionChange}
            recyclingState={recyclingState}
            onToggleRecycling={handleToggleRecycling}
            onClose={() => setMetadataWindowOpen(false)}
          />
        ) : (
          <Box position="absolute" top={8} left={8} zIndex={3}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              aria-label="Show list"
              onClick={() => setMetadataWindowOpen(true)}
            >
              <LocationOn />
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};
