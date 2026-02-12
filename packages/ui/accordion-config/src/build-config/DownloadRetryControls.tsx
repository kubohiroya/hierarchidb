import { useEffect } from 'react';
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
import type { FetchConfig } from '@hierarchidb/gis-sdk';
import { getBuildConfigHoverCardSx } from './buildConfigCardStyles.js';

type TranslateFn = (key: string, fallback?: string, options?: Record<string, unknown>) => string;

export type DownloadRetryConfig = Pick<
  FetchConfig,
  'timeoutMs' | 'retryAttempts' | 'retryDelay' | 'retryLimit' | 'retryBackoff'
>;

type Props = {
  baseRetryConfig: DownloadRetryConfig;
  disabled?: boolean;
  onChange: (next: DownloadRetryConfig) => void;
  t: TranslateFn;
  disableHoverEffect?: boolean;
};

const RETRY_ATTEMPTS_MAX = 8;

export const DownloadRetryControls: React.FC<Props> = ({
  baseRetryConfig,
  disabled,
  onChange,
  t,
  disableHoverEffect = false,
}) => {
  const retryAttemptsValue = Math.min(baseRetryConfig.retryAttempts, RETRY_ATTEMPTS_MAX);

  useEffect(() => {
    if (baseRetryConfig.retryLimit === retryAttemptsValue) return;
    onChange({
      ...baseRetryConfig,
      retryLimit: retryAttemptsValue,
    });
  }, [baseRetryConfig, onChange, retryAttemptsValue]);

  const hoverCardSx = disableHoverEffect ? {} : getBuildConfigHoverCardSx(disabled);

  return (
    <>
      <Grid size={{ xs: 12, sm: 12, md: 12, lg: 9 }}>
        <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AccessTimeIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2">
                {t('processing.download.fetchRetryTitle', 'Fetch Retry')}
              </Typography>
            </Stack>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <TextField
                  label={t('processing.download.timeoutMs', 'Timeout (ms)')}
                  type="number"
                  value={baseRetryConfig.timeoutMs}
                  onChange={(event) => {
                    const timeoutMs = Number(event.target.value);
                    onChange({
                      ...baseRetryConfig,
                      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : baseRetryConfig.timeoutMs,
                    });
                  }}
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
                  onChange={(event) => {
                    const retryDelay = Number(event.target.value);
                    onChange({
                      ...baseRetryConfig,
                      retryDelay: Number.isFinite(retryDelay) ? retryDelay : baseRetryConfig.retryDelay,
                    });
                  }}
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
                    onChange={(_, value) => {
                      const nextValue = value === null ? retryAttemptsValue : value;
                      const retryAttempts = Math.min(nextValue, RETRY_ATTEMPTS_MAX);
                      const retryLimit = Math.min(baseRetryConfig.retryLimit, retryAttempts);
                      onChange({
                        ...baseRetryConfig,
                        retryAttempts,
                        retryLimit,
                      });
                    }}
                    max={RETRY_ATTEMPTS_MAX}
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
                    onChange={(event) => {
                      const retryBackoff = event.target.value as typeof baseRetryConfig.retryBackoff;
                      onChange({
                        ...baseRetryConfig,
                        retryBackoff,
                      });
                    }}
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
