import { Grid, Rating, Stack, TextField, Typography } from '@mui/material';
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

  return (
    <>
      <Grid size={{ xs: 12, md: 2 }}>
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
      <Grid size={{ xs: 12, md: 2 }}>
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
      <Grid size={{ xs: 12, md: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">
            {t('processing.download.retryAttempts', 'Retry Attempts')}
          </Typography>
          <Rating
            value={retryAttemptsValue}
            onChange={(_, value) => {
              const nextValue = value === null ? retryAttemptsValue : value;
              const retryAttempts = Math.min(nextValue, RETRY_ATTEMPTS_MAX);
              update({
                fetchConfig: {
                  ...baseDownloadConfig,
                  retryAttempts,
                  retryLimit: retryAttempts,
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
    </>
  );
};
