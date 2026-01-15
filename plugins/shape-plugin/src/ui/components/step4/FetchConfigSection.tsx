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
import type { ShapeEntity } from '../../../common/types/ShapeEntity.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useFetchConfigSection } from './useFetchConfigSection.ts';
import { FetchConfigFormControls } from './FetchConfigFormControls.tsx';
import { DownloadRetryControls } from './DownloadRetryControls.js';
import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Props = {
  config: ShapeBuildConfig;
  draft: Partial<ShapeEntity>;
  nodeId: NodeId;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
  onResetSession?: () => void;
};

export const FetchConfigSection: React.FC<Props> = ({ config, draft, nodeId, disabled, onChange, onResetSession }) => {
  const {
    t,
    switchId,
    baseFetchConfig,
    deleteFetchLabel,
    deleteTransformFilterLabel,
    deleteTransformPreprocessLabel,
    deleteVTLabel,
    deleteMetadataLabel,
    countsLoading,
    canDeleteFetchCache,
    canDeleteTransformCache,
    canDeleteTransformByZoomCache,
    canDeleteVTCache,
    canDeleteMetadata,
    handleDeleteFetchCache,
    handleDeleteTransformCache,
    handleDeleteTransformByZoomCache,
    handleDeleteVTCache,
    handleDeleteMetadata,
    handleResetDefaults,
    update,
  } = useFetchConfigSection({ config, draft, nodeId, disabled, onChange, onResetSession });

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CloudDownloadIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.download.title', 'Fetch Settings / Cache Management')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <WorkerNumberConfigCard
              title={t('processing.download.workers', 'Concurrent Fetch Workers')}
              value={baseFetchConfig.maxConcurrent}
              icon={<CloudDownloadIcon fontSize="small" color="primary" />}
              helperText={t('processing.download.workersHelp', 'Controls how many fetches run in parallel.')}
              warningText={undefined}
              onChange={(maxConcurrent) =>
                update({
                  fetchConfig: {
                    ...baseFetchConfig,
                    maxConcurrent,
                  },
                })
              }
              min={1}
              max={4}
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
                        checked={!config.cleanupConfig?.deleteFetchCeche}
                        onChange={(event) => {
                          const retainFiles = event.target.checked;
                          update({
                            cleanupConfig: {
                              ...config.cleanupConfig,
                              deleteFetchCeche: !retainFiles,
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
                    label={t('processing.download.retainDownloadedFiles', 'Fetch cache')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!config.cleanupConfig?.deleteTransformByBandCache}
                        onChange={(event) => {
                          const retainCache = event.target.checked;
                          update({
                            cleanupConfig: {
                              ...config.cleanupConfig,
                              deleteTransformByBandCache: !retainCache,
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
                    label={t('processing.download.retainStage1Cache', 'Transform cache (filtering)')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!config.cleanupConfig?.deleteTransformByZoomCache}
                        onChange={(event) => {
                          const retainCache = event.target.checked;
                          update({
                            cleanupConfig: {
                              ...config.cleanupConfig,
                              deleteTransformByZoomCache: !retainCache,
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
                    label={t('processing.download.retainStage2Cache', 'Transform cache (preprocessing)')}
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
                <FetchConfigFormControls
                  deleteFetchLabel={deleteFetchLabel}
                  deleteTransformFilterLabel={deleteTransformFilterLabel}
                  deleteTransformPreprocessLabel={deleteTransformPreprocessLabel}
                  deleteVTLabel={deleteVTLabel}
                  deleteMetadataLabel={deleteMetadataLabel}
                  countsLoading={countsLoading}
                  canDeleteFetchCache={canDeleteFetchCache}
                  canDeleteTransformCache={canDeleteTransformCache}
                  canDeleteTransformByZoomCache={canDeleteTransformByZoomCache}
                  canDeleteVTCache={canDeleteVTCache}
                  canDeleteMetadata={canDeleteMetadata}
                  onDeleteFetchCache={handleDeleteFetchCache}
                  onDeleteTransformCache={handleDeleteTransformCache}
                  onDeleteTransformByZoomCache={handleDeleteTransformByZoomCache}
                  onDeleteVTCache={handleDeleteVTCache}
                  onDeleteMetadata={handleDeleteMetadata}
                  onResetDefaults={handleResetDefaults}
                  resetDisabled={disabled}
                />
              </Stack>
            </Paper>
          </Grid>
          <DownloadRetryControls
            baseDownloadConfig={baseFetchConfig}
            disabled={disabled}
            update={update}
          />
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
