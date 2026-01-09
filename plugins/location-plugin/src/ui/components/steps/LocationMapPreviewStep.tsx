/**
 * Map preview step for Location dialog.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { NodeId } from '@hierarchidb/common-types';
import type {
  MapToggleSelection,
  MapViewState,
  MapAttributionItem,
  ResourceGeoJsonLayer,
} from '@hierarchidb/ui-map';
import {
  buildCategoryFilter,
  DEFAULT_MAP_CONFIG,
  MapToggleCard,
  ResourceLayerMap,
} from '@hierarchidb/ui-map';
import type { LocationEntity, LocationType } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { getLocationDB } from '@hierarchidb/location-store';
import { DataGridPreview } from '@hierarchidb/ui-grid';
import { LOCATION_TYPE_STYLES } from './locationTypes.js';
import { resolveLocationAttribution } from '../../../common/datasources/attribution.js';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import type { MapLibreMapInstance } from '@hierarchidb/ui-map';
import { renderToStaticMarkup } from 'react-dom/server';

const KNOWN_LOCATION_TYPES: readonly LocationType[] = [
  'area_centroid',
  'airport',
  'port',
  'railway_station',
  'interchange',
];

const PREFETCH_MARGIN_PX = 64;
const CIRCLE_RADIUS_MIN = 2;
const CIRCLE_RADIUS_MAX_ZOOM = 11;
const CIRCLE_RADIUS_SLOPE = 0.6;
const CIRCLE_RADIUS_AT_MAX = CIRCLE_RADIUS_MIN + CIRCLE_RADIUS_MAX_ZOOM * CIRCLE_RADIUS_SLOPE;
const ICON_SIZE_MIN = 0.7;
const ICON_SIZE_SLOPE = 0.05;
const ICON_SIZE_AT_MAX = ICON_SIZE_MIN + CIRCLE_RADIUS_MAX_ZOOM * ICON_SIZE_SLOPE;

const resolveLocationType = (kind: string): LocationType => (
  (KNOWN_LOCATION_TYPES as readonly string[]).includes(kind)
    ? kind as LocationType
    : 'area_centroid'
);

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

type PreviewSummary = {
  totalPoints: number;
};

type PreviewPoint = {
  id: string;
  longitude: number;
  latitude: number;
  kind: LocationType;
};

export const LocationMapPreviewStep: React.FC<LocationMapPreviewStepProps> = ({ draft: _draft, nodeId }) => {
  const { translations } = useTranslation();
  const panelTranslations = translations.panel ?? {};
  const previewNodeId = nodeId ?? 'preview' as NodeId;
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [previewPoints, setPreviewPoints] = useState<PreviewPoint[]>([]);
  const [tableId, setTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iconsReady, setIconsReady] = useState(false);
  const isMountedRef = useRef(true);
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const queryTimerRef = useRef<number | null>(null);
  const queryRequestRef = useRef(0);
  const [activeTab, setActiveTab] = useState(0);
  const [locationTypeSelection, setLocationTypeSelection] = useState<MapToggleSelection>(() =>
    Object.fromEntries(LOCATION_TYPE_OPTIONS.map((option) => [option.id, true])) as MapToggleSelection
  );
  const dataSourceAttribution = useMemo(
    () => resolveLocationAttribution(_draft.dataSource ?? null),
    [_draft.dataSource],
  );
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

  const loadData = useCallback(async () => {
    if (!isMountedRef.current) return;

    if (typeof window === 'undefined') {
      setSummary(null);
      setPreviewPoints([]);
      return;
    }

    if (!previewNodeId || previewNodeId === 'preview') {
      setSummary(null);
      setPreviewPoints([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const db = getLocationDB();
      const sessions = db.sessions;
      const totalPoints = await db.features.where('nodeId').equals(previewNodeId).count();
      if (!isMountedRef.current) return;
      setSummary({ totalPoints });
      setPreviewPoints([]);
      if (!sessions || typeof sessions.where !== 'function') {
        setTableId(null);
        return;
      }
      const records = await sessions.where('nodeId').equals(previewNodeId).toArray().catch(() => []);
      if (!records?.length) {
        setTableId(null);
        return;
      }
      type SessionRecord = NonNullable<(typeof records)[number]>;
      const latest = records.reduce<SessionRecord | null>((acc, current) => {
        if (!acc) return current;
        return (current.createdAt ?? 0) > (acc.createdAt ?? 0) ? current : acc;
      }, null);
      setTableId(latest?.tableId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSummary(null);
      setTableId(null);
      setPreviewPoints([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [previewNodeId]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
      const items = await api.queryByViewport(
        previewNodeId as NodeId,
        bbox,
        viewState?.zoom ?? map.getZoom(),
        enabledLocationTypes,
        {
          prefetchMarginPx: PREFETCH_MARGIN_PX,
          viewportSizePx,
        },
      );
      if (requestId !== queryRequestRef.current) return;
      const points = items
        .map((item) => {
          const data = item.data as { longitude?: number; latitude?: number; kind?: string } | undefined;
          if (!data) return null;
          const longitude = data.longitude;
          const latitude = data.latitude;
          if (typeof longitude !== 'number' || !Number.isFinite(longitude)) return null;
          if (typeof latitude !== 'number' || !Number.isFinite(latitude)) return null;
          return {
            id: String(item.id),
            longitude,
            latitude,
            kind: resolveLocationType(data.kind ?? 'area_centroid'),
          } satisfies PreviewPoint;
        })
        .filter((point): point is PreviewPoint => Boolean(point));
      setPreviewPoints(points);
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

  const summaryContent = useMemo(() => {
    if (loading) {
      return (
        <Stack direction="row" alignItems="center" spacing={1}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            {translations.mapPreview?.loading ?? 'Loading map preview...'}
          </Typography>
        </Stack>
      );
    }

    if (error) {
      const message = translations.mapPreview?.error
        ?.replace('{message}', error)
        ?? `Failed to load map preview: ${error}`;
      return (
        <Typography variant="body2" color="error">
          {message}
        </Typography>
      );
    }

    if (!summary || summary.totalPoints === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          {translations.mapPreview?.summary?.noData ?? 'No location points available yet.'}
        </Typography>
      );
    }

    return (
      <Stack spacing={0.5}>
        <Typography variant="body2">
          {translations.mapPreview?.summary?.points?.replace('{count}', String(summary.totalPoints))
            ?? `Stored points: ${summary.totalPoints}`}
        </Typography>
      </Stack>
    );
  }, [error, loading, summary, translations.mapPreview]);

  const metadataContent = useMemo(() => {
    if (loading) {
      return (
        <Stack direction="row" alignItems="center" spacing={1}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            {translations.mapPreview?.metadataLoading ?? 'Loading metadata...'}
          </Typography>
        </Stack>
      );
    }
    if (!tableId) {
      return (
        <Typography variant="body2" color="text.secondary">
          {translations.mapPreview?.metadataEmpty ?? 'No metadata available yet.'}
        </Typography>
      );
    }
    return (
      <Box sx={{ height: 420 }}>
        <DataGridPreview pluginId="location" tableId={tableId} />
      </Box>
    );
  }, [loading, tableId, translations.mapPreview?.metadataEmpty, translations.mapPreview?.metadataLoading]);

  const knownLocationTypes = useMemo(() => LOCATION_TYPE_OPTIONS.map((option) => option.id), []);
  const locationFilter = useMemo(
    () => buildCategoryFilter(enabledLocationTypes, knownLocationTypes, ['kind', 'type']),
    [enabledLocationTypes, knownLocationTypes],
  );
  const circleColorExpression = useMemo(() => {
    const expression: Array<string | unknown> = ['match', ['get', 'kind']];
    Object.entries(LOCATION_TYPE_STYLES).forEach(([kind, style]) => {
      expression.push(kind, style.color);
    });
    expression.push(LOCATION_TYPE_STYLES.area_centroid.color);
    return expression;
  }, []);
  const circleRadiusExpression = useMemo(
    () => (['interpolate', ['linear'], ['zoom'], 0, CIRCLE_RADIUS_MIN, CIRCLE_RADIUS_MAX_ZOOM, CIRCLE_RADIUS_AT_MAX] as unknown),
    [],
  );
  const iconImageExpression = useMemo(() => {
    const expression: Array<string | unknown> = ['match', ['get', 'kind']];
    Object.entries(LOCATION_TYPE_STYLES).forEach(([kind]) => {
      expression.push(kind, `location-preview-icon-${kind}`);
    });
    expression.push(`location-preview-icon-area_centroid`);
    return expression;
  }, []);
  const iconSizeExpression = useMemo(
    () => (['interpolate', ['linear'], ['zoom'], 0, ICON_SIZE_MIN, CIRCLE_RADIUS_MAX_ZOOM, ICON_SIZE_AT_MAX] as unknown),
    [],
  );
  const initialViewState = useMemo(
    () => buildInitialViewState(undefined),
    [],
  );
  const locationGeoJsonLayers = useMemo<ResourceGeoJsonLayer[]>(() => {
    if (enabledLocationTypes.length === 0) return [];
    if (previewPoints.length === 0) return [];
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
              kind: resolveLocationType(point.kind),
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
              kind: resolveLocationType(point.kind),
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
    return layers;
  }, [
    circleColorExpression,
    circleRadiusExpression,
    enabledLocationTypes.length,
    iconImageExpression,
    iconSizeExpression,
    iconsReady,
    locationFilter,
    previewPoints,
    previewNodeId,
  ]);
  const handleLocationToggle = useCallback((id: string) => {
    setLocationTypeSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    mapRef.current = map;
    const mapWithImages = map as MapLibreMapInstance & {
      hasImage?: (id: string) => boolean;
      addImage?: (id: string, image: HTMLImageElement) => void;
    };
    if (mapWithImages.addImage) {
      const missing = (Object.entries(LOCATION_TYPE_STYLES) as Array<[LocationType, (typeof LOCATION_TYPE_STYLES)[LocationType]]>)
        .filter(([kind]) => !mapWithImages.hasImage?.(`location-preview-icon-${kind}`));
      if (missing.length === 0) {
        setIconsReady(true);
      } else {
        setIconsReady(false);
      }
      const loaders = missing.map(([kind, style]) => new Promise<void>((resolve) => {
        const iconId = `location-preview-icon-${kind}`;
        const Icon = style.icon;
        const svg = renderToStaticMarkup(<Icon htmlColor={style.color} />);
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
      void Promise.all(loaders).then(() => setIconsReady(true));
    }
    scheduleViewportQuery();
  }, [scheduleViewportQuery]);
  const handleMapMoveEnd = useCallback((viewState: MapViewState) => {
    scheduleViewportQuery(viewState);
  }, [scheduleViewportQuery]);

  return (
    <Box display="flex" flexDirection="column" gap={2} sx={{ height: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {translations.mapPreview?.description ?? 'Preview the generated points on the map.'}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon fontSize="small" />}
          onClick={loadData}
        >
          {panelTranslations.refresh ?? 'Refresh'}
        </Button>
      </Stack>

      <Box>
        {summaryContent}
      </Box>

      <Divider />

      <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={translations.mapPreview?.tabs?.map ?? 'Map'} />
          <Tab label={translations.mapPreview?.tabs?.metadata ?? 'Metadata'} />
        </Tabs>
      </Paper>

      <Box flex={1} minHeight={320}>
        {activeTab === 0 ? (
          <Stack spacing={2} sx={{ height: '100%' }}>
            <MapToggleCard
              title="Terrain Types"
              options={LOCATION_TYPE_OPTIONS.map((option) => ({
                ...option,
                label: translations.locationTypes?.[option.id as LocationType] ?? option.label,
              }))}
              selection={locationTypeSelection}
              onToggle={handleLocationToggle}
            />
            <Box flex={1} minHeight={320}>
              <ResourceLayerMap
                initialViewState={initialViewState}
                width="100%"
                height="100%"
                mapStyleUrl={DEFAULT_MAP_CONFIG.mapStyleUrl}
                basemapStyles={[]}
                vectorLayers={[]}
                geoJsonLayers={locationGeoJsonLayers}
                attributionItems={attributionItems}
                mapOptions={DEFAULT_MAP_CONFIG.interactionOptions}
                onLoad={handleMapLoad}
                onMoveEnd={handleMapMoveEnd}
              />
            </Box>
          </Stack>
        ) : (
          metadataContent
        )}
      </Box>
    </Box>
  );
};
