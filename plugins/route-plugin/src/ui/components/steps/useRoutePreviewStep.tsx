import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import {
  buildCategoryFilter,
  buildRoutePreviewRows,
  DEFAULT_MAP_CONFIG,
  type ResourceVectorLayer,
  useVectorTilePreviewSearch,
  type MapAttributionItem,
  type MapLibreMapInstance,
  type MapToggleSelection,
  type MapViewState,
} from '@hierarchidb/ui-map';
import {
  DirectionsBoat as DirectionsBoatIcon,
  DirectionsCar as DirectionsCarIcon,
  Flight as FlightIcon,
  Speed as SpeedIcon,
  Train as TrainIcon,
} from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/core-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import type { RouteLineString, RouteNearestLineResponse, RouteUpdaterPayload } from '@hierarchidb/route-api';
import { formatDistance, getTransportModeName, useTranslation } from '../../../common/i18n/index.js';
import { ROUTE_MODES, type RouteMode } from '@hierarchidb/route-api';
import { ROUTE_DATA_SOURCES } from '../../../common/datasource/configs.js';
import { getDBName } from '@hierarchidb/util';
import { buildRouteColorExpression, mergeRouteStyleConfig, resolveLineDashArray } from '../../../common/styles/routeStyle.js';

type Bounds = { minLon: number; maxLon: number; minLat: number; maxLat: number };
const HOVER_DISTANCE_PX = 16;

type RouteModeOption = {
  id: RouteMode;
  label: string;
  icon: React.ReactNode;
  modes: RouteMode[];
};

const ROUTE_MODE_OPTIONS: RouteModeOption[] = [
  { id: ROUTE_MODES.AIRWAY, label: 'Air', icon: <FlightIcon fontSize="small" />, modes: [ROUTE_MODES.AIRWAY] },
  { id: ROUTE_MODES.WATERWAY, label: 'Sea', icon: <DirectionsBoatIcon fontSize="small" />, modes: [ROUTE_MODES.WATERWAY] },
  { id: ROUTE_MODES.RAILWAY, label: 'Rail', icon: <TrainIcon fontSize="small" />, modes: [ROUTE_MODES.RAILWAY] },
  { id: ROUTE_MODES.H_RAILWAY, label: 'High-speed Rail', icon: <SpeedIcon fontSize="small" />, modes: [ROUTE_MODES.H_RAILWAY] },
  { id: ROUTE_MODES.ROAD, label: 'Road', icon: <DirectionsCarIcon fontSize="small" />, modes: [ROUTE_MODES.ROAD, ROUTE_MODES.HIGHWAY] },
];

const resolveBoundsForLines = (lines: [number, number][][]): Bounds | null => {
  if (!lines.length) return null;
  const lngs: number[] = [];
  const lats: number[] = [];
  lines.forEach((line) => {
    line.forEach((point) => {
      lngs.push(point[0]);
      lats.push(point[1]);
    });
  });
  if (!lngs.length || !lats.length) return null;
  let minLon = Math.min(...lngs);
  let maxLon = Math.max(...lngs);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  if (minLon === maxLon) {
    minLon -= 0.5;
    maxLon += 0.5;
  }
  if (minLat === maxLat) {
    minLat -= 0.5;
    maxLat += 0.5;
  }
  return { minLon, maxLon, minLat, maxLat };
};

