import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../i18n.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { mergeBuildConfig } from '../../../common/types/index.js';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig) => void;
  disabled?: boolean;
};

export const FetchGeometryIntakeGuardCard: React.FC<Props> = ({ config, onChange, disabled }) => {
  const { t } = useTranslation();
  const guard = config.fetchConfig.geometryIntakeGuard;

  const resolvedGuard = {
    validationLevel: guard?.validationLevel ?? 'off',
    dedupeEpsilon: guard?.dedupeEpsilon ?? 0.000001,
    minRingAreaThreshold: guard?.minRingAreaThreshold ?? 0,
    normalizeRingOrientation: guard?.normalizeRingOrientation ?? true,
    keepBaselineSnapshot: guard?.keepBaselineSnapshot ?? true,
  } as const;

  const updateGuard = (partial: Partial<typeof resolvedGuard>) => {
    onChange(mergeBuildConfig(config, {
      fetchConfig: {
        ...config.fetchConfig,
        geometryIntakeGuard: {
          ...resolvedGuard,
          ...partial,
        },
      },
    }));
  };

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CloudDownloadIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.fetch.geometryIntakeGuard.title', 'Fetch Geometry Intake Guard')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={2} sx={{ opacity: disabled ? 0.6 : 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t(
              'processing.fetch.geometryIntakeGuard.description',
              'Normalize and validate fetched geometry before transform to reduce unstable simplification artifacts.',
            )}
          </Typography>
          <FormControl fullWidth disabled={disabled}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('processing.fetch.geometryIntakeGuard.validationLevel', 'Validation Level')}
            </Typography>
            <Select
              size="small"
              value={resolvedGuard.validationLevel}
              onChange={(event) => {
                const value = event.target.value;
                if (value !== 'off' && value !== 'basic' && value !== 'strict') return;
                updateGuard({ validationLevel: value });
              }}
            >
              <MenuItem value="off">{t('processing.fetch.geometryIntakeGuard.level.off', 'off')}</MenuItem>
              <MenuItem value="basic">{t('processing.fetch.geometryIntakeGuard.level.basic', 'basic')}</MenuItem>
              <MenuItem value="strict">{t('processing.fetch.geometryIntakeGuard.level.strict', 'strict')}</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="number"
            label={t('processing.fetch.geometryIntakeGuard.dedupeEpsilon', 'Duplicate vertex epsilon')}
            value={resolvedGuard.dedupeEpsilon}
            disabled={disabled}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (!Number.isFinite(value)) return;
              updateGuard({ dedupeEpsilon: Math.max(0, value) });
            }}
          />
          <TextField
            size="small"
            type="number"
            label={t('processing.fetch.geometryIntakeGuard.minRingAreaThreshold', 'Minimum ring area threshold')}
            value={resolvedGuard.minRingAreaThreshold}
            disabled={disabled}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (!Number.isFinite(value)) return;
              updateGuard({ minRingAreaThreshold: Math.max(0, value) });
            }}
          />
          <FormControlLabel
            control={(
              <Switch
                checked={resolvedGuard.normalizeRingOrientation}
                onChange={(event) => updateGuard({ normalizeRingOrientation: event.target.checked })}
              />
            )}
            disabled={disabled}
            label={t('processing.fetch.geometryIntakeGuard.normalizeRingOrientation', 'Normalize ring orientation')}
          />
          <FormControlLabel
            control={(
              <Switch
                checked={resolvedGuard.keepBaselineSnapshot}
                onChange={(event) => updateGuard({ keepBaselineSnapshot: event.target.checked })}
              />
            )}
            disabled={disabled}
            label={t('processing.fetch.geometryIntakeGuard.keepBaselineSnapshot', 'Keep baseline snapshot for anomaly scoring')}
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
