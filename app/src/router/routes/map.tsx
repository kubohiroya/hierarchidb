/**
 * @file map.tsx
 * @description Folder map preview route with URL-synchronized position (z,x,y parameters)
 *
 * URL Format: ?zxy=10,0,0 where:
 * - First value is zoom level
 * - Second value is longitude
 * - Third value is latitude
 *
 * Features:
 * - Initialize map from URL parameters
 * - Use persisted TreeNode map.zxy when available
 * - Fallback to geolocation (zoom=1) when zxy is missing
 * - Aggregate basemap/shape/location/route/styler layers under the folder
 */

import type {
  FeatureStateEntry,
  FeatureStateRecord,
  MapFeatureIdentifyResult,
  MapLibreFilter,
  MapLibreGeoJSONFeature,
  MapLibreMapInstance,
  MapLibreMapMouseEvent,
  MapLibreStyle,
  MapViewState,
  ResourceGeoJsonLayer,
  ResourceVectorLayer,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  DEFAULT_MAP_CONFIG,
  ResourceLayerMap,
  defaultFeatureIdAccessor,
  resolveIdentifyCandidates,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  Box,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  DirectionsBoat as DirectionsBoatIcon,
  DirectionsCar as DirectionsCarIcon,
  Flight as FlightIcon,
  FlightTakeoff as FlightTakeoffIcon,
  ForkRight as ForkRightIcon,
  LocationCity as LocationCityIcon,
  Speed as SpeedIcon,
  Tune as TuneIcon,
  Train as TrainIcon,
} from '@mui/icons-material';
import { useLoaderData, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import useGeolocation from 'react-hook-geolocation';
import { ensureWorkerAPI } from '@hierarchidb/ui-worker-client';
import { MaplibreExportControl } from '@watergis/maplibre-gl-export';
import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import { getDBName } from '@hierarchidb/util';
import { shapeDB } from '@hierarchidb/shape-plugin';
import { getEphemeralLocationDB, type LocationType } from '@hierarchidb/location-plugin';
import { ROUTE_MODES, type RouteMode } from '@hierarchidb/route-plugin';
import { TilesDB } from '@hierarchidb/gis-sdk';
import { MAPLIBRE_PROPERTY_METADATA } from '@hierarchidb/styler-plugin';
import {
  formatZxyParam,
  type MapViewState as LoaderMapViewState,
  parseZxyParam,
} from '../loaders/mapLoader.js';
import {
  mapHoverMatchAtom,
  mapSearchMatchesAtom,
  mapSearchTargetSelectionAtom,
  mapSearchTextAtom,
  mapSelectedMatchAtom,
  type MapHighlightEntry,
  type MapSearchTargetId,
} from '../../state/mapSearch.atoms.js';
import { ModelessDialogManager } from './modeless/ModelessDialogManager.js';
import type { MapInfoSummary, MapToggleOption, MapToggleSelection } from './modeless/modelessDialogContent.js';
import '@watergis/maplibre-gl-export/dist/maplibre-gl-export.css';

type MapSearch = {
  zxy?: string;
};

type BasemapStyleEntry = {
  nodeId: string;
  absolutePath?: string;
  style: string | MapLibreStyle;
  viewport?: MapViewState;
};

type LayerStyleOverrides = Partial<Record<'fill' | 'line' | 'circle' | 'symbol', Record<string, unknown>>>;
type FeatureStateBundle = { featureIdProperty: string; entries: FeatureStateEntry[] };

type MapStyle = {
  style: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';
  customStyleUrl?: string;
  customStyleConfig?: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isMapLibreStyle = (value: unknown): value is MapLibreStyle => {
  if (!isRecord(value)) return false;
  return Array.isArray(value.layers) && isRecord(value.sources);
};

const BUILT_IN_STYLE_URLS: Record<Exclude<MapStyle['style'], 'custom'>, string> = {
  streets: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  satellite: 'https://demotiles.maplibre.org/style.json',
  terrain: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};

const resolveMapStyleSource = (mapStyle?: MapStyle | null): string | MapLibreStyle | null => {
  if (!mapStyle?.style) return null;
  if (mapStyle.style === 'custom') {
    if (mapStyle.customStyleConfig) {
      if (isMapLibreStyle(mapStyle.customStyleConfig)) return mapStyle.customStyleConfig;
      return mapStyle.customStyleUrl ?? null;
    }
    return mapStyle.customStyleUrl ?? null;
  }
  return BUILT_IN_STYLE_URLS[mapStyle.style] ?? DEFAULT_MAP_CONFIG.mapStyleUrl;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const normalizeBasemapViewport = (viewport: unknown): MapViewState | null => {
  if (!isRecord(viewport)) return null;
  const { center, zoom, bearing, pitch } = viewport as {
    center?: unknown;
    zoom?: unknown;
    bearing?: unknown;
    pitch?: unknown;
  };

  if (!Array.isArray(center) || center.length !== 2) return null;
  const [longitude, latitude] = center;
  if (!isFiniteNumber(longitude) || !isFiniteNumber(latitude) || !isFiniteNumber(zoom)) return null;
  if (longitude < -180 || longitude > 180) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (zoom < 0 || zoom > 22) return null;

  return {
    longitude,
    latitude,
    zoom,
    bearing: isFiniteNumber(bearing) ? bearing : undefined,
    pitch: isFiniteNumber(pitch) ? pitch : undefined,
  };
};

const buildAbsolutePath = (nodeId: string, nodeById: Map<string, TreeNode>): string => {
  const chain: TreeNode[] = [];
  const visited = new Set<string>();
  let currentId = nodeId;
  while (currentId && !visited.has(currentId)) {
    const node = nodeById.get(currentId);
    if (!node) break;
    chain.unshift(node);
    visited.add(currentId);
    const parentId = node.parentId ? String(node.parentId) : '';
    if (!parentId) break;
    currentId = parentId;
  }
  const parts = chain.map((node) => node.metadata?.name ?? String(node.id));
  return `/${parts.join('/')}`;
};

const sortByPath = <T extends { absolutePath?: string; nodeId: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aKey = a.absolutePath ?? a.nodeId;
    const bKey = b.absolutePath ?? b.nodeId;
    return aKey.localeCompare(bKey);
  });

const sortByLayerPath = <T extends { absolutePath?: string; layerId: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aKey = a.absolutePath ?? a.layerId;
    const bKey = b.absolutePath ?? b.layerId;
    return aKey.localeCompare(bKey);
  });

type RouteModeOption = MapToggleOption & { modes: RouteMode[] };

const LOCATION_TYPE_OPTIONS = [
  { id: 'area_centroid' as LocationType, label: 'Admin Center', icon: <LocationCityIcon fontSize="small" /> },
  { id: 'airport' as LocationType, label: 'Airport', icon: <FlightTakeoffIcon fontSize="small" /> },
  { id: 'port' as LocationType, label: 'Port', icon: <DirectionsBoatIcon fontSize="small" /> },
  { id: 'railway_station' as LocationType, label: 'Station', icon: <TrainIcon fontSize="small" /> },
  { id: 'interchange' as LocationType, label: 'Interchange', icon: <ForkRightIcon fontSize="small" /> },
] satisfies MapToggleOption[];

const ROUTE_MODE_OPTIONS = [
  { id: ROUTE_MODES.AIRWAY, label: 'Air', icon: <FlightIcon fontSize="small" />, modes: [ROUTE_MODES.AIRWAY] },
  { id: ROUTE_MODES.WATERWAY, label: 'Sea', icon: <DirectionsBoatIcon fontSize="small" />, modes: [ROUTE_MODES.WATERWAY] },
  { id: ROUTE_MODES.RAILWAY, label: 'Rail', icon: <TrainIcon fontSize="small" />, modes: [ROUTE_MODES.RAILWAY] },
  {
    id: ROUTE_MODES.H_RAILWAY,
    label: 'High-speed Rail',
    icon: <SpeedIcon fontSize="small" />,
    modes: [ROUTE_MODES.H_RAILWAY],
  },
  {
    id: ROUTE_MODES.ROAD,
    label: 'Road',
    icon: <DirectionsCarIcon fontSize="small" />,
    modes: [ROUTE_MODES.ROAD, ROUTE_MODES.HIGHWAY],
  },
] satisfies RouteModeOption[];

const buildPropertyExpression = (keys: string[]) =>
  keys.length === 1 ? ['get', keys[0]] : ['coalesce', ...keys.map((key) => ['get', key])];

const buildCategoryFilter = (
  enabledValues: string[],
  knownValues: string[],
  propertyKeys: string[],
): MapLibreFilter | null => {
  if (enabledValues.length === 0) return null;
  if (enabledValues.length === knownValues.length) return null;
  const propertyExpr = buildPropertyExpression(propertyKeys);
  return [
    'any',
    ['!', ['in', propertyExpr, ['literal', knownValues]]],
    ['in', propertyExpr, ['literal', enabledValues]],
  ] as MapLibreFilter;
};

const mergeFilters = (base?: MapLibreFilter, next?: MapLibreFilter | null): MapLibreFilter | undefined => {
  if (!base) return next ?? undefined;
  if (!next) return base;
  return ['all', base, next] as MapLibreFilter;
};

let routeTilesDbPromise: Promise<TilesDB> | null = null;
const getRouteTilesDb = async (): Promise<TilesDB> => {
  if (!routeTilesDbPromise) {
    routeTilesDbPromise = TilesDB.getSingleton();
  }
  return routeTilesDbPromise;
};

const withLayerOrder = (
  kind: 'shape' | 'route' | 'location',
  absolutePath: string | undefined,
  fallbackId: string,
): string => {
  const prefix = kind === 'shape' ? '1' : kind === 'route' ? '2' : '3';
  const key = absolutePath ?? fallbackId;
  return `${prefix}/${key}`;
};

const SEARCH_TARGET_DEFINITIONS: Record<MapSearchTargetId, { label: string; group: 'point' | 'route' | 'shape'; keys: string[] }> = {
  pointName: { label: '名前', group: 'point', keys: ['name', 'NAME', 'label'] },
  pointAirportCode: {
    label: '空港コード',
    group: 'point',
    keys: ['airportCode', 'iataCode', 'icaoCode', 'iata', 'icao', 'ident', 'metadata.airportCode', 'metadata.iataCode', 'metadata.icaoCode'],
  },
  pointPortCode: {
    label: '港コード',
    group: 'point',
    keys: ['portCode', 'unlocode', 'locode', 'metadata.portCode', 'metadata.unlocode'],
  },
  pointStationCode: {
    label: '駅コード',
    group: 'point',
    keys: ['stationCode', 'station_code', 'metadata.stationCode', 'metadata.station_code'],
  },
  routeName: { label: '名前', group: 'route', keys: ['name', 'routeName', 'route_name'] },
  shapeRegionName: {
    label: '地域名',
    group: 'shape',
    keys: ['adminName', 'name', 'NAME', 'name_en', 'NAME_EN', 'shapeName', 'NAME_1', 'NAME_2', 'NAME_3', 'NAME_4', 'NAME_5'],
  },
  shapeCountryName: {
    label: '国名',
    group: 'shape',
    keys: ['countryName', 'country', 'COUNTRY', 'COUNTRY_NAME', 'NAME_0', 'ADMIN', 'SOVEREIGNT'],
  },
  shapeRegionCode: {
    label: '地域コード',
    group: 'shape',
    keys: ['adminCode', 'ADM1_CODE', 'ADM2_CODE', 'GID_1', 'GID_2', 'GID_3', 'shapeID', 'code'],
  },
  shapeCountryCode: {
    label: '国コード',
    group: 'shape',
    keys: ['countryCode', 'ISO_A2', 'ISO2', 'ISO_2', 'ISO_A3', 'ADM0_A3', 'ISO3', 'shapeISO'],
  },
};

const SEARCH_TARGET_GROUPS: Array<{ title: string; targetIds: MapSearchTargetId[] }> = [
  {
    title: '地点 (point)',
    targetIds: ['pointName', 'pointAirportCode', 'pointPortCode', 'pointStationCode'],
  },
  {
    title: '経路 (lineString)',
    targetIds: ['routeName'],
  },
  {
    title: 'シェイプ (multiPolygon)',
    targetIds: ['shapeRegionName', 'shapeCountryName', 'shapeRegionCode', 'shapeCountryCode'],
  },
];

const POINT_TARGETS = SEARCH_TARGET_GROUPS[0]?.targetIds ?? [];
const ROUTE_TARGETS = SEARCH_TARGET_GROUPS[1]?.targetIds ?? [];
const SHAPE_TARGETS = SEARCH_TARGET_GROUPS[2]?.targetIds ?? [];

const normalizeSearchValue = (value: string) => value.trim().toLowerCase();

const coerceString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const getNestedValue = (source: Record<string, unknown>, keyPath: string): unknown => {
  const parts = keyPath.split('.');
  let current: unknown = source;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

const collectSearchValues = (properties: Record<string, unknown>, keys: string[]): string[] => {
  const values = new Set<string>();
  keys.forEach((keyPath) => {
    const raw = getNestedValue(properties, keyPath);
    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        const next = coerceString(item);
        if (next) values.add(next);
      });
      return;
    }
    const next = coerceString(raw);
    if (next) values.add(next);
  });
  return Array.from(values);
};

