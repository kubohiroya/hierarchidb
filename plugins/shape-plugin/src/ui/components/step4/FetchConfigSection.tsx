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
            {t('processing.download.title', 'Fetch Settings / Cache Management')}
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
