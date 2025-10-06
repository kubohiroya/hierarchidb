/**
 * Map preview step for Location dialog.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { LocationMapPreview } from '../batch/LocationMapPreview.js';
import type { LocationWorkingCopy } from '../../types/index.js';
import { formatBytes, useTranslation } from '../../i18n/index.js';
import { getEphemeralLocationDB } from '../../services/database/EphemeralLocationDB.js';
import { LocationVectorTileService } from '../../services/tiles/LocationVectorTileService.js';

interface LocationMapPreviewStepProps {
  workingCopy: LocationWorkingCopy;
  onUpdate?: (updates: Partial<LocationWorkingCopy>) => void;
}

type TileSummary = Awaited<ReturnType<LocationVectorTileService['getSessionSummary']>> & {
  sessionId: string;
};

export const LocationMapPreviewStep: React.FC<LocationMapPreviewStepProps> = ({ workingCopy }) => {
  const { translations, locale } = useTranslation();
  const nodeId = (workingCopy as any)?.treeNodeId ?? (workingCopy as any)?.nodeId ?? 'preview';
  const [summary, setSummary] = useState<TileSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceRef = useRef<LocationVectorTileService | null>(null);

  if (!serviceRef.current) {
    serviceRef.current = new LocationVectorTileService();
  }

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getEphemeralLocationDB();
      const sessions = db.sessions;
      if (!sessions || typeof sessions.where !== 'function') {
        setSummary(null);
        return;
      }

      const records = await sessions.where('nodeId').equals(nodeId).toArray();
      if (!records?.length) {
        setSummary(null);
        return;
      }

      const latest = records.reduce((acc, current) => {
        if (!acc) return current;
        return (current.createdAt ?? 0) > (acc.createdAt ?? 0) ? current : acc;
      });

      if (!latest?.sessionId) {
        setSummary(null);
        return;
      }

      const summaryResponse = await serviceRef.current!.getSessionSummary(latest.sessionId);
      setSummary({ ...summaryResponse, sessionId: latest.sessionId });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadSummary();
    })();
    return () => {
      cancelled = true;
      if (cancelled) {
        setLoading(false);
      }
    };
  }, [loadSummary]);

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
          onClick={loadSummary}
        >
          {translations.panel.refresh}
        </Button>
      </Stack>

      <Box>
        {summaryContent}
      </Box>

      <Divider />

      <Box flex={1} minHeight={320}>
        <LocationMapPreview nodeId={nodeId as any} locations={[]} />
      </Box>
    </Box>
  );
};
