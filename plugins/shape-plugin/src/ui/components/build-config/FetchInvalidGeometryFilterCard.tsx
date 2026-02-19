import {
  FormControl,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { Rule as RuleIcon } from '@mui/icons-material';
import { BuildConfigSectionTitle, getBuildConfigHoverCardSx } from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '~/ui/i18n';
import type { ShapeBuildConfig } from '~/common/types/index';
import { mergeBuildConfig } from '~/common/types/index';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig) => void;
  disabled?: boolean;
};

export const FetchInvalidGeometryFilterCard: React.FC<Props> = ({ config, onChange, disabled }) => {
  const { t } = useTranslation();
  const hoverCardSx = getBuildConfigHoverCardSx(disabled);
  const guard = config.fetchConfig.geometryIntakeGuard;

  const resolved = {
    area: config.fetchConfig.invalidGeometryFilter?.area ?? false,
    lineLength: config.fetchConfig.invalidGeometryFilter?.lineLength ?? false,
    maxEdgeLength: config.fetchConfig.invalidGeometryFilter?.maxEdgeLength ?? false,
    selfIntersection: config.fetchConfig.invalidGeometryFilter?.selfIntersection ?? false,
    triangleRingRatio: config.fetchConfig.invalidGeometryFilter?.triangleRingRatio ?? false,
  } as const;
  const resolvedGuard = {
    validationLevel: guard?.validationLevel ?? 'off',
    dedupeEpsilon: guard?.dedupeEpsilon ?? 0.000001,
    minRingAreaThreshold: guard?.minRingAreaThreshold ?? 0,
    normalizeRingOrientation: guard?.normalizeRingOrientation ?? true,
    keepBaselineSnapshot: guard?.keepBaselineSnapshot ?? true,
  } as const;

  const updateFilter = (partial: Partial<typeof resolved>): void => {
    onChange(mergeBuildConfig(config, {
      fetchConfig: {
        ...config.fetchConfig,
        invalidGeometryFilter: {
          ...resolved,
          ...partial,
        },
      },
    }));
  };
  const updateGuard = (partial: Partial<typeof resolvedGuard>): void => {
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
    <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
      <Stack spacing={1.5} sx={{ opacity: disabled ? 0.6 : 1 }}>
        <BuildConfigSectionTitle
          icon={<RuleIcon fontSize="small" color="primary" />}
          title={t('processing.fetch.invalidGeometryFilter.title', 'Invalid geometry filtering')}
        />
        <Typography variant="body2" color="text.secondary">
          {t(
            'processing.fetch.invalidGeometryFilter.description',
            'Run additional invalid-shape checks after small-shape filtering.',
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
        <FormControlLabel
          control={(
            <Switch
              checked={resolved.area}
              onChange={(event) => updateFilter({ area: event.target.checked })}
            />
          )}
          disabled={disabled}
          label={t('processing.fetch.invalidGeometryFilter.area', 'Area')}
        />
        <FormControlLabel
          control={(
            <Switch
              checked={resolved.lineLength}
              onChange={(event) => updateFilter({ lineLength: event.target.checked })}
            />
          )}
          disabled={disabled}
          label={t('processing.fetch.invalidGeometryFilter.lineLength', 'Line length')}
        />
        <FormControlLabel
          control={(
            <Switch
              checked={resolved.maxEdgeLength}
              onChange={(event) => updateFilter({ maxEdgeLength: event.target.checked })}
            />
          )}
          disabled={disabled}
          label={t('processing.fetch.invalidGeometryFilter.maxEdgeLength', 'Max edge length')}
        />
        <FormControlLabel
          control={(
            <Switch
              checked={resolved.selfIntersection}
              onChange={(event) => updateFilter({ selfIntersection: event.target.checked })}
            />
          )}
          disabled={disabled}
          label={t('processing.fetch.invalidGeometryFilter.selfIntersection', 'Self intersection')}
        />
        <FormControlLabel
          control={(
            <Switch
              checked={resolved.triangleRingRatio}
              onChange={(event) => updateFilter({ triangleRingRatio: event.target.checked })}
            />
          )}
          disabled={disabled}
          label={t('processing.fetch.invalidGeometryFilter.triangleRingRatio', 'Triangle ring ratio')}
        />
      </Stack>
    </Paper>
  );
};
