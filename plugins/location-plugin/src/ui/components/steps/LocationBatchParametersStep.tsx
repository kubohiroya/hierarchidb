/**
 * Batch parameter configuration step for Location dialog.
 */

import type React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { Box, Button, Grid, Slider, Typography } from '@mui/material';
import type { LocationEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import type { NodeId } from '@hierarchidb/common-types';
import { notify } from '@hierarchidb/components';
import { listLocationPoints, clearLocationPoints } from '../../../services/pointRepository.js';
import { getEphemeralLocationDB } from '../../../database/EphemeralLocationDB.js';
import { LocationTabularMetadataManager } from '../../../common/tabular/LocationTabularMetadataManager.js';
import { getRowStoreDB } from '@hierarchidb/tabular-store';

interface LocationBatchParametersStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
  nodeId?: NodeId;
  disabled?: boolean;
}

const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 16;

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export const LocationBatchParametersStep: React.FC<LocationBatchParametersStepProps> = ({
  draft: draftProp,
  onUpdate,
  nodeId,
  disabled,
}) => {
  const { translations } = useTranslation();
  const draft = draftProp ?? {};
  const [pointCount, setPointCount] = useState(0);
  const [cacheCount, setCacheCount] = useState(0);
  const [metadataCount, setMetadataCount] = useState(0);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);

  const rawConcurrent = draft.concurrentDownloads ?? 2;
  const concurrentDownloads = clamp(Number(rawConcurrent) || 2, MIN_CONCURRENCY, MAX_CONCURRENCY);

  const loadCounts = useCallback(async () => {
    if (!nodeId) {
      setPointCount(0);
      setCacheCount(0);
      setMetadataCount(0);
      setActiveTableId(null);
      return;
    }
    const [points, cacheTiles, cacheSessions] = await Promise.all([
      listLocationPoints(nodeId).then((list) => list.length).catch(() => 0),
      getEphemeralLocationDB().vectorTiles.where('nodeId').equals(nodeId).count().catch(() => 0),
      getEphemeralLocationDB().sessions?.where('nodeId').equals(nodeId).count().catch(() => 0),
    ]);
    let latestTableId: string | null = null;
    const sessions = await getEphemeralLocationDB().sessions?.where('nodeId').equals(nodeId).toArray().catch(() => []);
    if (sessions && sessions.length > 0) {
      const [first] = sessions;
      if (first) {
        const latest = sessions.reduce(
          (acc, cur) => ((cur.createdAt ?? 0) > (acc.createdAt ?? 0) ? cur : acc),
          first,
        );
        latestTableId = latest.tableId ?? null;
      }
    }
    let metadataRows = 0;
    if (latestTableId) {
      metadataRows = await getRowStoreDB().rowChunks.where('tableId').equals(latestTableId).count();
    }
    setPointCount(points);
    setCacheCount(cacheTiles + cacheSessions);
    setMetadataCount(metadataRows);
    setActiveTableId(latestTableId);
  }, [nodeId]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts, draft.batchSessionId]);

  const handleConcurrentDownloadsChange = (_: Event, value: number | number[]) => {
    const rawValue = Array.isArray(value) ? value[0] ?? concurrentDownloads : value ?? concurrentDownloads;
    const next = clamp(rawValue, MIN_CONCURRENCY, MAX_CONCURRENCY);
    onUpdate({ concurrentDownloads: next });
  };

  const handleDeleteDownloads = async () => {
    if (!nodeId) return notify.warning('NodeId is missing.');
    await clearLocationPoints(nodeId);
    await loadCounts();
    notify.success(translations.processing?.deleteDownloadsDone ?? 'Deleted downloaded points');
  };

  const handleDeleteCache = async () => {
    if (!nodeId) return notify.warning('NodeId is missing.');
    await getEphemeralLocationDB().clearNodeData(nodeId);
    await loadCounts();
    notify.success(translations.processing?.deleteCacheDone ?? 'Deleted cached intermediate data');
  };

  const handleDeleteMetadata = async () => {
    if (!nodeId || !activeTableId) return notify.warning('Metadata table is missing.');
    const metadataManager = new LocationTabularMetadataManager();
    await metadataManager.forceDelete(activeTableId);
    await getRowStoreDB().rowChunks.where('tableId').equals(activeTableId).delete();
    await getEphemeralLocationDB().sessions?.where('nodeId').equals(nodeId).modify({ tableId: undefined });
    await loadCounts();
    notify.success(translations.processing?.deleteMetadataDone ?? 'Deleted metadata');
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Typography variant="body2" color="text.secondary">
        {translations.processing?.description ?? 'Configure download and tiling parameters for batch processing.'}
      </Typography>

      <Grid container spacing={3} columns={{ xs: 12 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography gutterBottom>
            {translations.processing?.concurrentDownloadsLabel ?? 'Concurrent Downloads'}: {concurrentDownloads}
          </Typography>
          <Slider
            min={MIN_CONCURRENCY}
            max={MAX_CONCURRENCY}
            value={concurrentDownloads}
            valueLabelDisplay="auto"
            onChange={handleConcurrentDownloadsChange}
            disabled={disabled}
          />
        </Grid>

      </Grid>

      <Box display="flex" flexDirection="column" gap={2}>
        <Typography variant="subtitle1">
          {translations.processing?.cleanupTitle ?? 'Cleanup'}
        </Typography>
        <Grid container spacing={2} columns={{ xs: 12 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Button
              variant="outlined"
              fullWidth
              disabled={disabled || pointCount === 0}
              onClick={handleDeleteDownloads}
            >
              {(translations.processing?.deleteDownloads ?? 'Delete Downloaded Points').replace('{count}', String(pointCount))}
            </Button>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Button
              variant="outlined"
              fullWidth
              disabled={disabled || cacheCount === 0}
              onClick={handleDeleteCache}
            >
              {(translations.processing?.deleteCache ?? 'Delete Cached Data').replace('{count}', String(cacheCount))}
            </Button>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Button
              variant="outlined"
              fullWidth
              disabled={disabled || metadataCount === 0}
              onClick={handleDeleteMetadata}
            >
              {(translations.processing?.deleteMetadata ?? 'Delete Metadata').replace('{count}', String(metadataCount))}
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};
