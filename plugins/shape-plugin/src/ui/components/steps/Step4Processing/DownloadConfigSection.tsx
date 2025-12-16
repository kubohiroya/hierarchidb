import { Accordion, AccordionDetails, AccordionSummary, Grid, Slider, Stack, TextField, Typography, Chip } from '@mui/material';
import { CloudDownload as CloudDownloadIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type { DownloadProcessingConfig, ProcessingConfig } from '../../../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../../../common/types/index.js';
import { useId } from 'react';

type Props = {
  config: ProcessingConfig;
  disabled?: boolean;
  onChange: (next: ProcessingConfig) => void;
};

export const DownloadConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const fieldId = useId();

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
      <AccordionDetails>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography gutterBottom>Concurrent Downloads</Typography>
            <Slider
              value={baseDownloadConfig.maxConcurrent ?? 2}
              onChange={(_, value) => {
                const maxConcurrent = value as number;
                update({
                  downloadConfig: {
                    ...baseDownloadConfig,
                    maxConcurrent,
                  },
                });
              }}
              min={1}
              max={8}
              step={1}
              marks={[
                { value: 1, label: '1' },
                { value: 4, label: '4' },
                { value: 8, label: '8' },
              ]}
              valueLabelDisplay="auto"
              disabled={disabled}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="CORS Proxy Base URL"
              id={`${fieldId}-cors-proxy-url`}
              name="cors-proxy-url"
              value={baseDownloadConfig.corsProxyUrl || ''}
              onChange={(e) => {
                const corsProxyUrl = e.target.value;
                update({
                  downloadConfig: {
                    ...baseDownloadConfig,
                    corsProxyUrl,
                  },
                });
              }}
              fullWidth
              disabled={disabled}
              placeholder="https://cors-anywhere.herokuapp.com/"
              helperText="Optional proxy for cross-origin requests"
              inputProps={{ id: `${fieldId}-cors-proxy-url`, name: 'cors-proxy-url' }}
            />
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
