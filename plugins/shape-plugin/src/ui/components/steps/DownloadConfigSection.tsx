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
  TextField,
  Rating,
} from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  ExpandMore as ExpandMoreIcon,
  FilterAlt as FilterAltIcon,
  Filter as FilterIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type { DownloadProcessingConfig, ProcessingConfig, ShapeEntity } from '../../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useId, useCallback, useEffect, useState } from 'react';
import { getEphemeralShapeDB } from '../../../services/database/EphemeralShapeDB.js';
import type { NodeId } from '@hierarchidb/common-types';
import { notify } from '@hierarchidb/components';
import { useTranslation } from '../../i18n.js';

type Props = {
  config: ProcessingConfig;
  draft?: Partial<ShapeEntity> | null;
  disabled?: boolean;
  onChange: (next: ProcessingConfig) => void;
};

export const DownloadConfigSection: React.FC<Props> = ({ config, draft, disabled, onChange }) => {
  const { t } = useTranslation();
  const switchId = useId();
  const baseDownloadConfig: DownloadProcessingConfig | undefined =
    config.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig;

  const db = getEphemeralShapeDB();
  const sessionId = (draft as { nodeId?: NodeId })?.nodeId
    ?? (draft as { batchSessionId?: string })?.batchSessionId;
  const processingStatus = (draft as { processingStatus?: string })?.processingStatus ?? 'idle';

  const [counts, setCounts] = useState({ raw: 0, stage1: 0, stage2: 0, tiles: 0 });
  const deleteLabel = counts.raw > 0
    ? t('processing.download.deleteDownloadedFilesWithCount', 'Delete Downloaded Files ({{count}} files)', { count: counts.raw })
    : t('processing.download.deleteDownloadedFiles', 'Delete Downloaded Files');

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setCounts({ raw: 0, stage1: 0, stage2: 0, tiles: 0 });
      return;
    }
    const loadCounts = async () => {
      const [raw, stage1, stage2, tiles] = await Promise.all([
        db.rawBuffers.where('sessionId').equals(sessionId).count(),
        db.simplifiedBuffers.where({ sessionId, stage: 'simplify1' }).count(),
        db.simplifiedBuffers.where({ sessionId, stage: 'simplify2' }).count(),
        db.vectorTiles.where('sessionId').equals(sessionId).count(),
      ]);
      if (!cancelled) {
        setCounts({ raw, stage1, stage2, tiles });
      }
    };
    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, [config, db, sessionId]);

  const isRunning = processingStatus === 'processing';
  const canDeleteRaw = !isRunning && counts.raw > 0 && !disabled;
  const canDeleteStage1 = !isRunning && counts.stage1 > 0 && !disabled;
  const canDeleteStage2 = !isRunning && counts.stage2 > 0 && !disabled;
  const canDeleteTiles = !isRunning && counts.tiles > 0 && !disabled;

  const handleDeleteRaw = useCallback(async () => {
    if (!sessionId) return notify.warning('SessionId is missing.');
    await db.clearStage(sessionId, 'download');
    const nextRaw = await db.rawBuffers.where('sessionId').equals(sessionId).count();
    setCounts((prev) => ({ ...prev, raw: nextRaw }));
    notify.success('Deleted downloaded files');
  }, [db, sessionId]);

  const handleDeleteStage = useCallback(async (stage: 'simplify1' | 'simplify2') => {
    if (!sessionId) return notify.warning('SessionId is missing.');
    await db.clearStage(sessionId, stage);
    const [next1, next2] = await Promise.all([
      db.simplifiedBuffers.where({ sessionId, stage: 'simplify1' }).count(),
      db.simplifiedBuffers.where({ sessionId, stage: 'simplify2' }).count(),
    ]);
    setCounts((prev) => ({ ...prev, stage1: next1, stage2: next2 }));
    notify.success(stage === 'simplify1' ? 'Deleted Stage1 cache' : 'Deleted Stage2 cache');
  }, [db, sessionId]);

  const handleDeleteTiles = useCallback(async () => {
    if (!sessionId) return notify.warning('SessionId is missing.');
    await db.clearStage(sessionId, 'vectorTiles');
    const nextTiles = await db.vectorTiles.where('sessionId').equals(sessionId).count();
    setCounts((prev) => ({ ...prev, tiles: nextTiles }));
    notify.success('Deleted tiles');
  }, [db, sessionId]);

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
          <Typography variant="subtitle1">
            {t('processing.download.title', 'Download Setting / Cache Management')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <WorkerNumberConfigCard
              title={t('processing.download.workers', 'Number of Workers for Concurrent Download')}
              value={baseDownloadConfig.maxConcurrent ?? 2}
              icon={<CloudDownloadIcon fontSize="small" color="primary" />}
              helperText={t('processing.download.workersHelp', 'Controls how many downloads run in parallel.')}
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
              label={t('processing.download.retainFiles', 'Retain downloaded files')}
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
                  {t('processing.download.deleteStage1Cache', 'Delete Stage1 Cache')}
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
                  {t('processing.download.deleteStage2Cache', 'Delete Stage2 Cache')}
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
                  {t('processing.download.deleteTiles', 'Delete Tiles')}
                </Button>
              </Grid>
            </Grid>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label={t('processing.download.timeoutMs', 'Timeout (ms)')}
              type="number"
              value={baseDownloadConfig.timeoutMs ?? ''}
              onChange={(event) => {
                const timeoutMs = Number(event.target.value);
                update({
                  downloadConfig: {
                    ...baseDownloadConfig,
                    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
                  },
                });
              }}
              fullWidth
              disabled={disabled}
              inputProps={{ min: 0 }}
              helperText={t('processing.download.timeoutHelp', 'Maximum time to wait for each download before failing.')}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label={t('processing.download.retryDelay', 'Retry Delay (ms)')}
              type="number"
              value={baseDownloadConfig.retryDelay ?? ''}
              onChange={(event) => {
                const retryDelay = Number(event.target.value);
                update({
                  downloadConfig: {
                    ...baseDownloadConfig,
                    retryDelay: Number.isFinite(retryDelay) ? retryDelay : undefined,
                  },
                });
              }}
              fullWidth
              disabled={disabled}
              inputProps={{ min: 0 }}
              helperText={t('processing.download.retryDelayHelp', 'Wait time between retry attempts when a download fails.')}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2">
                {t('processing.download.retryAttempts', 'Retry Attempts')}
              </Typography>
              <Rating
                value={baseDownloadConfig.retryAttempts ?? baseDownloadConfig.retryLimit ?? 0}
                onChange={(_, value) => {
                  const retryAttempts = value ?? 0;
                  update({
                    downloadConfig: {
                      ...baseDownloadConfig,
                      retryAttempts,
                      retryLimit: retryAttempts,
                    },
                  });
                }}
                max={10}
                disabled={disabled}
                icon={<CheckCircleIcon fontSize="inherit" />}
                emptyIcon={<RadioButtonUncheckedIcon fontSize="inherit" />}
              />
              <Typography variant="caption" color="text.secondary">
                {t('processing.download.retryAttemptsHelp', 'Number of retries per failed download request.')}
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
