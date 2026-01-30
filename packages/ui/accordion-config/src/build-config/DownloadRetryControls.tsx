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

type Props = {
  baseDownloadConfig: FetchConfig;
  disabled?: boolean;
  onChange: (next: FetchConfig) => void;
  t: TranslateFn;
};

const RETRY_ATTEMPTS_MAX = 5;

export const DownloadRetryControls: React.FC<Props> = ({
  baseDownloadConfig,
  disabled,
  onChange,
  t,
}) => {
  const retryAttemptsValue = Math.min(baseDownloadConfig.retryAttempts, RETRY_ATTEMPTS_MAX);

  useEffect(() => {
    if (baseDownloadConfig.retryLimit === retryAttemptsValue) return;
    onChange({
      ...baseDownloadConfig,
      retryLimit: retryAttemptsValue,
    });
  }, [baseDownloadConfig, onChange, retryAttemptsValue]);

  const hoverCardSx = getBuildConfigHoverCardSx(disabled);

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
                  value={baseDownloadConfig.timeoutMs}
                  onChange={(event) => {
                    const timeoutMs = Number(event.target.value);
                    onChange({
                      ...baseDownloadConfig,
                      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : baseDownloadConfig.timeoutMs,
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
                  value={baseDownloadConfig.retryDelay}
                  onChange={(event) => {
                    const retryDelay = Number(event.target.value);
                    onChange({
                      ...baseDownloadConfig,
                      retryDelay: Number.isFinite(retryDelay) ? retryDelay : baseDownloadConfig.retryDelay,
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
                      const retryLimit = Math.min(baseDownloadConfig.retryLimit, retryAttempts);
                      onChange({
                        ...baseDownloadConfig,
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
                    value={baseDownloadConfig.retryBackoff}
                    label={t('processing.download.retryBackoff', 'Retry Backoff')}
                    onChange={(event) => {
                      const retryBackoff = event.target.value as typeof baseDownloadConfig.retryBackoff;
                      onChange({
                        ...baseDownloadConfig,
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
