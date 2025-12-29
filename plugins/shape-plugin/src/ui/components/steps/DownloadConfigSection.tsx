import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControlLabel,
  FormGroup,
  Grid,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { BatchConfig, ShapeEntity } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useDownloadConfigSection } from '../../hooks/useDownloadConfigSection.js';
import type { NodeId } from '@hierarchidb/common-types';
import { DownloadCacheActions } from '../processing/DownloadCacheActions.js';
import { DownloadRetryControls } from '../processing/DownloadRetryControls.js';
import { useBuildCrashInsight } from '../../hooks/useBuildCrashInsight.js';
import { getStageConcurrencyWarning } from '../../utils/buildWarnings.js';

type Props = {
  config: BatchConfig;
  draft?: Partial<ShapeEntity> | null;
  nodeId?: string;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
  onResetSession?: () => void;
};

export const DownloadConfigSection: React.FC<Props> = ({ config, draft, nodeId, disabled, onChange, onResetSession }) => {
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
    handleResetDefaults,
    update,
  } = useDownloadConfigSection({ config, draft, nodeId: nodeId as NodeId | undefined, disabled, onChange, onResetSession });
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
          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'flex-start' }}>
            <Paper variant="outlined" sx={{ p: 2, width: '100%' }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">
                  {t('processing.download.retainTitle', 'Retain intermediate outputs after build')}
                </Typography>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!config?.cleanupConfig?.deleteDownloadedFiles}
                        onChange={(event) => {
                          const retainFiles = event.target.checked;
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
                    label={t('processing.download.retainDownloadedFiles', 'Downloaded files')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!config?.cleanupConfig?.deleteStage1Cache}
                        onChange={(event) => {
                          const retainCache = event.target.checked;
                          update({
                            cleanupConfig: {
                              ...config.cleanupConfig,
                              deleteStage1Cache: !retainCache,
                            },
                          });
                        }}
                        disabled={disabled}
                        inputProps={{
                          id: `${switchId}-retain-stage1-cache`,
                          name: 'retain-stage1-cache',
                        }}
                      />
                    }
                    label={t('processing.download.retainStage1Cache', 'Stage 1 cache')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!config?.cleanupConfig?.deleteStage2Cache}
                        onChange={(event) => {
                          const retainCache = event.target.checked;
                          update({
                            cleanupConfig: {
                              ...config.cleanupConfig,
                              deleteStage2Cache: !retainCache,
                            },
                          });
                        }}
                        disabled={disabled}
                        inputProps={{
                          id: `${switchId}-retain-stage2-cache`,
                          name: 'retain-stage2-cache',
                        }}
                      />
                    }
                    label={t('processing.download.retainStage2Cache', 'Stage 2 cache')}
                  />
                </FormGroup>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
            <Paper variant="outlined" sx={{ p: 2, width: '100%' }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">
                  {t('processing.download.deleteNowTitle', 'Delete build outputs immediately')}
                </Typography>
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
                  onResetDefaults={handleResetDefaults}
                  resetDisabled={disabled}
                />
              </Stack>
            </Paper>
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
