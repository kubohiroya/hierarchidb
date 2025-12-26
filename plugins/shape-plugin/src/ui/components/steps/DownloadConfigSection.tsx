import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { BatchConfig, ShapeEntity } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useDownloadConfigSection } from '../../hooks/useDownloadConfigSection.js';
import { DownloadRetentionToggle } from '../processing/DownloadRetentionToggle.js';
import { DownloadCacheActions } from '../processing/DownloadCacheActions.js';
import { DownloadRetryControls } from '../processing/DownloadRetryControls.js';
import { useBuildCrashInsight } from '../../hooks/useBuildCrashInsight.js';
import { getStageConcurrencyWarning } from '../../utils/buildMonitor.js';

type Props = {
  config: BatchConfig;
  draft?: Partial<ShapeEntity> | null;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
  onResetSession?: () => void;
};

export const DownloadConfigSection: React.FC<Props> = ({ config, draft, disabled, onChange, onResetSession }) => {
  const crashInsight = useBuildCrashInsight({
    draft,
    nodeId: draft?.nodeId ? String(draft.nodeId) : undefined,
  });
  const {
    t,
    switchId,
    baseDownloadConfig,
    deleteLabel,
    canDeleteRaw,
    canDeleteStage1,
    canDeleteStage2,
    canDeleteTiles,
    canDeleteMetadata,
    handleDeleteRaw,
    handleDeleteStage,
    handleDeleteTiles,
    handleDeleteMetadata,
    update,
  } = useDownloadConfigSection({ config, draft, disabled, onChange, onResetSession });
  const downloadWarning = getStageConcurrencyWarning(
    crashInsight,
    'download',
    baseDownloadConfig.maxConcurrent,
  );
  const downloadWarningText = downloadWarning
    ? t(
      'processing.download.memoryWarning',
      'Possible memory pressure: {{message}}',
      { message: downloadWarning.message },
    )
    : undefined;

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
              warningText={downloadWarningText}
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
            <DownloadRetentionToggle
              checked={!config?.cleanupConfig?.deleteDownloadedFiles}
              onChange={(retainFiles) => {
                update({
                  cleanupConfig: {
                    ...config.cleanupConfig,
                    deleteDownloadedFiles: !retainFiles,
                  },
                });
              }}
              disabled={disabled}
              switchId={switchId}
              label={t('processing.download.retainFiles', 'Retain downloaded files')}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
            <DownloadCacheActions
              deleteLabel={deleteLabel}
              canDeleteRaw={canDeleteRaw}
              canDeleteStage1={canDeleteStage1}
              canDeleteStage2={canDeleteStage2}
              canDeleteTiles={canDeleteTiles}
              canDeleteMetadata={canDeleteMetadata}
              onDeleteRaw={handleDeleteRaw}
              onDeleteStage={handleDeleteStage}
              onDeleteTiles={handleDeleteTiles}
              onDeleteMetadata={handleDeleteMetadata}
            />
          </Grid>
          <DownloadRetryControls
            baseDownloadConfig={baseDownloadConfig}
            disabled={disabled}
            update={update}
          />
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
