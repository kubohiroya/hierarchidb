import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControlLabel,
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
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { DownloadRetryControls } from './DownloadRetryControls.js';
import type { FetchConfigSectionState } from './useFetchConfigSection.ts';

type Props = {
  fetchState: FetchConfigSectionState;
  disabled?: boolean;
};

export const FetchConfigSection: React.FC<Props> = ({ fetchState, disabled }) => {
  const { t, baseFetchConfig, update } = fetchState;

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CloudDownloadIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.download.title', 'Fetch stage settings')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Grid container rowSpacing={2} columnSpacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
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
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">
                  {t('processing.download.stageBehaviorTitle', 'Stage behavior')}
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={baseFetchConfig.deleteOnComplete}
                      onChange={(event) => {
                        update({
                          fetchConfig: {
                            ...baseFetchConfig,
                            deleteOnComplete: event.target.checked,
                          },
                        });
                      }}
                      disabled={disabled}
                    />
                  }
                  label={t(
                    'processing.download.deleteOnComplete',
                    'Delete filtered cache after stage completion',
                  )}
                />
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'processing.download.deleteOnCompleteHelp',
                    'Removes fetch-stage filtered cache automatically once transform begins.',
                  )}
                </Typography>
              </Stack>
            </Paper>
          </Grid>
          <DownloadRetryControls
            baseDownloadConfig={baseFetchConfig}
            disabled={disabled}
            update={update}
          />
          <Grid size={{ xs: 12, md: 2 }} />
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
