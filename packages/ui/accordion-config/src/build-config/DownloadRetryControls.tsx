import {
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Rating,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type { SourceConfig } from '@hierarchidb/gis-sdk';
import { getBuildConfigHoverCardSx } from './buildConfigCardStyles.js';
import { useDownloadRetryControlsView } from './useDownloadRetryControlsView.js';

type TranslateFn = (key: string, fallback?: string, options?: Record<string, unknown>) => string;

export type DownloadRetryConfig = Pick<
  SourceConfig,
  'timeoutMs' | 'retryAttempts' | 'retryDelay' | 'retryLimit' | 'retryBackoff'
>;

type Props = {
  baseRetryConfig: DownloadRetryConfig;
  disabled?: boolean;
  onChange: (next: DownloadRetryConfig) => void;
  t: TranslateFn;
  disableHoverEffect?: boolean;
};

export const DownloadRetryControls: React.FC<Props> = ({
  baseRetryConfig,
  disabled,
  onChange,
  t,
  disableHoverEffect = false,
}) => {
  const {
    retryAttemptsMax,
    retryAttemptsValue,
    updateTimeoutMs,
    updateRetryDelay,
    updateRetryAttempts,
    updateRetryBackoff,
  } = useDownloadRetryControlsView({
    baseRetryConfig,
    onChange,
  });

  const hoverCardSx = disableHoverEffect ? {} : getBuildConfigHoverCardSx(disabled);

  return (
    <>
      <Grid size={{ xs: 12, sm: 12, md: 12, lg: 9 }}>
        <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AccessTimeIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2">
                {t('processing.download.sourceRetryTitle', 'Source Retry')}
              </Typography>
            </Stack>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <TextField
                  label={t('processing.download.timeoutMs', 'Timeout (ms)')}
                  type="number"
                  value={baseRetryConfig.timeoutMs}
                  onChange={(event) => updateTimeoutMs(event.target.value)}
                  fullWidth
                  disabled={disabled}
                  inputProps={{ min: 0 }}
                  helperText={t('processing.download.timeoutHelp', 'Maximum time to wait for each download before failing.')}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <TextField
                  label={t('processing.download.retryDelay', 'Retry Delay (ms)')}
                  type="number"
                  value={baseRetryConfig.retryDelay}
                  onChange={(event) => updateRetryDelay(event.target.value)}
                  fullWidth
                  disabled={disabled}
                  inputProps={{ min: 0 }}
                  helperText={t('processing.download.retryDelayHelp', 'Wait time between retry attempts when a download fails.')}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2">
                    {t('processing.download.retryAttempts', 'Retry Attempts')}
                  </Typography>
                  <Rating
                    value={retryAttemptsValue}
                    onChange={(_, value) => updateRetryAttempts(value)}
                    max={retryAttemptsMax}
                    disabled={disabled}
                    icon={<CheckCircleIcon fontSize="inherit" />}
                    emptyIcon={<RadioButtonUncheckedIcon fontSize="inherit" />}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t('processing.download.retryAttemptsHelp', 'Number of retries per failed download request.')}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <FormControl fullWidth>
                  <InputLabel id="fetch-retry-backoff-label">
                    {t('processing.download.retryBackoff', 'Retry Backoff')}
                  </InputLabel>
                  <Select
                    labelId="fetch-retry-backoff-label"
                    value={baseRetryConfig.retryBackoff}
                    label={t('processing.download.retryBackoff', 'Retry Backoff')}
                    onChange={(event) => updateRetryBackoff(event.target.value as typeof baseRetryConfig.retryBackoff)}
                    disabled={disabled}
                  >
                    <MenuItem value="linear">
                      {t('processing.download.retryBackoffLinear', 'Linear')}
                    </MenuItem>
                    <MenuItem value="exponential">
                      {t('processing.download.retryBackoffExponential', 'Exponential')}
                    </MenuItem>
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t(
                      'processing.download.retryBackoffHelp',
                      'Spacing pattern used between retries.',
                    )}
                  </Typography>
                </FormControl>
              </Grid>
            </Grid>
          </Stack>
        </Paper>
      </Grid>
    </>
  );
};