const getTargetsForLayerType = (layerType?: string): MapSearchTargetId[] => {
  if (layerType === 'circle') return POINT_TARGETS;
  if (layerType === 'line') return ROUTE_TARGETS;
  if (layerType === 'fill') return SHAPE_TARGETS;
  return [...POINT_TARGETS, ...ROUTE_TARGETS, ...SHAPE_TARGETS];
};

export default function MapPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { nodeId } = useParams({ from: '/map/$nodeId' });
  const search = useSearch({ from: '/map/$nodeId' }) as MapSearch;
  const loaderViewState = useLoaderData({ from: '/map/$nodeId' }) as LoaderMapViewState;
  const geolocation = useGeolocation();
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const [searchText, setSearchText] = useAtom(mapSearchTextAtom);
  const [searchTargets, setSearchTargets] = useAtom(mapSearchTargetSelectionAtom);
  const [searchMatches, setSearchMatches] = useAtom(mapSearchMatchesAtom);
  const [hoverMatch, setHoverMatch] = useAtom(mapHoverMatchAtom);
  const [selectedMatch, setSelectedMatch] = useAtom(mapSelectedMatchAtom);
  const [searchSettingsOpen, setSearchSettingsOpen] = useState(false);
  const [initialViewState, setInitialViewState] = useState<MapViewState>(() => ({
    longitude: loaderViewState.longitude,
    latitude: loaderViewState.latitude,
    zoom: loaderViewState.zoom,
  }));
  const [basemapStyles, setBasemapStyles] = useState<BasemapStyleEntry[]>([]);
  const [vectorLayers, setVectorLayers] = useState<ResourceVectorLayer[]>([]);
  const [geoJsonLayers, setGeoJsonLayers] = useState<ResourceGeoJsonLayer[]>([]);
  const [styleOverridesByType, setStyleOverridesByType] = useState<LayerStyleOverrides>({});
  const [locationTypeSelection, setLocationTypeSelection] = useState<MapToggleSelection>(() =>
    Object.fromEntries(LOCATION_TYPE_OPTIONS.map((option) => [option.id, true])) as MapToggleSelection
  );
  const [routeModeSelection, setRouteModeSelection] = useState<MapToggleSelection>(() =>
    Object.fromEntries(ROUTE_MODE_OPTIONS.map((option) => [option.id, true])) as MapToggleSelection
  );
  const [mapInfo, setMapInfo] = useState<MapInfoSummary>({});
  const appliedSearchMatchesRef = useRef<MapHighlightEntry[]>([]);
  const appliedHoverRef = useRef<MapHighlightEntry | null>(null);
  const appliedSelectedRef = useRef<MapHighlightEntry | null>(null);
  const routeModeOptions = useMemo(
    () => ROUTE_MODE_OPTIONS.map(({ id, label, icon }) => ({ id, label, icon })),
    [],
  );
  const preferredInitialViewAppliedRef = useRef(false);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastUpdateRef = useRef<string>('');
  const mapInstanceRef = useRef<MapLibreMapInstance | null>(null);
  const exportControlRef = useRef<MaplibreExportControl | null>(null);

  useEffect(() => {
    setInitialViewState({
      longitude: loaderViewState.longitude,
      latitude: loaderViewState.latitude,
      zoom: loaderViewState.zoom,
    });
    lastUpdateRef.current = formatZxyParam(loaderViewState);
  }, [loaderViewState]);

  useEffect(() => {
    if (!nodeId) return;
    let cancelled = false;

    const loadFolderLayers = async () => {
      try {
        const api = await ensureWorkerAPI();
        const query = await api.getQueryAPI();
        const rootNode = (await query.getNode(nodeId as NodeId)) as TreeNode | null;
        const ancestors = (await query.listAncestors(nodeId as NodeId)) as TreeNode[];
        const descendants = (await query.listDescendants(nodeId as NodeId)) as TreeNode[];
        if (!rootNode || cancelled) return;

        const nodeById = new Map<string, TreeNode>();
        [...ancestors, rootNode, ...descendants].forEach((node) => {
          nodeById.set(String(node.id), node);
        });
        const visibleDescendants = descendants.filter((node) => node.invisible !== true);

        setMapInfo({
          name: rootNode.metadata?.name ?? '',
          description: rootNode.metadata?.description ?? '',
          tags: rootNode.metadata?.tags ?? [],
          createdAt: rootNode.createdAt,
          updatedAt: rootNode.updatedAt,
          path: buildAbsolutePath(String(rootNode.id), nodeById),
        });

        let persistedViewState: LoaderMapViewState | null = null;
        if (!search?.zxy) {
          const persisted =
            rootNode.map?.zxy ??
            (isRecord(rootNode.data) ? (rootNode.data as { map?: { zxy?: string } }).map?.zxy : undefined);
          const parsed = persisted ? parseZxyParam(persisted) : null;
          if (parsed) {
            persistedViewState = parsed;
          }
        }

        const basemapEntries: BasemapStyleEntry[] = [];
        const shapeEntries: ResourceVectorLayer[] = [];
        const routeEntries: ResourceVectorLayer[] = [];
        const locationEntries: ResourceVectorLayer[] = [];
        const geoJsonEntries: ResourceGeoJsonLayer[] = [];
        const styleOverrides: LayerStyleOverrides = {};
        const featureStateByStyleType: Partial<Record<'choropleth' | 'points' | 'lines', FeatureStateBundle>> = {};

        const stylerNodes = visibleDescendants.filter((node) => node.nodeType === 'styler');
        const sortedStylers = sortByPath(
          stylerNodes.map((node) => ({
            nodeId: String(node.id),
            absolutePath: buildAbsolutePath(String(node.id), nodeById),
            node,
          }))
        );

        sortedStylers.forEach(({ node }) => {
          const data = node.data as {
            generatedStyle?: { maplibreStyleSpec?: MapLibreStyle | Record<string, unknown> };
            mapping?: {
              styleType?: 'choropleth' | 'points' | 'lines';
              featureIdProperty?: string;
              valueType?: 'number' | 'color';
              targetProperty?: keyof typeof MAPLIBRE_PROPERTY_METADATA;
            };
            styleKeyValues?: {
              colors?: Array<{ key: string; color: string }>;
              scalars?: Array<{ key: string; scalarValue: number }>;
            };
          } | null;
          const spec = isMapLibreStyle(data?.generatedStyle?.maplibreStyleSpec)
            ? data?.generatedStyle?.maplibreStyleSpec
            : undefined;
          const layers = spec?.layers ?? [];
          layers.forEach((layer) => {
            const type = layer.type as keyof LayerStyleOverrides | undefined;
            if (!type || !layer.paint) return;
            styleOverrides[type] = { ...(styleOverrides[type] ?? {}), ...(layer.paint ?? {}) };
          });

          const styleType = data?.mapping?.styleType;
          const featureIdProperty = data?.mapping?.featureIdProperty;
          if (!styleType || !featureIdProperty) return;

          const targetProperty = data?.mapping?.targetProperty;
          const targetMeta = targetProperty ? MAPLIBRE_PROPERTY_METADATA[targetProperty] : null;
          const valueType = data?.mapping?.valueType ?? targetMeta?.type ?? 'color';
          const entries: FeatureStateEntry[] = [];
          if (valueType === 'number') {
            (data?.styleKeyValues?.scalars ?? []).forEach((item) => {
                  entries.push({
                    id: item.key,
                    state: { value: item.scalarValue } as FeatureStateRecord,
                  });
                });
            } else {
              (data?.styleKeyValues?.colors ?? []).forEach((item) => {
                entries.push({
                  id: item.key,
                  state: { value: item.color } as FeatureStateRecord,
                });
              });
            }

          if (entries.length > 0) {
            featureStateByStyleType[styleType] = { featureIdProperty, entries };
          }
        });

        visibleDescendants.forEach((node) => {
          const absolutePath = buildAbsolutePath(String(node.id), nodeById);
          if (node.nodeType === 'basemap') {
            const data = node.data as { mapStyle?: MapStyle; viewport?: unknown } | null;
            const styleSource = resolveMapStyleSource(data?.mapStyle ?? null);
            if (styleSource) {
              const viewport = normalizeBasemapViewport(data?.viewport);
              basemapEntries.push({
                nodeId: String(node.id),
                absolutePath,
                style: styleSource,
                viewport: viewport ?? undefined,
              });
            }
          }

          if (node.nodeType === 'shape') {
            const featureState = featureStateByStyleType.choropleth;
            const layerId = `resource-layer-${node.id}`;
            const sourceId = `resource-source-${node.id}`;
            shapeEntries.push({
              nodeId: String(node.id),
              nodeType: 'shape',
              absolutePath: withLayerOrder('shape', absolutePath, String(node.id)),
              dbName: getDBName('shape'),
              tileDataProvider: async (z, x, y, tileNodeId) => {
                if (!tileNodeId) return null;
                const record = await shapeDB.getVectorTile(tileNodeId as NodeId, z, x, y);
                return record?.data_Uint8Array?.buffer ?? null;
              },
              layerConfig: {
                layerType: 'fill',
                sourceLayer: 'default',
                layerId,
                sourceId,
              },
              promoteId: featureState?.featureIdProperty,
              featureState: featureState?.entries,
            });
          }

          if (node.nodeType === 'location') {
            const data = node.data as { batchSessionId?: string; features?: Array<{ position?: { lat?: number; lon?: number } }> } | null;
            const sessionId = data?.batchSessionId;
            if (sessionId) {
              const featureState = featureStateByStyleType.points;
              const layerId = `resource-layer-${node.id}`;
              const sourceId = `resource-source-${node.id}`;
              locationEntries.push({
                nodeId: String(node.id),
                nodeType: 'location',
                absolutePath: withLayerOrder('location', absolutePath, String(node.id)),
                dbName: getDBName('location-ephemeral'),
                tileDataProvider: async (z, x, y) => {
                  const db = getEphemeralLocationDB();
                  const rec = await db.vectorTiles.get(`loc-mvt-${sessionId}-${z}-${x}-${y}`);
                  return rec?.data ?? null;
                },
                layerConfig: {
                  layerType: 'circle',
                  sourceLayer: 'location_points',
                  layerId,
                  sourceId,
                  paint: {
                    'circle-radius': 4,
                    'circle-color': '#2f74ff',
                    'circle-opacity': 0.8,
                    ...(styleOverrides.circle ?? {}),
                  },
                },
                promoteId: featureState?.featureIdProperty,
                featureState: featureState?.entries,
              });
            }
          }

          if (node.nodeType === 'route') {
            const data = node.data as { batchSessionId?: string } | null;
            const sessionId = data?.batchSessionId;
            if (sessionId) {
              const featureState = featureStateByStyleType.lines;
              const layerId = `resource-layer-${node.id}`;
              const sourceId = `resource-source-${node.id}`;
              routeEntries.push({
                nodeId: String(node.id),
                nodeType: 'route',
                absolutePath: withLayerOrder('route', absolutePath, String(node.id)),
                dbName: getDBName('stage-tiles-db'),
                tileDataProvider: async (z, x, y) => {
                  const db = await getRouteTilesDb();
                  const record = await db.tiles
                    .where('[sessionId+z+x+y]')
                    .equals([sessionId, z, x, y])
                    .first();
                  return record?.data ?? null;
                },
                layerConfig: {
                  layerType: 'line',
                  sourceLayer: 'layer0',
                  layerId,
                  sourceId,
                  paint: {
                    'line-color': '#f24c3d',
                    'line-width': 2,
                    'line-opacity': 0.9,
                    ...(styleOverrides.line ?? {}),
                  },
                },
                promoteId: featureState?.featureIdProperty,
                featureState: featureState?.entries,
              });
            }
          }
        });

        const sortedBasemaps = sortByPath(basemapEntries);

        if (!search?.zxy && !preferredInitialViewAppliedRef.current) {
          const basemapViewport = sortedBasemaps.find((entry) => entry.viewport)?.viewport ?? null;
          const targetViewState = basemapViewport ?? persistedViewState;
          if (targetViewState) {
            preferredInitialViewAppliedRef.current = true;
            setInitialViewState(targetViewState);
            const formatted = formatZxyParam(targetViewState);
            lastUpdateRef.current = formatted;
            navigate({
              to: '/map/$nodeId',
              params: { nodeId },
              search: (prev: MapSearch = {}) => ({ ...prev, zxy: formatted }),
              replace: true,
            });
          }
        }

        if (!cancelled) {
          setBasemapStyles(sortedBasemaps);
          setVectorLayers([
            ...sortByPath(shapeEntries),
            ...sortByPath(routeEntries),
            ...sortByPath(locationEntries),
          ]);
          setGeoJsonLayers(sortByLayerPath(geoJsonEntries));
          setStyleOverridesByType(styleOverrides);
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('[MapPage] Failed to load folder layers', error);
        setBasemapStyles([]);
        setVectorLayers([]);
        setGeoJsonLayers([]);
        setStyleOverridesByType({});
      }
    };

    void loadFolderLayers();
    return () => {
      cancelled = true;
    };
  }, [navigate, nodeId, search?.zxy]);

  useEffect(() => {
    if (!search?.zxy && !preferredInitialViewAppliedRef.current && geolocation.latitude && geolocation.longitude && !geolocation.error) {
      setInitialViewState({
        longitude: geolocation.longitude,
        latitude: geolocation.latitude,
        zoom: 1,
      });
    }
  }, [geolocation.latitude, geolocation.longitude, geolocation.error, search?.zxy]);

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

  const handleViewStateChange = useCallback(
    (viewState: MapViewState) => {
      if (!nodeId) return;
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(() => {
        const newZxy = formatZxyParam(viewState);
        if (newZxy !== lastUpdateRef.current) {
          lastUpdateRef.current = newZxy;
          navigate({
            to: '/map/$nodeId',
            params: { nodeId },
            search: (prev: MapSearch = {}) => ({ ...prev, zxy: newZxy }),
            replace: true,
          });
        }
      }, 500);
    },
    [navigate, nodeId]
  );

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
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

  const formattedZxy = formatZxyParam(initialViewState);
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

  const highlightLayerIds = useMemo(
    () => vectorLayers.map((layer) => layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`),
    [vectorLayers],
  );

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
          hasSearch,
          1.2,
          hasHover,
          0.7,
          hasSelected,
          0.4,
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
          hasSearch,
          0.6,
          hasHover,
          0.35,
          hasSelected,
          0.2,
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
    } satisfies LayerStyleOverrides;
  }, [styleOverridesByType, theme.palette.primary.main]);

  const buildHighlightEntry = useCallback((feature?: MapLibreGeoJSONFeature | null): MapHighlightEntry | null => {
    if (!feature) return null;
    const id = defaultFeatureIdAccessor(feature);
    const source = typeof feature.source === 'string' ? feature.source : undefined;
    if (id === undefined || id === null || !source) return null;
    return { source, id };
  },[]);

  const clearHighlightKey = useCallback(
    (entry: MapHighlightEntry | null, key: 'hdbSearch' | 'hdbHover' | 'hdbSelected') => {
      if (!mapInstance || !entry) return;
      try {
        mapInstance.removeFeatureState({ source: entry.source, id: entry.id, key });
      } catch (error) {
        console.debug('[MapPage] Failed to clear feature-state', error);
      }
    },
    [mapInstance],
  );

  const applyHighlightKey = useCallback(
    (entry: MapHighlightEntry | null, key: 'hdbSearch' | 'hdbHover' | 'hdbSelected') => {
      if (!mapInstance || !entry) return;
      try {
        mapInstance.setFeatureState({ source: entry.source, id: entry.id }, { [key]: true });
      } catch (error) {
        console.debug('[MapPage] Failed to set feature-state', error);
      }
    },
    [mapInstance],
  );

  const setSingleHighlight = useCallback(
    (
      ref: MutableRefObject<MapHighlightEntry | null>,
      key: 'hdbHover' | 'hdbSelected',
      next: MapHighlightEntry | null,
    ) => {
      const current = ref.current;
      if (current && (!next || current.source !== next.source || current.id !== next.id)) {
        clearHighlightKey(current, key);
      }
      if (next) {
        applyHighlightKey(next, key);
      }
      ref.current = next;
    },
    [applyHighlightKey, clearHighlightKey],
  );

  const clearSearchHighlights = useCallback(() => {
    setSearchMatches([]);
  }, [setSearchMatches]);

  const handleSearchClear = useCallback(() => {
    setSearchText('');
    clearSearchHighlights();
  }, [clearSearchHighlights, setSearchText]);

  const handleSearchTargetToggle = useCallback(
    (targetId: MapSearchTargetId) => {
      setSearchTargets((prev) => ({ ...prev, [targetId]: !prev[targetId] }));
    },
    [setSearchTargets],
  );

  const runSearch = useCallback(() => {
    if (!mapInstance) return;
    const query = normalizeSearchValue(searchText);
    if (!query) {
      clearSearchHighlights();
      return;
    }

    const canvas = mapInstance.getCanvas();
    const features = mapInstance.queryRenderedFeatures(
      [
        [0, 0],
        [canvas.width, canvas.height],
      ],
      { layers: highlightLayerIds },
    ) as MapLibreGeoJSONFeature[];

    const matchedEntries = new Map<string, MapHighlightEntry>();
    for (const feature of features) {
      const properties = (feature?.properties ?? {}) as Record<string, unknown>;
      const layerType = feature.layer?.type;
      const targetIds = getTargetsForLayerType(layerType);
      let matched = false;
      for (const targetId of targetIds) {
        if (!searchTargets[targetId]) continue;
        const targetKeys = SEARCH_TARGET_DEFINITIONS[targetId].keys;
        const values = collectSearchValues(properties, targetKeys);
        if (values.some((value) => normalizeSearchValue(value).startsWith(query))) {
          matched = true;
          break;
        }
      }
      if (!matched) continue;
      const entry = buildHighlightEntry(feature);
      if (!entry) continue;
      matchedEntries.set(`${entry.source}:${entry.id}`, entry);
    }

    setSearchMatches(Array.from(matchedEntries.values()));
  }, [buildHighlightEntry, clearSearchHighlights, highlightLayerIds, mapInstance, searchTargets, searchText, setSearchMatches]);

  const handleIdentify = useCallback(
    (result: MapFeatureIdentifyResult) => {
      const entry = buildHighlightEntry(result.features[0]);
      setSelectedMatch(entry);
    },
    [buildHighlightEntry, setSelectedMatch],
  );

  useEffect(() => {
    if (!mapInstance) return undefined;
    const handleMouseMove = (event: MapLibreMapMouseEvent) => {
      const result = resolveIdentifyCandidates(mapInstance, event, {
        layerIds: highlightLayerIds,
        radius: 6,
        getFeatureId: defaultFeatureIdAccessor,
      });
      const entry = buildHighlightEntry(result.features[0]);
      setHoverMatch(entry);
    };

    const handleMouseLeave = () => {
      setHoverMatch(null);
    };

    const canvas = mapInstance.getCanvas();
    mapInstance.on('mousemove', handleMouseMove as (...args: unknown[]) => void);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      mapInstance.off('mousemove', handleMouseMove as (...args: unknown[]) => void);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [buildHighlightEntry, highlightLayerIds, mapInstance, setHoverMatch]);

  useEffect(() => {
    if (!mapInstance) return;
    appliedSearchMatchesRef.current.forEach((entry) => {clearHighlightKey(entry, 'hdbSearch')});
    searchMatches.forEach((entry) => {applyHighlightKey(entry, 'hdbSearch')});
    appliedSearchMatchesRef.current = searchMatches;
  }, [applyHighlightKey, clearHighlightKey, mapInstance, searchMatches]);

  useEffect(() => {
    if (!mapInstance) return;
    setSingleHighlight(appliedHoverRef, 'hdbHover', hoverMatch);
  }, [hoverMatch, mapInstance, setSingleHighlight]);

  useEffect(() => {
    if (!mapInstance) return;
    setSingleHighlight(appliedSelectedRef, 'hdbSelected', selectedMatch);
  }, [mapInstance, selectedMatch, setSingleHighlight]);

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

      <Paper
        elevation={4}
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 200,
          width: 360,
          p: 1,
          pointerEvents: 'auto',
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="検索..."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              runSearch();
            }
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Clear search"
                  size="small"
                  onClick={handleSearchClear}
                  disabled={!searchText.trim()}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
                <IconButton
                  aria-label="Search settings"
                  size="small"
                  onClick={() => setSearchSettingsOpen(true)}
                >
                  <TuneIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <Dialog
        open={searchSettingsOpen}
        onClose={() => setSearchSettingsOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>検索対象</DialogTitle>
        <DialogContent dividers>
          {SEARCH_TARGET_GROUPS.map((group) => (
            <Paper key={group.title} variant="outlined" sx={{ p: 1.5, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {group.title}
              </Typography>
              <FormGroup>
                {group.targetIds.map((targetId) => (
                  <FormControlLabel
                    key={targetId}
                    control={(
                      <Checkbox
                        checked={Boolean(searchTargets[targetId])}
                        onChange={() => handleSearchTargetToggle(targetId)}
                      />
                    )}
                    label={SEARCH_TARGET_DEFINITIONS[targetId].label}
                  />
                ))}
              </FormGroup>
            </Paper>
          ))}
        </DialogContent>
      </Dialog>

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
