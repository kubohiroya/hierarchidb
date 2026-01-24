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
import { useTranslation } from '../../i18n.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import type { FetchConfig } from '@hierarchidb/gis-sdk';

type Props = {
  baseDownloadConfig: FetchConfig;
  disabled?: boolean;
  update: (partial: Partial<ShapeBuildConfig>) => void;
};

const RETRY_ATTEMPTS_MAX = 5;

export const DownloadRetryControls: React.FC<Props> = ({
  baseDownloadConfig,
  disabled,
  update,
}) => {
  const { t } = useTranslation();
  const retryAttemptsValue = Math.min(baseDownloadConfig.retryAttempts, RETRY_ATTEMPTS_MAX);

  useEffect(() => {
    if (baseDownloadConfig.retryLimit === retryAttemptsValue) return;
    update({
      fetchConfig: {
        ...baseDownloadConfig,
        retryLimit: retryAttemptsValue,
      },
    });
  }, [baseDownloadConfig, retryAttemptsValue, update]);

  const hoverCardSx = disabled
    ? {}
    : {
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme: { shadows: string[] }) => theme.shadows[8],
        },
      };

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
                    update({
                      fetchConfig: {
                        ...baseDownloadConfig,
                        timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : baseDownloadConfig.timeoutMs,
                      },
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
                    update({
                      fetchConfig: {
                        ...baseDownloadConfig,
                        retryDelay: Number.isFinite(retryDelay) ? retryDelay : baseDownloadConfig.retryDelay,
                      },
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
                      update({
                        fetchConfig: {
                          ...baseDownloadConfig,
                          retryAttempts,
                          retryLimit,
                        },
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
                      update({
                        fetchConfig: {
                          ...baseDownloadConfig,
                          retryBackoff,
                        },
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
