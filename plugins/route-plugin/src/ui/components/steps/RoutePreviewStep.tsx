/**
 * RoutePreviewStep - Step 6 of route creation dialog.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { Alert, Box, Paper, Snackbar, Stack, Typography } from '@mui/material';
import {
  buildCategoryFilter,
  buildRoutePreviewRows,
  DEFAULT_MAP_CONFIG,
  MapToggleCard,
  mergeFilters,
  RoutePreviewList,
  ResourceLayerMap,
  useVectorTilePreviewSearch,
  type MapAttributionItem,
  type MapLibreMapInstance,
  type MapToggleSelection,
  type MapViewState,
  type ResourceGeoJsonLayer,
} from '@hierarchidb/ui-map';
import {
  DirectionsBoat as DirectionsBoatIcon,
  DirectionsCar as DirectionsCarIcon,
  Flight as FlightIcon,
  Speed as SpeedIcon,
  Train as TrainIcon,
} from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/common-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import type { RouteNearestLineResponse } from '@hierarchidb/plugin-service-api';
import type { RouteUpdaterPayload } from '../../../common/entities/RouteEntity.js';
import { formatDistance, getTransportModeName, useTranslation } from '../../../common/i18n/index.js';
import { ROUTE_MODES, type RouteMode } from '@hierarchidb/route-store';
import { ROUTE_DATA_SOURCES } from '../../../common/datasource/configs.js';

interface RoutePreviewStepProps {
  draft: RouteUpdaterPayload;
  nodeId?: NodeId;
}

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

const resolveBounds = (geometry: [number, number][]): Bounds | null => {
  if (!geometry.length) return null;
  const lngs = geometry.map((point) => point[0]);
  const lats = geometry.map((point) => point[1]);
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

const resolveMetersPerPixel = (latitude: number, zoom: number): number => {
  const worldCircumference = 40_075_016.686;
  const latFactor = Math.cos((latitude * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;
  return (worldCircumference * latFactor) / scale;
};

const resolveRouteMode = (draft: RouteUpdaterPayload['draftData']): RouteMode | null => {
  const selection = draft?.transportSelection;
  if (selection === 'high-speed-rail') return ROUTE_MODES.H_RAILWAY;
  if (selection === 'rail') return ROUTE_MODES.RAILWAY;
  if (selection === 'highway') return ROUTE_MODES.HIGHWAY;
  if (selection === 'road') return ROUTE_MODES.ROAD;
  const mode = draft?.transportMode;
  if (mode === 'air') return ROUTE_MODES.AIRWAY;
  if (mode === 'sea') return ROUTE_MODES.WATERWAY;
  if (mode === 'rail') return ROUTE_MODES.RAILWAY;
  if (mode === 'road') return ROUTE_MODES.ROAD;
  return null;
};

export const RoutePreviewStep: React.FC<RoutePreviewStepProps> = ({ draft, nodeId }) => {
  const { t, locale } = useTranslation();
  const hasGeometry = Array.isArray(draft.draftData?.lineGeometry) && draft.draftData?.lineGeometry.length > 0;
  const geometry: [number, number][] = useMemo(()=> draft.draftData?.lineGeometry ?? [], [draft.draftData?.lineGeometry]);
  const previewNodeId = nodeId ?? draft.treeNodeId;
  const bounds = useMemo(() => resolveBounds(geometry), [geometry]);
  const workerBridgeRef = useRef(getWorkerBridge());
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
  const dataSourceConfig = useMemo(() => {
    const name = draft.draftData?.dataSourceName;
    if (!name) return undefined;
    const normalized = name.toLowerCase();
    return ROUTE_DATA_SOURCES.find((source) => source.name.toLowerCase() === normalized);
  }, [draft.draftData?.dataSourceName]);
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
  const routeMode = useMemo(() => resolveRouteMode(draft.draftData), [draft.draftData]);
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
  const geoJsonLayers = useMemo<ResourceGeoJsonLayer[]>(() => {
    if (!hasGeometry) return [];
    return [
      {
        layerId: `route-preview-${previewNodeId ?? 'route'}`,
        sourceId: `route-preview-source-${previewNodeId ?? 'route'}`,
        layerType: 'line',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: geometry,
              },
              properties: {
                routeMode: routeMode ?? ROUTE_MODES.ROAD,
              },
            },
          ],
        },
        paint: {
          'line-color': '#f24c3d',
          'line-width': 2,
          'line-opacity': 0.9,
        },
      },
    ];
  }, [geometry, hasGeometry, previewNodeId, routeMode]);
  const filteredGeoJsonLayers = useMemo(
    () => {
      if (enabledRouteModes.length === 0) return [];
      return geoJsonLayers.map((layer) => ({
        ...layer,
        filter: mergeFilters(layer.filter, routeFilter),
      }));
    },
    [enabledRouteModes.length, geoJsonLayers, routeFilter],
  );
  const handleRouteModeToggle = useCallback((id: string) => {
    setRouteModeSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const listRows = useMemo(
    () => (hasGeometry ? buildRoutePreviewRows([geometry]) : []),
    [geometry, hasGeometry],
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

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h6">{t('preview.title', 'Preview')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('preview.description', 'Preview the generated route geometry once the stage is complete.')}
      </Typography>

      {!hasGeometry && (
        <Alert severity="info">
          {t('preview.missing', 'No route geometry is available yet. Run Build to generate a preview.')}
        </Alert>
      )}

      {hasGeometry && (
        <>
          <Alert severity="success">
            {t('preview.ready', 'Route geometry is available. Map preview will appear here.')}
          </Alert>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1">{t('preview.mapTitle', 'Map Preview')}</Typography>
            <Stack spacing={2} mt={1}>
              <MapToggleCard
                title="Route Modes"
                options={ROUTE_MODE_OPTIONS.map((option) => ({
                  id: option.id,
                  label: option.label,
                  icon: option.icon,
                }))}
                selection={routeModeSelection}
                onToggle={handleRouteModeToggle}
              />
              <Box
                sx={{
                  position: 'relative',
                  height: 320,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                  overflow: 'hidden',
                }}
              >
                <ResourceLayerMap
                  initialViewState={initialViewState}
                  width="100%"
                  height="100%"
                  mapStyleUrl={DEFAULT_MAP_CONFIG.mapStyleUrl}
                  basemapStyles={[]}
                  vectorLayers={[]}
                  geoJsonLayers={filteredGeoJsonLayers}
                  attributionItems={attributionItems}
                  mapOptions={DEFAULT_MAP_CONFIG.interactionOptions}
                  onLoad={setMapInstance}
                />
                <RoutePreviewList
                  title={t('preview.list.title', 'Routes')}
                  rows={listRows}
                  columnLabels={{
                    lineId: t('preview.list.columns.lineId', 'Line Id'),
                    startLon: t('preview.list.columns.startLon', 'Start Lon'),
                    startLat: t('preview.list.columns.startLat', 'Start Lat'),
                    endLon: t('preview.list.columns.endLon', 'End Lon'),
                    endLat: t('preview.list.columns.endLat', 'End Lat'),
                    distanceMeters: t('preview.list.columns.distanceMeters', 'Distance (m)'),
                    vertexCount: t('preview.list.columns.vertexCount', 'Vertices'),
                  }}
                  search={{
                    value: listSearch,
                    onChange: setListSearch,
                    placeholder: t('preview.list.searchPlaceholder', 'Search routes'),
                    ariaLabel: t('preview.list.searchAriaLabel', 'Search routes'),
                  }}
                  countLabels={{
                    matched: t('preview.list.matched', 'Matched'),
                    rows: t('preview.list.rows', 'Rows'),
                  }}
                  matchedRows={matchedIdSet}
                  selectedRows={new Set(selectedIds)}
                  onSelectionChange={(next: Set<string | number>) => setSelectedIds(Array.from(next).map(String))}
                  errorSummaryById={emptyErrorSummary}
                  errorColumnLabels={{
                    status: t('preview.list.columns.status', 'Status'),
                    errorCount: t('preview.list.columns.errorCount', 'Errors'),
                    errorMessage: t('preview.list.columns.errorMessage', 'Error Message'),
                  }}
                  statusLabels={{
                    failed: t('preview.list.status.failed', 'Failed'),
                    completed: t('preview.list.status.completed', 'Completed'),
                  }}
                  emptyContent={listRows.length === 0 ? (
                    <Alert severity="info" sx={{ m: 2 }}>
                      {t('preview.list.empty', 'No route lines are available yet.')}
                    </Alert>
                  ) : undefined}
                />
              </Box>
            </Stack>
          </Paper>
          <Snackbar
            open={hoverOpen && Boolean(hoverMessage)}
            message={hoverMessage}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            autoHideDuration={2000}
          />
        </>
      )}
    </Box>
  );
};
