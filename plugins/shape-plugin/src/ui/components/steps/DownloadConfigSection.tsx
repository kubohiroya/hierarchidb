import { Accordion, AccordionDetails, AccordionSummary, Grid, Stack, Typography, FormControlLabel, Switch, Button } from '@mui/material';
import { CloudDownload as CloudDownloadIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type { DownloadProcessingConfig, ProcessingConfig, ShapeDraft } from '../../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useId } from 'react';

type Props = {
  config: ProcessingConfig;
  draft?: Partial<ShapeDraft['draftData']> | null;
  disabled?: boolean;
  onChange: (next: ProcessingConfig) => void;
};

export const DownloadConfigSection: React.FC<Props> = ({ config, draft, disabled, onChange }) => {
  const switchId = useId();
  const baseDownloadConfig: DownloadProcessingConfig|undefined =
    config.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig;
  const downloadedFilesCount = draft?.urlMetadata?.length ?? 0;
  const deleteLabel = downloadedFilesCount > 0
    ? `Delete Downloaded Files (${downloadedFilesCount} files)`
    : 'Delete Downloaded Files';

  const update = (partial: Partial<ProcessingConfig>) => {
    onChange(mergeProcessingConfig({ ...config, ...partial }));
  };

  if(! baseDownloadConfig){
    throw new Error("DownloadConfigSection: baseDownloadConfig is not defined");
  }

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CloudDownloadIcon color="primary" />
          <Typography variant="subtitle1">Download Setting</Typography>
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
            <Button
              variant="outlined"
              color="error"
              disabled={disabled || downloadedFilesCount === 0}
              onClick={() => {}}
            >
              {deleteLabel}
            </Button>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
