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

export const DownloadRetryControls: React.FC<Props> = ({
  baseDownloadConfig,
  disabled,
  update,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Grid size={{ xs: 12, sm: 4 }}>
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
      <Grid size={{ xs: 12, sm: 4 }}>
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
      <Grid size={{ xs: 12, sm: 4 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">
            {t('processing.download.retryAttempts', 'Retry Attempts')}
          </Typography>
          <Rating
            value={baseDownloadConfig.retryAttempts}
            onChange={(_, value) => {
              const retryAttempts = value === null ? baseDownloadConfig.retryAttempts : value;
              update({
                fetchConfig: {
                  ...baseDownloadConfig,
                  retryAttempts,
                  retryLimit: retryAttempts,
                },
              });
            }}
            max={10}
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
