import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid,
  Stack,
  Typography,
  FormControlLabel,
  Switch,
  Button,
} from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  ExpandMore as ExpandMoreIcon,
  FilterAlt as FilterAltIcon,
  Filter as FilterIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import type { DownloadProcessingConfig, ProcessingConfig, ShapeEntity } from '../../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useId, useCallback, useEffect, useState } from 'react';
import { getEphemeralShapeDB } from '../../../services/database/EphemeralShapeDB.js';
import type { NodeId } from '@hierarchidb/common-types';
import { notify } from '@hierarchidb/components';

type Props = {
  config: ProcessingConfig;
  draft?: Partial<ShapeEntity> | null;
  disabled?: boolean;
  onChange: (next: ProcessingConfig) => void;
};

export const DownloadConfigSection: React.FC<Props> = ({ config, draft, disabled, onChange }) => {
  const switchId = useId();
  const baseDownloadConfig: DownloadProcessingConfig | undefined =
    config.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig;
  const downloadedFilesCount = draft?.urlMetadata?.length ?? 0;
  const deleteLabel = downloadedFilesCount > 0
    ? `Delete Downloaded Files (${downloadedFilesCount} files)`
    : 'Delete Downloaded Files';

  const db = getEphemeralShapeDB();
  const nodeId = (draft as { nodeId?: NodeId })?.nodeId as NodeId | undefined;
  const processingStatus = (draft as { processingStatus?: string })?.processingStatus ?? 'idle';

  const [counts, setCounts] = useState({ raw: downloadedFilesCount, stage1: 0, stage2: 0, tiles: 0 });

  useEffect(() => {
    let cancelled = false;
    if (!nodeId) {
      setCounts({ raw: 0, stage1: 0, stage2: 0, tiles: 0 });
      return;
    }
    const loadCounts = async () => {
      const [raw, stage1, stage2, tiles] = await Promise.all([
        db.rawBuffers.where('nodeId').equals(nodeId).count(),
        db.simplifiedBuffers.where({ nodeId, stage: 'simplify1' }).count(),
        db.simplifiedBuffers.where({ nodeId, stage: 'simplify2' }).count(),
        db.vectorTiles.where('nodeId').equals(nodeId).count(),
      ]);
      if (!cancelled) {
        setCounts({ raw, stage1, stage2, tiles });
      }
    };
    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, [db, nodeId]);

  const isRunning = processingStatus === 'processing';
  const canDeleteRaw = !isRunning && counts.raw > 0 && !disabled;
  const canDeleteStage1 = !isRunning && counts.stage1 > 0 && !disabled;
  const canDeleteStage2 = !isRunning && counts.stage2 > 0 && !disabled;
  const canDeleteTiles = !isRunning && counts.tiles > 0 && !disabled;

  const handleDeleteRaw = useCallback(async () => {
    if (!nodeId) return notify.warning('NodeId is missing.');
    await db.rawBuffers.where('nodeId').equals(nodeId).delete();
    const nextRaw = await db.rawBuffers.where('nodeId').equals(nodeId).count();
    setCounts((prev) => ({ ...prev, raw: nextRaw }));
    notify.success('Deleted downloaded files');
  }, [db, nodeId]);

  const handleDeleteStage = useCallback(async (stage: 'simplify1' | 'simplify2') => {
    if (!nodeId) return notify.warning('NodeId is missing.');
    await db.simplifiedBuffers.where({ nodeId, stage }).delete();
    const [next1, next2] = await Promise.all([
      db.simplifiedBuffers.where({ nodeId, stage: 'simplify1' }).count(),
      db.simplifiedBuffers.where({ nodeId, stage: 'simplify2' }).count(),
    ]);
    setCounts((prev) => ({ ...prev, stage1: next1, stage2: next2 }));
    notify.success(stage === 'simplify1' ? 'Deleted Stage1 cache' : 'Deleted Stage2 cache');
  }, [db, nodeId]);

  const handleDeleteTiles = useCallback(async () => {
    if (!nodeId) return notify.warning('NodeId is missing.');
    await db.vectorTiles.where('nodeId').equals(nodeId).delete();
    const nextTiles = await db.vectorTiles.where('nodeId').equals(nodeId).count();
    setCounts((prev) => ({ ...prev, tiles: nextTiles }));
    notify.success('Deleted tiles');
  }, [db, nodeId]);

  const update = (partial: Partial<ProcessingConfig>) => {
    onChange(mergeProcessingConfig({ ...config, ...partial }));
  };

  if (!baseDownloadConfig) {
    throw new Error('DownloadConfigSection: baseDownloadConfig is not defined');
  }

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CloudDownloadIcon color="primary" />
          <Typography variant="subtitle1">Download Setting / Cache Management</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <WorkerNumberConfigCard
              title="Number of Workers for Concurrent Download"
              value={baseDownloadConfig.maxConcurrent ?? 2}
              icon={<CloudDownloadIcon fontSize="small" color="primary" />}
              onChange={(maxConcurrent) =>
                update({
                  downloadConfig: {
                    ...baseDownloadConfig,
                    maxConcurrent,
                  },
                })
              }
              min={1}
              max={2}
              step={1}
              disabled={disabled}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={!config?.cleanupConfig?.deleteDownloadedFiles}
                  onChange={(e) => {
                    const retainFiles = e.target.checked;
                    update({
                      cleanupConfig: {
                        ...config.cleanupConfig,
                        deleteDownloadedFiles: !retainFiles,
                      },
                    });
                  }}
                  disabled={disabled}
                  inputProps={{
                    id: `${switchId}-retain-downloaded-files`,
                    name: 'retain-downloaded-files',
                  }}
                />
              }
              label="Retain downloaded files"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
            <Grid container spacing={1} sx={{ width: '100%' }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  startIcon={<CloudDownloadIcon />}
                  disabled={!canDeleteRaw}
                  onClick={handleDeleteRaw}
                >
                  {deleteLabel}
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  startIcon={<FilterAltIcon />}
                  disabled={!canDeleteStage1}
                  onClick={() => handleDeleteStage('simplify1')}
                >
                  Delete Stage1 Cache
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  startIcon={<FilterIcon />}
                  disabled={!canDeleteStage2}
                  onClick={() => handleDeleteStage('simplify2')}
                >
                  Delete Stage2 Cache
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  startIcon={<LayersIcon />}
                  disabled={!canDeleteTiles}
                  onClick={handleDeleteTiles}
                >
                  Delete Tiles
                </Button>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
