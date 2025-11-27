/**
 * Map preview step for Location dialog.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { NodeId } from '@hierarchidb/common-types';
import { LocationMapPreview } from '../batch/LocationMapPreview.js';
import type { PreviewLocationPoint } from '../batch/LocationMapPreview.js';
import type { LocationEntity, LocationType } from '../../types/index.js';
import { formatBytes, useTranslation } from '../../i18n/index.js';
import { getEphemeralLocationDB } from '../../../services/database/EphemeralLocationDB.js';
import { LocationVectorTileService } from '../../../services/tiles/LocationVectorTileService.js';
import { listLocationPoints } from '../../../services/pointRepository.js';

const KNOWN_LOCATION_TYPES: readonly LocationType[] = [
  'airport',
  'railway_station',
  'bus_stop',
  'port',
  'parking',
  'government',
  'religious',
  'post_office',
  'fire_station',
  'police',
  'hospital',
  'clinic',
  'pharmacy',
  'school',
  'university',
  'library',
  'shopping_mall',
  'supermarket',
  'restaurant',
  'hotel',
  'bank',
  'museum',
  'theater',
  'monument',
  'park',
  'stadium',
  'beach',
  'mountain',
  'lake',
  'river',
  'interchange',
  'tourist_attraction',
  'custom',
];

const resolveLocationType = (kind: string): LocationType => (
  (KNOWN_LOCATION_TYPES as readonly string[]).includes(kind)
    ? kind as LocationType
    : 'custom'
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
  const previewNodeId = nodeId ?? 'preview';
  const [summary, setSummary] = useState<TileSummary | null>(null);
  const [locations, setLocations] = useState<PreviewLocationPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceRef = useRef<LocationVectorTileService | null>(null);
  const isMountedRef = useRef(true);

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
        serviceRef.current!.getSessionSummary(latest.sessionId),
        listLocationPoints(resolvedNodeId),
      ]);
      if (!isMountedRef.current) return;
      setSummary({ ...summaryResponse, sessionId: latest.sessionId });
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
          {translations.panel.refresh}
        </Button>
      </Stack>

      <Box>
        {summaryContent}
      </Box>

      <Divider />

      <Box flex={1} minHeight={320}>
        <LocationMapPreview nodeId={previewNodeId as any} locations={locations} />
      </Box>
    </Box>
  );
};
