import { Accordion, AccordionDetails, AccordionSummary, Grid, Stack, Typography, Chip } from '@mui/material';
import { CloudDownload as CloudDownloadIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type { DownloadProcessingConfig, ProcessingConfig } from '../../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../../common/types/index.js';
import { WorkerSliderCard } from './WorkerSliderCard.js';

type Props = {
  config: ProcessingConfig;
  disabled?: boolean;
  onChange: (next: ProcessingConfig) => void;
};

export const DownloadConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const baseDownloadConfig: DownloadProcessingConfig =
    config.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig!;

  const update = (partial: Partial<ProcessingConfig>) => {
    onChange(mergeProcessingConfig({ ...config, ...partial }));
  };

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CloudDownloadIcon color="primary" />
          <Typography variant="subtitle1">Download Configuration</Typography>
          <Chip
            label={`${config.downloadConfig?.maxConcurrent ?? 2} concurrent`}
            size="small"
            variant="outlined"
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <WorkerSliderCard
              title="Concurrent Downloads"
              value={baseDownloadConfig.maxConcurrent ?? 2}
              onChange={(maxConcurrent) =>
                update({
                  downloadConfig: {
                    ...baseDownloadConfig,
                    maxConcurrent,
                  },
                })
              }
              min={1}
              max={8}
              step={1}
              disabled={disabled}
            />
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