const normalizeCoordinate = (point: [number, number] | number[]): [number, number] | null => {
  if (!Array.isArray(point) || point.length < 2) return null;
  const lon = Number(point[0]);
  const lat = Number(point[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [lon, lat];
};

const normalizeLineCoordinates = (points: Array<[number, number] | number[]>): [number, number][] => {
  const coords: [number, number][] = [];
  for (const point of points) {
    const normalized = normalizeCoordinate(point);
    if (normalized) coords.push(normalized);
  }
  return coords;
};

const resolveMetersPerPixel = (latitude: number, zoom: number): number => {
  const worldCircumference = 40_075_016.686;
  const latFactor = Math.cos((latitude * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;
  return (worldCircumference * latFactor) / scale;
};

export const useRoutePreviewStep = ({
  draft,
  nodeId,
}: {
  draft: RouteUpdaterPayload;
  nodeId?: NodeId;
}) => {
  const { t, locale } = useTranslation();
  const previewNodeId = nodeId ?? draft.treeNodeId;
  const workerBridgeRef = useRef(getWorkerBridge());
  const [lineStrings, setLineStrings] = useState<RouteLineString[]>([]);
  const [lineStringsLoading, setLineStringsLoading] = useState(false);
  const [lineStringsError, setLineStringsError] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const [routeModeSelection, setRouteModeSelection] = useState<MapToggleSelection>(() =>
    Object.fromEntries(ROUTE_MODE_OPTIONS.map((option) => [option.id, true])) as MapToggleSelection
  );
  const [listSearch, setListSearch] = useState('');
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoverInfo, setHoverInfo] = useState<RouteNearestLineResponse | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);
  const hoverRequestIdRef = useRef(0);
  const lastHoverRef = useRef<{ longitude: number; latitude: number; zoom: number } | null>(null);
  const hasGeometry = lineStrings.length > 0;
  const showMissingGeometry = !lineStringsLoading && !hasGeometry && !lineStringsError;
  const lineGeometries = useMemo<[number, number][][]>(() => (
    lineStrings
      .map((line) => {
        if (Array.isArray(line.waypoints) && line.waypoints.length >= 2) {
          return normalizeLineCoordinates(line.waypoints);
        }
        return normalizeLineCoordinates([
          [line.startPoint.longitude, line.startPoint.latitude],
          [line.endPoint.longitude, line.endPoint.latitude],
        ]);
      })
      .filter((coords) => coords.length >= 2)
  ), [lineStrings]);
  const bounds = useMemo(() => resolveBoundsForLines(lineGeometries), [lineGeometries]);
  const dataSourceConfig = useMemo(() => {
    const name = draft.draftData?.dataSourceName;
    if (!name) return undefined;
    const normalized = name.toLowerCase();
    return ROUTE_DATA_SOURCES.find((source) => source.name.toLowerCase() === normalized);
  }, [draft.draftData?.dataSourceName]);
  const routeStyleConfig = useMemo(
    () => mergeRouteStyleConfig(draft.draftData?.routeStyleConfig),
    [draft.draftData?.routeStyleConfig],
  );
  const attributionItems = useMemo<MapAttributionItem[]>(() => {
    if (!dataSourceConfig) return [];
    return [{
      id: `route:${dataSourceConfig.name}`,
      label: dataSourceConfig.displayName ?? dataSourceConfig.name,
      attribution: dataSourceConfig.attribution,
      url: dataSourceConfig.website,
      license: dataSourceConfig.license,
      licenseUrl: dataSourceConfig.licenseUrl,
    }];
  }, [dataSourceConfig]);

  useEffect(() => {
    if (!previewNodeId) {
      setLineStrings([]);
      return;
    }
    let active = true;
    setLineStringsLoading(true);
    setLineStringsError(null);
    void (async () => {
      try {
        const api = await workerBridgeRef.current.getRouteQueryAPI();
        const rows = await api.listRouteLineStrings(previewNodeId);
        if (!active) return;
        setLineStrings(rows);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : String(error);
        setLineStringsError(message);
        setLineStrings([]);
      } finally {
        if (active) {
          setLineStringsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [previewNodeId]);

  const formatTemplate = useCallback(
    (template: string, values: Record<string, string | number>) =>
      Object.entries(values).reduce(
        (acc, [key, value]) => acc.replace(new RegExp(`{${key}}`, 'g'), String(value)),
        template,
      ),
    [],
  );

  const scheduleHoverLookup = useCallback((longitude: number, latitude: number, zoom: number) => {
    if (!previewNodeId) return;
    const last = lastHoverRef.current;
    if (last) {
      const lonDelta = Math.abs(last.longitude - longitude);
      const latDelta = Math.abs(last.latitude - latitude);
      if (last.zoom === zoom && lonDelta < 0.0001 && latDelta < 0.0001) {
        return;
      }
    }
    lastHoverRef.current = { longitude, latitude, zoom };
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => {
      const requestId = ++hoverRequestIdRef.current;
      void (async () => {
        try {
          const api = await workerBridgeRef.current.getRouteQueryAPI();
          const metersPerPixel = resolveMetersPerPixel(latitude, zoom);
          const result = await api.findNearestRouteLine({
            nodeId: previewNodeId,
            longitude,
            latitude,
            zoom,
            maxDistanceMeters: metersPerPixel * HOVER_DISTANCE_PX,
          });
          if (hoverRequestIdRef.current !== requestId) return;
          setHoverInfo(result);
          setHoverOpen(result.matches.length > 0);
        } catch (error) {
          if (hoverRequestIdRef.current === requestId) {
            setHoverInfo(null);
            setHoverOpen(false);
          }
          console.warn('[RoutePreviewStep] hover lookup failed', error);
        }
      })();
    }, 120);
  }, [previewNodeId]);

  useEffect(() => {
    if (!mapInstance) return;
    const handleMove = (event: unknown) => {
      const lngLat = (event as { lngLat?: { lng: number; lat: number } })?.lngLat;
      if (!lngLat) return;
      const zoom = mapInstance.getZoom();
      scheduleHoverLookup(lngLat.lng, lngLat.lat, zoom);
    };
    const handleLeave = () => {
      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      setHoverOpen(false);
    };
    mapInstance.on('mousemove', handleMove);
    mapInstance.on('mouseleave', handleLeave);
    return () => {
      mapInstance.off('mousemove', handleMove);
      mapInstance.off('mouseleave', handleLeave);
    };
  }, [mapInstance, scheduleHoverLookup]);

  const hoverMessage = useMemo(() => {
    const nearest = hoverInfo?.matches?.[0]?.line;
    if (!nearest) return '';
    const modeLabel = nearest.routeMode
      ? getTransportModeName(nearest.routeMode, locale)
      : t('preview.hoverUnknown', 'Unknown route');
    const startParts = [nearest.start?.name, nearest.start?.admin1Name, nearest.start?.admin0Name].filter(Boolean);
    const endParts = [nearest.end?.name, nearest.end?.admin1Name, nearest.end?.admin0Name].filter(Boolean);
    const startLabel = startParts.join(', ') || t('preview.hoverUnknown', 'Unknown route');
    const endLabel = endParts.join(', ') || t('preview.hoverUnknown', 'Unknown route');
    const distanceValue = nearest.routeDistanceMeters ?? hoverInfo?.matches?.[0]?.distanceMeters ?? 0;
    const distanceLabel = formatDistance(distanceValue, locale);
    const template = t('preview.hoverTemplate', '{mode} / {start} -> {end} / {distance}');
    return formatTemplate(template, {
      mode: modeLabel,
      start: startLabel,
      end: endLabel,
      distance: distanceLabel,
    });
  }, [formatTemplate, hoverInfo, locale, t]);

  useEffect(() => () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
  }, []);

  const routeModeValues = useMemo(
    () => Array.from(new Set(ROUTE_MODE_OPTIONS.flatMap((option) => option.modes))),
    [],
  );
  const enabledRouteModes = useMemo(
    () => ROUTE_MODE_OPTIONS.filter((option) => routeModeSelection[option.id]).flatMap((option) => option.modes),
    [routeModeSelection],
  );
  const routeFilter = useMemo(
    () => buildCategoryFilter(enabledRouteModes, routeModeValues, ['routeMode', 'mode', 'route_mode']),
    [enabledRouteModes, routeModeValues],
  );
  const initialViewState = useMemo<MapViewState>(() => {
    if (!bounds) return DEFAULT_MAP_CONFIG.viewState;
    const longitude = (bounds.minLon + bounds.maxLon) / 2;
    const latitude = (bounds.minLat + bounds.maxLat) / 2;
    return {
      longitude: Number.isFinite(longitude) ? longitude : DEFAULT_MAP_CONFIG.viewState.longitude,
      latitude: Number.isFinite(latitude) ? latitude : DEFAULT_MAP_CONFIG.viewState.latitude,
      zoom: DEFAULT_MAP_CONFIG.viewState.zoom,
    };
  }, [bounds]);
  const vectorLayers = useMemo<ResourceVectorLayer[]>(() => {
    if (!previewNodeId) return [];
    if (!hasGeometry) return [];
    return [
      {
        nodeId: String(previewNodeId),
        nodeType: 'route',
        dbName: getDBName('route'),
        tileDataProvider: async (z, x, y, nodeIdOverride) => {
          const api = await workerBridgeRef.current.getRouteQueryAPI();
          const targetId = (nodeIdOverride ?? previewNodeId) as NodeId;
          return api.getVectorTile(targetId, z, x, y);
        },
        promoteId: 'id',
        layerConfig: {
          layerType: 'line',
          sourceLayer: 'layer0',
          paint: {
            'line-color': buildRouteColorExpression(routeStyleConfig),
            'line-width': routeStyleConfig.lineWidth,
            'line-opacity': 0.9,
            ...(resolveLineDashArray(routeStyleConfig.lineStyle)
              ? { 'line-dasharray': resolveLineDashArray(routeStyleConfig.lineStyle) }
              : {}),
          },
          filter: routeFilter,
        },
        layerLabel: t('preview.vectorLayerLabel', 'Routes'),
      },
    ];
  }, [hasGeometry, previewNodeId, routeFilter, routeStyleConfig, t]);
  const handleRouteModeToggle = useCallback((id: string) => {
    setRouteModeSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const listRows = useMemo(
    () => (hasGeometry ? buildRoutePreviewRows(lineGeometries) : []),
    [hasGeometry, lineGeometries],
  );
  const getRowId = useCallback((row: (typeof listRows)[number]) => String(row.id), []);
  const buildSearchText = useCallback((row: (typeof listRows)[number]) => ([
    row.id,
    row.startLon,
    row.startLat,
    row.endLon,
    row.endLat,
    row.distanceMeters,
    row.vertexCount,
  ].filter((value) => value != null).join(' ')), []);

  useVectorTilePreviewSearch(
    hasGeometry,
    listRows,
    listSearch,
    getRowId,
    buildSearchText,
    setMatchedIds,
  );
  const matchedIdSet = useMemo(() => new Set(matchedIds), [matchedIds]);
  const emptyErrorSummary = useMemo(() => new Map(), []);

  const hoverSnackbar = (
    <Snackbar
      open={hoverOpen && Boolean(hoverMessage)}
      message={hoverMessage}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      autoHideDuration={2000}
    />
  );

  const emptyContent = listRows.length === 0 ? (
    <Alert severity="info" sx={{ m: 2 }}>
      {t('preview.list.empty', 'No route lines are available yet.')}
    </Alert>
  ) : undefined;

  return {
    t,
    mapInstance,
    setMapInstance,
    attributionItems,
    initialViewState,
    vectorLayers,
    hoverSnackbar,
    showMissingGeometry,
    lineStringsError,
    lineStringsLoading,
    hasGeometry,
    routeModeOptions: ROUTE_MODE_OPTIONS,
    routeModeSelection,
    handleRouteModeToggle,
    listRows,
    listSearch,
    setListSearch,
    matchedIdSet,
    selectedIds,
    setSelectedIds,
    emptyErrorSummary,
    emptyContent,
    columnLabels: {
      lineId: t('preview.list.columns.lineId', 'Line Id'),
      startLon: t('preview.list.columns.startLon', 'Start Lon'),
      startLat: t('preview.list.columns.startLat', 'Start Lat'),
      endLon: t('preview.list.columns.endLon', 'End Lon'),
      endLat: t('preview.list.columns.endLat', 'End Lat'),
      distanceMeters: t('preview.list.columns.distanceMeters', 'Distance (m)'),
      vertexCount: t('preview.list.columns.vertexCount', 'Vertices'),
    },
    countLabels: {
      matched: t('preview.list.matched', 'Matched'),
      rows: t('preview.list.rows', 'Rows'),
    },
    searchLabels: {
      placeholder: t('preview.list.searchPlaceholder', 'Search routes'),
      ariaLabel: t('preview.list.searchAriaLabel', 'Search routes'),
    },
    statusLabels: {
      failed: t('preview.list.status.failed', 'Failed'),
      completed: t('preview.list.status.completed', 'Completed'),
    },
    errorColumnLabels: {
      status: t('preview.list.columns.status', 'Status'),
      errorCount: t('preview.list.columns.errorCount', 'Errors'),
      errorMessage: t('preview.list.columns.errorMessage', 'Error Message'),
    },
  };
};
