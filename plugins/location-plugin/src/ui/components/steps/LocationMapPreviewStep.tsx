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
  ResourceVectorLayer,
} from '@hierarchidb/ui-map';
import {
  buildCategoryFilter,
  DEFAULT_MAP_CONFIG,
  MapToggleCard,
  mergeFilters,
  ResourceLayerMap,
} from '@hierarchidb/ui-map';
import type { LocationEntity, LocationType } from '../../../common/types/index.js';
import { formatBytes, useTranslation } from '../../../common/i18n/index.js';
import { getLocationSessionSummary } from '../../../common/tiles/locationVectorTiles.js';
import { getLocationDB } from '@hierarchidb/location-store';
import { listLocationPoints } from '../../../services/pointRepository.js';
import { DataGridPreview } from '@hierarchidb/ui-grid';
import { LOCATION_TYPE_STYLES } from './locationTypes.js';
import { getDBName } from '@hierarchidb/util';
import { resolveLocationAttribution } from '../../../common/datasources/attribution.js';

const KNOWN_LOCATION_TYPES: readonly LocationType[] = [
  'area_centroid',
  'airport',
  'port',
  'railway_station',
  'interchange',
];

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

type TileSummary = Awaited<ReturnType<typeof getLocationSessionSummary>>;

export const LocationMapPreviewStep: React.FC<LocationMapPreviewStepProps> = ({ draft: _draft, nodeId }) => {
  const { translations, locale } = useTranslation();
  const panelTranslations = translations.panel ?? {};
  const previewNodeId = nodeId ?? 'preview' as NodeId;
  const [summary, setSummary] = useState<TileSummary | null>(null);
  const [locations, setLocations] = useState<Awaited<ReturnType<typeof listLocationPoints>>>([]);
  const [tableId, setTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
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
      setLocations([]);
      return;
    }

    if (!previewNodeId || previewNodeId === 'preview') {
      setSummary(null);
      setLocations([]);
      return;
    }

    const resolvedNodeId = previewNodeId as NodeId;

    setLoading(true);
    setError(null);
    try {
      const db = getLocationDB();
      const sessions = db.sessions;
      if (!sessions || typeof sessions.where !== 'function') {
        setSummary(null);
        setTableId(null);
        const pointRecords = await listLocationPoints(resolvedNodeId);
        if (!isMountedRef.current) return;
        setLocations(pointRecords);
        return;
      }

      const records = await sessions.where('nodeId').equals(previewNodeId).toArray();
      if (!records?.length) {
        setSummary(null);
        setTableId(null);
        const pointRecords = await listLocationPoints(resolvedNodeId);
        if (!isMountedRef.current) return;
        setLocations(pointRecords);
        return;
      }

      type SessionRecord = NonNullable<(typeof records)[number]>;
      const latest = records.reduce<SessionRecord | null>((acc, current) => {
        if (!acc) return current;
        return (current.createdAt ?? 0) > (acc.createdAt ?? 0) ? current : acc;
      }, null);

      const [summaryResponse, pointRecords] = await Promise.all([
        getLocationSessionSummary(resolvedNodeId),
        listLocationPoints(resolvedNodeId),
      ]);
      if (!isMountedRef.current) return;
      setSummary((prev) => {
        if (!summaryResponse) return prev ?? null;
        return {
          exists: summaryResponse.exists ?? false,
          layers: summaryResponse.layers ?? [],
          zoomRange: summaryResponse.zoomRange,
          tiles: summaryResponse.tiles ?? 0,
          sizeBytes: summaryResponse.sizeBytes ?? 0,
          bbox: summaryResponse.bbox,
        } as TileSummary;
      });
      setTableId(latest?.tableId ?? null);
      setLocations(pointRecords);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSummary(null);
      setTableId(null);
      setLocations([]);
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

    if (!summary || !summary.exists || summary.tiles === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          {translations.mapPreview?.summary?.noData ?? 'No vector tiles generated yet.'}
        </Typography>
      );
    }

    const zoomRange = summary.zoomRange;
    const zoomText = zoomRange
      ? translations.mapPreview?.summary?.zoomRange
          ?.replace('{min}', String(zoomRange[0]))
          ?.replace('{max}', String(zoomRange[1]))
      : undefined;
    const sizeBytes = summary.sizeBytes ?? 0;
    const sizeText = translations.mapPreview?.summary?.size
      ?.replace('{size}', formatBytes(sizeBytes, locale))
      ?? `Total size: ${formatBytes(sizeBytes, locale)}`;

    return (
      <Stack spacing={0.5}>
        <Typography variant="body2">
          {translations.mapPreview?.summary?.tiles?.replace('{count}', String(summary.tiles))
            ?? `Generated tiles: ${summary.tiles}`}
        </Typography>
        {zoomText && (
          <Typography variant="body2" color="text.secondary">{zoomText}</Typography>
        )}
        <Typography variant="body2" color="text.secondary">{sizeText}</Typography>
        {summary.layers?.length ? (
          <Typography variant="caption" color="text.secondary">
            {translations.mapPreview?.summary?.layers
              ?.replace('{layers}', summary.layers.join(', '))
              ?? `Layers: ${summary.layers.join(', ')}`}
          </Typography>
        ) : null}
      </Stack>
    );
  }, [error, loading, locale, summary, translations.mapPreview]);

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
  const enabledLocationTypes = useMemo(
    () => LOCATION_TYPE_OPTIONS.filter((option) => locationTypeSelection[option.id]).map((option) => option.id),
    [locationTypeSelection],
  );
  const locationFilter = useMemo(
    () => buildCategoryFilter(enabledLocationTypes, knownLocationTypes, ['kind', 'type']),
    [enabledLocationTypes, knownLocationTypes],
  );
  const initialViewState = useMemo(
    () => buildInitialViewState(summary?.bbox),
    [summary?.bbox],
  );
  const locationVectorLayers = useMemo<ResourceVectorLayer[]>(() => {
    if (!previewNodeId || previewNodeId === 'preview') return [];
    if (!summary?.exists || summary.tiles === 0) return [];
    return [
      {
        nodeId: String(previewNodeId),
        nodeType: 'location',
        dbName: getDBName('location'),
        tileDataProvider: async (z, x, y) => {
          const db = getLocationDB();
          const rec = await db.vectorTiles.get(`loc-mvt-${previewNodeId}-${z}-${x}-${y}`);
          return rec?.data ?? null;
        },
        layerConfig: {
          layerType: 'circle',
          sourceLayer: 'location_points',
          paint: {
            'circle-radius': 4,
            'circle-color': '#2f74ff',
            'circle-opacity': 0.8,
          },
        },
      },
    ];
  }, [previewNodeId, summary?.exists, summary?.tiles]);
  const locationGeoJsonLayers = useMemo<ResourceGeoJsonLayer[]>(() => {
    if (enabledLocationTypes.length === 0) return [];
    if (locationVectorLayers.length > 0 || locations.length === 0) return [];
    return [
      {
        layerId: `location-preview-${previewNodeId}`,
        sourceId: `location-preview-source-${previewNodeId}`,
        layerType: 'circle',
        filter: locationFilter ?? undefined,
        data: {
          type: 'FeatureCollection',
          features: locations.map((point) => ({
            type: 'Feature',
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
          'circle-radius': 4,
          'circle-color': '#2f74ff',
          'circle-opacity': 0.8,
        },
      },
    ];
  }, [enabledLocationTypes.length, locationFilter, locationVectorLayers.length, locations, previewNodeId]);
  const filteredVectorLayers = useMemo(() => {
    const nextVisible = enabledLocationTypes.length > 0;
    return locationVectorLayers.map((layer) => {
      const baseConfig = layer.layerConfig ?? {};
      return {
        ...layer,
        layerConfig: {
          ...baseConfig,
          visible: nextVisible ? baseConfig.visible : false,
          filter: mergeFilters(baseConfig.filter, locationFilter),
        },
      };
    });
  }, [enabledLocationTypes.length, locationFilter, locationVectorLayers]);
  const handleLocationToggle = useCallback((id: string) => {
    setLocationTypeSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

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
                vectorLayers={filteredVectorLayers}
                geoJsonLayers={locationGeoJsonLayers}
                attributionItems={attributionItems}
                mapOptions={DEFAULT_MAP_CONFIG.interactionOptions}
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
