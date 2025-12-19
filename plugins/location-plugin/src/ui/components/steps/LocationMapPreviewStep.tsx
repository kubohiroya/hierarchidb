/**
 * Map preview step for Location dialog.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Slider,
  Switch,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import type { NodeId } from '@hierarchidb/common-types';
import { LocationMapPreview } from '../batch/LocationMapPreview.js';
import type { PreviewLocationPoint } from '../batch/LocationMapPreview.js';
import type { LocationEntity, LocationType } from '../../../common/types/index.js';
import { formatBytes, useTranslation } from '../../../common/i18n/index.js';
import { getEphemeralLocationDB } from '../../../database/EphemeralLocationDB.js';
import { LocationVectorTileService } from '../../../services/tiles/LocationVectorTileService.js';
import { listLocationPoints } from '../../../services/pointRepository.js';
import { BASE_LOCATION_TYPES } from './locationTypes.js';

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

const toPreviewLocationPoint = (point: Awaited<ReturnType<typeof listLocationPoints>>[number]): PreviewLocationPoint => {
  const properties: PreviewLocationPoint['properties'] = {
    ...(point.payload ?? {}),
  };

  if (point.gid1) properties.gid1 = point.gid1;
  if (point.gid2) properties.gid2 = point.gid2;
  if (point.source) properties.source = point.source;

  return {
    id: point.pid,
    name: point.name,
    type: resolveLocationType(point.kind),
    countryCode: point.gid0 || 'UNK',
    coordinates: [point.longitude, point.latitude],
    properties,
  };
};

interface LocationMapPreviewStepProps {
  draft: Partial<LocationEntity>;
  nodeId?: NodeId;
  onUpdate?: (updates: Partial<LocationEntity>) => void;
}

type TileSummary = Awaited<ReturnType<LocationVectorTileService['getSessionSummary']>> & {
  sessionId: string;
};

export const LocationMapPreviewStep: React.FC<LocationMapPreviewStepProps> = ({ draft: _draft, nodeId }) => {
  const { translations, locale } = useTranslation();
  const panelTranslations = translations.panel ?? {};
  const selectionTranslations = translations.selection ?? {};
  const selectionSettings = translations.selectionSettings ?? {};
  const typeLabels = translations.locationTypes ?? {};
  const typeDescriptions = selectionTranslations.typeDescriptions ?? {};
  const controlId = useId();
  const previewNodeId = nodeId ?? 'preview' as NodeId;
  const [summary, setSummary] = useState<TileSummary | null>(null);
  const [locations, setLocations] = useState<PreviewLocationPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceRef = useRef<LocationVectorTileService | null>(null);
  const isMountedRef = useRef(true);
  const [activeTypeTab, setActiveTypeTab] = useState(0);

  if (!serviceRef.current) {
    serviceRef.current = new LocationVectorTileService();
  }

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
      const db = getEphemeralLocationDB();
      const sessions = db.sessions;
      if (!sessions || typeof sessions.where !== 'function') {
        setSummary(null);
        const pointRecords = await listLocationPoints(resolvedNodeId);
        if (!isMountedRef.current) return;
        setLocations(pointRecords.map(toPreviewLocationPoint));
        return;
      }

      const records = await sessions.where('nodeId').equals(previewNodeId).toArray();
      if (!records?.length) {
        setSummary(null);
        const pointRecords = await listLocationPoints(resolvedNodeId);
        if (!isMountedRef.current) return;
        setLocations(pointRecords.map(toPreviewLocationPoint));
        return;
      }

      type SessionRecord = NonNullable<(typeof records)[number]>;
      const latest = records.reduce<SessionRecord | null>((acc, current) => {
        if (!acc) return current;
        return (current.createdAt ?? 0) > (acc.createdAt ?? 0) ? current : acc;
      }, null);

      if (!latest?.sessionId) {
        setSummary(null);
        const pointRecords = await listLocationPoints(resolvedNodeId);
        if (!isMountedRef.current) return;
        setLocations(pointRecords.map(toPreviewLocationPoint));
        return;
      }

      const [summaryResponse, pointRecords] = await Promise.all([
        serviceRef.current?.getSessionSummary(latest.sessionId),
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
          sessionId: latest.sessionId,
        } as TileSummary & { sessionId: string };
      });
      setLocations(pointRecords.map(toPreviewLocationPoint));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSummary(null);
      setLocations([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [previewNodeId]);

  const locationTypes = useMemo(() => BASE_LOCATION_TYPES.map((t) => {
    const name = typeLabels[t.id] ?? t.id;
    const descriptionKey = t.id as keyof typeof typeDescriptions;
    return {
      ...t,
      name,
      description: typeDescriptions[descriptionKey] ?? name,
    };
  }), [typeDescriptions, typeLabels]);

  const activeType = locationTypes[activeTypeTab];
  const airportSettings = selectionSettings.airport ?? {};
  const railwaySettings = selectionSettings.railway_station ?? selectionSettings.railway ?? {};
  const genericSettings = selectionSettings.generic ?? {};

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

  return (
    <Box display="flex" flexDirection="column" gap={2} sx={{ height: '100%' }}>
      <Paper elevation={1} sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <SettingsIcon color="primary" fontSize="small" />
          <Typography variant="h6">
            {selectionTranslations.settingsTitle ?? 'Location type settings'}
          </Typography>
        </Box>
        {selectionTranslations.settingsDescription && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectionTranslations.settingsDescription}
          </Typography>
        )}

        <Tabs
          value={activeTypeTab}
          onChange={(_, value) => setActiveTypeTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          {locationTypes.map((type) => (
            <Tab
              key={type.id}
              label={(
                <Box display="flex" alignItems="center" gap={1}>
                  <span>{type.icon}</span>
                  <span>{type.name}</span>
                </Box>
              )}
            />
          ))}
        </Tabs>

        {activeType && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              {activeType.icon} {activeType.description}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {genericSettings.advancedFilters ?? 'Configure advanced filters for this type.'}
            </Typography>

            {activeType.id === 'airport' && (
              <Box
                display="grid"
                gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}
                gap={3}
              >
                <FormControlLabel
                  control={(
                    <Switch
                      defaultChecked
                      inputProps={{
                        id: `${controlId}-airport-include-heliports`,
                        name: 'airport-include-heliports',
                      }}
                    />
                  )}
                  label={airportSettings.includeHeliports ?? 'Include heliports'}
                />
                <FormControlLabel
                  control={(
                    <Switch
                      defaultChecked
                      inputProps={{
                        id: `${controlId}-airport-active-only`,
                        name: 'airport-active-only',
                      }}
                    />
                  )}
                  label={airportSettings.activeOnly ?? 'Active airports only'}
                />
                <FormControlLabel
                  control={(
                    <Switch
                      inputProps={{
                        id: `${controlId}-airport-commercial-only`,
                        name: 'airport-commercial-only',
                      }}
                    />
                  )}
                  label={airportSettings.commercialOnly ?? 'Commercial airports only'}
                />
                <Box>
                  <Typography gutterBottom>
                    {(airportSettings.minRunwayLengthLabel ?? 'Minimum runway length: {value} m').replace('{value}', '1500')}
                  </Typography>
                  <Slider min={300} max={5000} step={100} defaultValue={1500} />
                </Box>
              </Box>
            )}

            {activeType.id === 'railway_station' && (
              <Box
                display="grid"
                gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}
                gap={3}
              >
                <FormControlLabel
                  control={(
                    <Switch
                      defaultChecked
                      inputProps={{
                        id: `${controlId}-railway-include-metro`,
                        name: 'railway-include-metro',
                      }}
                    />
                  )}
                  label={railwaySettings.includeMetro ?? 'Include metro/light rail'}
                />
                <FormControlLabel
                  control={(
                    <Switch
                      inputProps={{
                        id: `${controlId}-railway-include-abandoned`,
                        name: 'railway-include-abandoned',
                      }}
                    />
                  )}
                  label={railwaySettings.includeAbandoned ?? 'Include abandoned lines'}
                />
                <FormControlLabel
                  control={(
                    <Switch
                      inputProps={{
                        id: `${controlId}-railway-intercity-only`,
                        name: 'railway-intercity-only',
                      }}
                    />
                  )}
                  label={railwaySettings.intercityOnly ?? 'Intercity only'}
                />
                <TextField
                  type="number"
                  label={railwaySettings.minPlatformsLabel ?? 'Minimum platforms'}
                  defaultValue={1}
                  size="small"
                  id={`${controlId}-railway-min-platforms`}
                  name="railway-min-platforms"
                  inputProps={{
                    id: `${controlId}-railway-min-platforms`,
                    name: 'railway-min-platforms',
                  }}
                />
              </Box>
            )}
          </Box>
        )}
      </Paper>

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

      <Box flex={1} minHeight={320}>
        <LocationMapPreview nodeId={previewNodeId} locations={locations} />
      </Box>
    </Box>
  );
};
