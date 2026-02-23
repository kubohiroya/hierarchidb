import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCategoryFilter,
  buildRoutePreviewRows,
  DEFAULT_MAP_CONFIG,
  type ResourceVectorLayer,
  useVectorTilePreviewSearch,
  type MapAttributionItem,
  type MapPreviewErrorSummaryById,
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
import type { SvgIconComponent } from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/core-types';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useFloatingWindow } from '@hierarchidb/ui-floating-window';
import type {
  RouteBuildError,
  RouteEntity,
  RouteLineString,
  RouteMetadataSyncSummary,
  RouteNearestLineResponse,
} from '@hierarchidb/route-api';
import {
  formatDistance,
  getTransportModeName,
  type SupportedLocale,
  useTranslation,
} from '~/common/i18n/index';
import {
  LINE_WIDTH_MAX,
  LINE_WIDTH_MIN,
  ROUTE_MODE_COLUMNS,
  ROUTE_STYLE_OPTIONS,
} from './useRouteSelectionStep.js';
import { ROUTE_MODES, type RouteMode } from '@hierarchidb/route-api';
import { ROUTE_DATA_SOURCES } from '~/common/datasource/configs';
import { getDBName } from '@hierarchidb/util';
import { buildRouteColorExpression, mergeRouteStyleConfig, resolveLineDashArray } from '~/common/styles/routeStyle';
import { RoutePreviewHoverMatch } from './RoutePreviewStepElements.js';

type Bounds = { minLon: number; maxLon: number; minLat: number; maxLat: number };
const HOVER_DISTANCE_PX = 16;
const MAX_HOVER_MATCHES = 9;
const MINI_MAP_SIZE = 84;
const MINI_MAP_CENTER = MINI_MAP_SIZE / 2;
const MINI_MAP_SCALE = 3.8;
const HOVER_LABEL_SPACING = 12;

type RouteModeOption = {
  id: RouteMode;
  label: string;
  Icon: SvgIconComponent;
  modes: RouteMode[];
};

const ROUTE_MODE_OPTIONS: RouteModeOption[] = [
  { id: ROUTE_MODES.AIRWAY, label: 'Air', Icon: FlightIcon, modes: [ROUTE_MODES.AIRWAY] },
  { id: ROUTE_MODES.WATERWAY, label: 'Sea', Icon: DirectionsBoatIcon, modes: [ROUTE_MODES.WATERWAY] },
  { id: ROUTE_MODES.RAILWAY, label: 'Rail', Icon: TrainIcon, modes: [ROUTE_MODES.RAILWAY] },
  { id: ROUTE_MODES.H_RAILWAY, label: 'High-speed Rail', Icon: SpeedIcon, modes: [ROUTE_MODES.H_RAILWAY] },
  { id: ROUTE_MODES.ROAD, label: 'Road', Icon: DirectionsCarIcon, modes: [ROUTE_MODES.ROAD, ROUTE_MODES.HIGHWAY] },
];

const ROUTE_MODE_SELECTION_PERSIST_KEY = 'hierarchidb:ui:floating-window:route:mode-selection';

const loadRouteModeSelection = (): MapToggleSelection => {
  try {
    if (typeof localStorage === 'undefined') {
      return Object.fromEntries(ROUTE_MODE_OPTIONS.map((option) => [option.id, true])) as MapToggleSelection;
    }
    const raw = localStorage.getItem(ROUTE_MODE_SELECTION_PERSIST_KEY);
    if (!raw) {
      return Object.fromEntries(ROUTE_MODE_OPTIONS.map((option) => [option.id, true])) as MapToggleSelection;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, boolean> = {};
    ROUTE_MODE_OPTIONS.forEach((option) => {
      next[option.id] = parsed[option.id] !== false;
    });
    return next as MapToggleSelection;
  } catch {
    return Object.fromEntries(ROUTE_MODE_OPTIONS.map((option) => [option.id, true])) as MapToggleSelection;
  }
};

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

const toDistanceLabel = (value: number, locale: SupportedLocale) => formatDistance(value, locale);

const resolveLabelParts = (parts: Array<string | undefined>) => parts.filter((value): value is string => Boolean(value));

const projectToMiniMap = (point: { x: number; y: number }, cursor: { x: number; y: number }) => ({
  x: MINI_MAP_CENTER + (point.x - cursor.x) * MINI_MAP_SCALE,
  y: MINI_MAP_CENTER + (point.y - cursor.y) * MINI_MAP_SCALE,
});

const clampMiniMapCoordinate = (value: number): number => Math.max(4, Math.min(MINI_MAP_SIZE - 4, value));

const projectSegmentPath = (
  segmentStart: { x: number; y: number },
  segmentEnd: { x: number; y: number },
  segmentNearest: { x: number; y: number },
  cursor: { x: number; y: number },
) => {
  const start = projectToMiniMap(segmentStart, cursor);
  const end = projectToMiniMap(segmentEnd, cursor);
  const nearest = projectToMiniMap(segmentNearest, cursor);
  const points = [
    `${clampMiniMapCoordinate(start.x)},${clampMiniMapCoordinate(start.y)}`,
    `${clampMiniMapCoordinate(nearest.x)},${clampMiniMapCoordinate(nearest.y)}`,
    `${clampMiniMapCoordinate(end.x)},${clampMiniMapCoordinate(end.y)}`,
  ];
  return {
    path: points.join(' '),
    labelX: clampMiniMapCoordinate(nearest.x),
    labelY: clampMiniMapCoordinate(nearest.y),
  };
};

const buildLabelCandidates = () => [
  { x: 0, y: 0 },
  { x: 10, y: -8 },
  { x: -10, y: -8 },
  { x: 0, y: -16 },
  { x: 12, y: 0 },
  { x: -12, y: 0 },
  { x: 8, y: 10 },
  { x: -8, y: 10 },
  { x: 0, y: 12 },
];

const projectPointOnSegment = (
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return { x: start.x, y: start.y };
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
};

const toLineSummaryLine = (routeMode: string | undefined, routeName: string | undefined, startLabel: string, endLabel: string) =>
  [routeMode, routeName, `${startLabel} -> ${endLabel}`].filter(Boolean).join(' / ');

const resolveLineRouteModeLabel = (routeMode: string | undefined, locale: SupportedLocale) => (
  routeMode ? getTransportModeName(routeMode, locale) : 'Unknown route'
);

export const useRoutePreviewStep = ({
  draft,
  nodeId,
  onUpdate,
}: {
  draft: Partial<RouteEntity>;
  nodeId?: NodeId;
  onUpdate: (updates: Partial<RouteEntity>) => void;
}) => {
  const { t, locale: localeFromTranslation } = useTranslation();
  const locale = localeFromTranslation as SupportedLocale;
  const previewNodeId = nodeId;
  const workerBridgeRef = useRef(getBuildWorkerBridge());
  const [lineStrings, setLineStrings] = useState<RouteLineString[]>([]);
  const [lineStringsLoading, setLineStringsLoading] = useState(false);
  const [lineStringsError, setLineStringsError] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const [routeModeSelection, setRouteModeSelection] = useState<MapToggleSelection>(loadRouteModeSelection);
  const [listSearch, setListSearch] = useState('');
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [metadataSyncSummary, setMetadataSyncSummary] = useState<RouteMetadataSyncSummary | null>(null);
  const [buildErrors, setBuildErrors] = useState<RouteBuildError[]>([]);
  const [metadataSyncRunning, setMetadataSyncRunning] = useState(false);
  const [metadataSyncError, setMetadataSyncError] = useState<string | null>(null);
  const [hoverMatches, setHoverMatches] = useState<RoutePreviewHoverMatch[]>([]);
  const hasHoverMatchesRef = useRef(false);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const hoverRequestIdRef = useRef(0);
  const lineLookup = useMemo(() => new Map(lineStrings.map((line) => [String(line.id), line])), [lineStrings]);

  useEffect(() => {
    setHoverMatches((current) => {
      let changed = false;
      const nextMatches = current.map((match) => {
        const isSelected = selectedIdSet.has(match.id);
        if (match.isSelected === isSelected) return match;
        changed = true;
        return {
          ...match,
          isSelected,
        };
      });
      return changed ? nextMatches : current;
    });
  }, [selectedIdSet]);
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
    const name = draft.dataSourceName;
    if (!name) return undefined;
    const normalized = name.toLowerCase();
    return ROUTE_DATA_SOURCES.find((source) => source.name.toLowerCase() === normalized);
  }, [draft.dataSourceName]);
  const routeStyleConfig = useMemo(
    () => mergeRouteStyleConfig(draft.routeStyleConfig),
    [draft.routeStyleConfig],
  );
  const modeWindow = useFloatingWindow({
    persistKey: 'hierarchidb:ui:floating-window:route:mode-toggle',
    initialPosition: { x: 96, y: 96 },
    initialSize: { width: 260, height: 220 },
  });
  const styleWindow = useFloatingWindow({
    persistKey: 'hierarchidb:ui:floating-window:route:style-config',
    initialPosition: { x: 640, y: 96 },
    initialSize: { width: 360, height: 520 },
  });
  const listWindow = useFloatingWindow({
    persistKey: 'hierarchidb:ui:floating-window:route:metadata-list',
    initialPosition: { x: 96, y: 356 },
    initialSize: { width: 640, height: 280 },
  });
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
      setBuildErrors([]);
      setMetadataSyncSummary(null);
      setMetadataSyncError(null);
      return;
    }
    let active = true;
    setLineStringsLoading(true);
    setLineStringsError(null);
    void (async () => {
      try {
        const api = await workerBridgeRef.current.getRouteQueryAPI();
        const [rows, errors] = await Promise.all([
          api.listRouteLineStrings(previewNodeId),
          api.listRouteBuildErrors(previewNodeId),
        ]);
        if (!active) return;
        setLineStrings(rows);
        setBuildErrors(errors);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : String(error);
        setLineStringsError(message);
        setLineStrings([]);
        setBuildErrors([]);
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

  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(ROUTE_MODE_SELECTION_PERSIST_KEY, JSON.stringify(routeModeSelection));
    } catch {
      // Ignore persistence failures.
    }
  }, [routeModeSelection]);

  const buildHoverMatchList = useCallback((
    queryResponse: RouteNearestLineResponse,
    cursorPoint: { x: number; y: number },
    cursor: { longitude: number; latitude: number },
  ) => {
    if (!mapInstance) return [];
    const mapWithProject = mapInstance as MapLibreMapInstance & {
      project?: (lngLat: { lng: number; lat: number }) => { x: number; y: number };
    };
    if (!mapWithProject.project) return [];
    const mapProject = mapWithProject.project;
    const placed: Array<{ x: number; y: number }> = [];
    return queryResponse.matches
      .map((match, index) => {
        const line = lineLookup.get(match.line.lineStringId);
        if (!line) return null;
        const pathPoints = normalizeLineCoordinates(line.waypoints ?? []);
        if (pathPoints.length < 2) return null;
        const nearestPoint = match.line.nearestPoint ?? [cursor.longitude, cursor.latitude];
        const nearestProjected = mapProject({ lng: nearestPoint[0], lat: nearestPoint[1] });
        let best:
          | { start: { x: number; y: number }; end: { x: number; y: number }; nearest: { x: number; y: number }; distance: number }
          | undefined;
        for (let i = 0; i < pathPoints.length - 1; i += 1) {
          const startPoint = pathPoints[i];
          const endPoint = pathPoints[i + 1];
          if (!startPoint || !endPoint) continue;
          const start = mapProject({ lng: startPoint[0], lat: startPoint[1] });
          const end = mapProject({ lng: endPoint[0], lat: endPoint[1] });
          const projectedNearest = projectPointOnSegment(nearestProjected, start, end);
          const dx = projectedNearest.x - nearestProjected.x;
          const dy = projectedNearest.y - nearestProjected.y;
          const distance = Math.hypot(dx, dy);
          if (!best || distance < best.distance) {
            best = {
              start: { x: start.x, y: start.y },
              end: { x: end.x, y: end.y },
              nearest: projectedNearest,
              distance,
            };
          }
        }
        if (!best) return null;
        const pathInfo = projectSegmentPath(
          best.start,
          best.end,
          best.nearest,
          { x: cursorPoint.x, y: cursorPoint.y },
        );
        const startParts = resolveLabelParts([
          match.line.start?.name,
          match.line.start?.admin2Name,
          match.line.start?.admin1Name,
          match.line.start?.admin0Name,
        ]);
        const endParts = resolveLabelParts([
          match.line.end?.name,
          match.line.end?.admin2Name,
          match.line.end?.admin1Name,
          match.line.end?.admin0Name,
        ]);
        const startLabel = startParts.length > 0 ? startParts.join(' / ') : t('preview.hoverUnknown', 'Unknown route');
        const endLabel = endParts.length > 0 ? endParts.join(' / ') : t('preview.hoverUnknown', 'Unknown route');
        const summaryMode = resolveLineRouteModeLabel(match.line.routeMode, locale);
        const summaryLine = toLineSummaryLine(summaryMode, match.line.routeName, startLabel, endLabel);
        const distanceLabel = toDistanceLabel(match.distanceMeters, locale);
        const colorKey = match.line.routeMode as RouteMode | undefined;
        const modeColor = colorKey ? routeStyleConfig.modeColors[colorKey] : '#9ca3af';
        const nearestX = clampMiniMapCoordinate(pathInfo.labelX);
        const nearestY = clampMiniMapCoordinate(pathInfo.labelY);
        const candidateCandidates = buildLabelCandidates();
        const selectedLabel = candidateCandidates
          .map((candidate) => ({
            x: clampMiniMapCoordinate(nearestX + candidate.x),
            y: clampMiniMapCoordinate(nearestY + candidate.y),
          }))
          .find((candidate) => {
            return placed.every((placedEntry) => {
              const dx = placedEntry.x - candidate.x;
              const dy = placedEntry.y - candidate.y;
              return Math.hypot(dx, dy) > HOVER_LABEL_SPACING;
            });
          }) ?? { x: nearestX, y: nearestY };
        const id = match.line.lineStringId;
        placed.push(selectedLabel);
        return {
          id,
          index: index + 1,
          linePath: pathInfo.path,
          summaryLine,
          routeName: match.line.routeName ?? '',
          distanceLabel,
          modeColor,
          isSelected: selectedIdSet.has(id),
          miniMapLabelX: selectedLabel.x,
          miniMapLabelY: selectedLabel.y,
        };
      })
      .filter((match): match is RoutePreviewHoverMatch => match !== null)
      .slice(0, MAX_HOVER_MATCHES);
  }, [lineLookup, locale, mapInstance, routeStyleConfig.modeColors, selectedIdSet, t]);

  const toggleHoverMatchSelection = useCallback((matchId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return Array.from(next);
    });
  }, []);
  const closeHoverMatches = useCallback(() => {
    setHoverMatches([]);
  }, []);

  const runHoverLookup = useCallback((longitude: number, latitude: number, zoom: number, point: { x: number; y: number }) => {
    if (!previewNodeId) return;
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
          maxMatches: MAX_HOVER_MATCHES,
        });
        if (hoverRequestIdRef.current !== requestId) return;
        const nextMatches = buildHoverMatchList(result, point, { longitude, latitude });
        setHoverMatches(nextMatches);
      } catch (error) {
        if (hoverRequestIdRef.current === requestId) {
          setHoverMatches([]);
        }
        console.warn('[RoutePreviewStep] hover lookup failed', error);
      }
    })();
  }, [buildHoverMatchList, previewNodeId]);

  useEffect(() => {
    hasHoverMatchesRef.current = hoverMatches.length > 0;
  }, [hoverMatches.length]);

  useEffect(() => {
    if (!mapInstance) return;
    const mapContainer = (mapInstance as { getContainer?: () => HTMLElement | null }).getContainer?.() ?? null;
    const handleClick = (event: unknown) => {
      const lngLat = (event as { lngLat?: { lng: number; lat: number } })?.lngLat;
      const point = (event as { point?: { x: number; y: number } })?.point;
      if (!lngLat) return;
      const zoom = mapInstance.getZoom();
      if (!point) return;
      runHoverLookup(lngLat.lng, lngLat.lat, zoom, point);
    };
    const handleLeave = () => {
      setHoverMatches([]);
    };
    const handleDocumentPointerDown = (event: MouseEvent) => {
      if (!hasHoverMatchesRef.current) return;
      if (!mapContainer) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (!mapContainer.contains(target)) {
        closeHoverMatches();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && hasHoverMatchesRef.current) {
        closeHoverMatches();
      }
    };
    mapInstance.on('click', handleClick);
    mapInstance.on('mouseleave', handleLeave);
    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      mapInstance.off('click', handleClick);
      mapInstance.off('mouseleave', handleLeave);
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeHoverMatches, mapInstance, runHoverLookup]);

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

  const runMetadataSyncCheck = useCallback(async () => {
    if (!previewNodeId) return;
    setMetadataSyncRunning(true);
    setMetadataSyncError(null);
    try {
      const api = await workerBridgeRef.current.getRouteQueryAPI();
      const summary = await api.checkRouteMetadataSync(previewNodeId);
      setMetadataSyncSummary(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMetadataSyncError(message);
    } finally {
      setMetadataSyncRunning(false);
    }
  }, [previewNodeId]);
  const listRows = useMemo(
    () => (hasGeometry ? buildRoutePreviewRows(lineStrings) : []),
    [hasGeometry, lineStrings],
  );
  const routeModeMeta = useMemo(() => Object.fromEntries(
    ROUTE_MODE_COLUMNS.map((mode) => [
      mode.id,
      {
        label: t(mode.labelKey, mode.id),
        Icon: mode.icon,
        color: routeStyleConfig.modeColors[mode.id],
      },
    ]),
  ), [routeStyleConfig.modeColors, t]);
  const updateStyleConfig = useCallback((next: typeof routeStyleConfig) => {
    onUpdate({ routeStyleConfig: next });
  }, [onUpdate, routeStyleConfig]);
  const handleModeColorChange = useCallback((mode: RouteMode, value: string) => {
    updateStyleConfig({
      ...routeStyleConfig,
      modeColors: {
        ...routeStyleConfig.modeColors,
        [mode]: value,
      },
    });
  }, [routeStyleConfig, updateStyleConfig]);
  const handleLineWidthChange = useCallback((value: number | number[]) => {
    const raw = Array.isArray(value) ? value[0] ?? routeStyleConfig.lineWidth : value;
    const nextWidth = Math.min(LINE_WIDTH_MAX, Math.max(LINE_WIDTH_MIN, Number(raw)));
    updateStyleConfig({
      ...routeStyleConfig,
      lineWidth: nextWidth,
    });
  }, [routeStyleConfig, updateStyleConfig]);
  const handleLineStyleChange = useCallback((value: string) => {
    const nextStyle = ROUTE_STYLE_OPTIONS.find((option) => option.id === value)?.id ?? 'solid';
    updateStyleConfig({
      ...routeStyleConfig,
      lineStyle: nextStyle,
    });
  }, [routeStyleConfig, updateStyleConfig]);
  const getRowId = useCallback((row: (typeof listRows)[number]) => String(row.id), []);
  const buildSearchText = useCallback((row: (typeof listRows)[number]) => {
    const modeLabel = row.routeMode ? routeModeMeta[row.routeMode]?.label : undefined;
    return [
      row.id,
      row.routeMode,
      modeLabel,
      row.routeName,
      row.startName,
      row.startAdmin0,
      row.startAdmin1,
      row.startAdmin2,
      row.endName,
      row.endAdmin0,
      row.endAdmin1,
      row.endAdmin2,
      row.waypointCount,
      row.distanceMeters,
    ].filter((value) => value != null && value !== '').join(' ');
  }, [routeModeMeta]);

  useVectorTilePreviewSearch(
    hasGeometry,
    listRows,
    listSearch,
    getRowId,
    buildSearchText,
    setMatchedIds,
  );
  const matchedIdSet = useMemo(() => new Set(matchedIds), [matchedIds]);
  const staleSummaryById = useMemo<MapPreviewErrorSummaryById>(() => {
    const map: MapPreviewErrorSummaryById = new Map();
    if (!metadataSyncSummary) return map;
    metadataSyncSummary.rows.forEach((row) => {
      if (row.status !== 'stale') return;
      map.set(row.lineId, {
        errorCount: 1,
        repairCount: 0,
        count: 1,
        messages: row.reason ? [row.reason] : ['metadata mismatch'],
      });
    });
    return map;
  }, [metadataSyncSummary]);

  const metadataSyncBadgeText = useMemo(() => {
    if (!metadataSyncSummary) return '';
    return `${t('preview.metadataSync.synced', '✅ Synced')}(${metadataSyncSummary.syncedCount}/${metadataSyncSummary.totalCount}) `
      + `${t('preview.metadataSync.stale', '⚠️ Rebuild required')}(${metadataSyncSummary.staleCount}/${metadataSyncSummary.totalCount})`;
  }, [metadataSyncSummary, t]);

  const hoverSnackbarProps = {
    matches: hoverMatches,
    onToggleMatchSelection: toggleHoverMatchSelection,
  };

  const emptyContentProps = listRows.length === 0 ? {
    message: t('preview.list.empty', 'No route lines are available yet.'),
  } : undefined;

  return {
    t,
    mapInstance,
    setMapInstance,
    attributionItems,
    initialViewState,
    vectorLayers,
    hoverSnackbarProps,
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
    staleSummaryById,
    emptyContentProps,
    modeMeta: routeModeMeta,
    columnLabels: {
      lineId: t('preview.list.columns.lineId', 'Line Id'),
      routeMode: t('preview.list.columns.routeMode', 'Mode'),
      routeName: t('preview.list.columns.routeName', 'Route Name'),
      startName: t('preview.list.columns.startName', 'Start'),
      startAdmin0: t('preview.list.columns.startAdmin0', 'Start Admin0'),
      startAdmin1: t('preview.list.columns.startAdmin1', 'Start Admin1'),
      startAdmin2: t('preview.list.columns.startAdmin2', 'Start Admin2'),
      endName: t('preview.list.columns.endName', 'End'),
      endAdmin0: t('preview.list.columns.endAdmin0', 'End Admin0'),
      endAdmin1: t('preview.list.columns.endAdmin1', 'End Admin1'),
      endAdmin2: t('preview.list.columns.endAdmin2', 'End Admin2'),
      waypointCount: t('preview.list.columns.waypointCount', 'Waypoints'),
      distanceMeters: t('preview.list.columns.distanceMeters', 'Distance (m)'),
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
      failed: t('preview.metadataSync.stale', '⚠️ Rebuild required'),
      completed: t('preview.metadataSync.synced', '✅ Synced'),
    },
    errorColumnLabels: {
      status: t('preview.list.columns.status', 'Status'),
      errorCount: t('preview.list.columns.errorCount', 'Errors'),
      errorMessage: t('preview.list.columns.errorMessage', 'Error Message'),
    },
    modeWindow,
    showModeWindowButton: !modeWindow.windowState.isVisible,
    routeStyleConfig,
    styleWindow,
    showStyleWindowButton: !styleWindow.windowState.isVisible,
    listWindow,
    showListWindowButton: !listWindow.windowState.isVisible,
    handleModeColorChange,
    handleLineWidthChange,
    handleLineStyleChange,
    metadataSyncSummary,
    metadataSyncRunning,
    metadataSyncError,
    metadataSyncBadgeText,
    runMetadataSyncCheck,
    buildErrors,
  };
};
