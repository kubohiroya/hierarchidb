import {
  FormControl,
  FormControlLabel,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { Rule as RuleIcon } from '@mui/icons-material';
import { BuildConfigSectionTitle, getBuildConfigHoverCardSx } from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '~/ui/i18n';
import type { ShapeBuildConfig } from '~/common/types/index';
import { applyBuildConfigPatch } from '~/common/types/index';
import type { ChangeEvent } from 'react';
import { useCallback, useMemo } from 'react';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  disabled?: boolean;
  disableHoverLift?: boolean;
};

export const SourceInvalidGeometryFilterCard: React.FC<Props> = ({
  config,
  onChange,
  disabled,
  disableHoverLift = false,
}) => {
  const { t } = useTranslation();
  const hoverCardSx = getBuildConfigHoverCardSx(disabled, disableHoverLift);
  const guard = config.sourceConfig.geometryIntakeGuard;

  const resolved = useMemo(()=>({
    area: config.sourceConfig.invalidGeometryFilter?.area ?? false,
    lineLength: config.sourceConfig.invalidGeometryFilter?.lineLength ?? false,
    maxEdgeLength: config.sourceConfig.invalidGeometryFilter?.maxEdgeLength ?? false,
    selfIntersection: config.sourceConfig.invalidGeometryFilter?.selfIntersection ?? false,
    triangleRingRatio: config.sourceConfig.invalidGeometryFilter?.triangleRingRatio ?? false,
  } as const),[config.sourceConfig.invalidGeometryFilter?.area, config.sourceConfig.invalidGeometryFilter?.lineLength, config.sourceConfig.invalidGeometryFilter?.maxEdgeLength, config.sourceConfig.invalidGeometryFilter?.selfIntersection, config.sourceConfig.invalidGeometryFilter?.triangleRingRatio]);
  const resolvedGuard = useMemo(()=>({
    validationLevel: guard?.validationLevel ?? 'off',
    dedupeEpsilon: guard?.dedupeEpsilon ?? 0.000001,
    minRingAreaThreshold: guard?.minRingAreaThreshold ?? 0,
    normalizeRingOrientation: guard?.normalizeRingOrientation ?? true,
    keepBaselineSnapshot: guard?.keepBaselineSnapshot ?? true,
  } as const),[
    guard?.validationLevel, guard?.dedupeEpsilon, guard?.minRingAreaThreshold, guard?.normalizeRingOrientation, guard?.keepBaselineSnapshot
  ]);

  const updateFilter = useCallback((partial: Partial<typeof resolved>): void => {
    onChange((prevConfig) => {
      const current = prevConfig.sourceConfig.invalidGeometryFilter ?? resolved;
      return applyBuildConfigPatch(prevConfig, {
        sourceConfig: {
          ...prevConfig.sourceConfig,
          invalidGeometryFilter: {
            ...current,
            ...partial,
          },
        },
      });
    });
  }, [onChange, resolved]);
  const updateGuard = useCallback((partial: Partial<typeof resolvedGuard>): void => {
    onChange((prevConfig) => {
      const current = prevConfig.sourceConfig.geometryIntakeGuard ?? resolvedGuard;
      return applyBuildConfigPatch(prevConfig, {
        sourceConfig: {
          ...prevConfig.sourceConfig,
          geometryIntakeGuard: {
            ...current,
            ...partial,
          },
        },
      });
    });
  }, [onChange, resolvedGuard]);
  type SwitchItem = {
    checked: boolean;
    disabled: boolean;
    label: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  };
  const isDisabled = Boolean(disabled);
  const switchGroups: Array<Array<SwitchItem>> = [
    [
      {
        checked: resolvedGuard.normalizeRingOrientation,
        disabled: isDisabled,
        label: t('processing.source.geometryIntakeGuard.normalizeRingOrientation', 'Normalize ring orientation'),
        onChange: (event) => updateGuard({ normalizeRingOrientation: event.target.checked }),
      },
      {
        checked: resolvedGuard.keepBaselineSnapshot,
        disabled: isDisabled,
        label: t('processing.source.geometryIntakeGuard.keepBaselineSnapshot', 'Keep baseline snapshot for anomaly scoring'),
        onChange: (event) => updateGuard({ keepBaselineSnapshot: event.target.checked }),
      },
    ],
    [
      {
        checked: resolved.selfIntersection,
        disabled: isDisabled,
        label: t('processing.source.invalidGeometryFilter.selfIntersection', 'Self intersection'),
        onChange: (event) => updateFilter({ selfIntersection: event.target.checked }),
      },
      {
        checked: resolved.triangleRingRatio,
        disabled: isDisabled,
        label: t('processing.source.invalidGeometryFilter.triangleRingRatio', 'Triangle ring ratio'),
        onChange: (event) => updateFilter({ triangleRingRatio: event.target.checked }),
      },
    ],
    [
      {
        checked: resolved.area,
        disabled: isDisabled,
        label: t('processing.source.invalidGeometryFilter.area', 'Area'),
        onChange: (event) => updateFilter({ area: event.target.checked }),
      },
      {
        checked: resolved.lineLength,
        disabled: isDisabled,
        label: t('processing.source.invalidGeometryFilter.lineLength', 'Line length'),
        onChange: (event) => updateFilter({ lineLength: event.target.checked }),
      },
      {
        checked: resolved.maxEdgeLength,
        disabled: isDisabled,
        label: t('processing.source.invalidGeometryFilter.maxEdgeLength', 'Max edge length'),
        onChange: (event) => updateFilter({ maxEdgeLength: event.target.checked }),
      },
    ],
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
      <Stack spacing={1.5} sx={{ opacity: disabled ? 0.6 : 1 }}>
        <BuildConfigSectionTitle
          icon={<RuleIcon fontSize="small" color="primary" />}
          title={t('processing.source.invalidGeometryFilter.title', 'Invalid geometry filtering')}
        />
        <Typography variant="body2" color="text.secondary">
          {t(
            'processing.source.invalidGeometryFilter.description',
            'Run additional invalid-shape checks after small-shape filtering.',
          )}
        </Typography>
        <Grid container spacing={1.5} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth disabled={disabled}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t('processing.source.geometryIntakeGuard.validationLevel', 'Validation Level')}
              </Typography>
              <ToggleButtonGroup
                size="small"
                fullWidth
                exclusive
                value={resolvedGuard.validationLevel}
                onChange={(_event, value) => {
                  if (value === null) {
                    return;
                  }
                  if (value !== 'off' && value !== 'basic' && value !== 'strict') {
                    return;
                  }
                  updateGuard({ validationLevel: value });
                }}
              >
                <ToggleButton value="off">{t('processing.source.geometryIntakeGuard.level.off', 'off')}</ToggleButton>
                <ToggleButton value="basic">{t('processing.source.geometryIntakeGuard.level.basic', 'basic')}</ToggleButton>
                <ToggleButton value="strict">{t('processing.source.geometryIntakeGuard.level.strict', 'strict')}</ToggleButton>
              </ToggleButtonGroup>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              size="small"
              type="number"
              label={t('processing.source.geometryIntakeGuard.dedupeEpsilon', 'Duplicate vertex epsilon')}
              value={resolvedGuard.dedupeEpsilon}
              disabled={disabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateGuard({ dedupeEpsilon: Math.max(0, value) });
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              size="small"
              type="number"
              label={t('processing.source.geometryIntakeGuard.minRingAreaThreshold', 'Minimum ring area threshold')}
              value={resolvedGuard.minRingAreaThreshold}
              disabled={disabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateGuard({ minRingAreaThreshold: Math.max(0, value) });
              }}
            />
          </Grid>
        </Grid>
        <Grid container spacing={1.5}>
          {switchGroups.map((group, groupIndex) => (
            <Grid size={{ xs: 12, md: 4 }} key={`switch-group-${String(groupIndex)}`}>
              <Stack spacing={0.75}>
                {group.map((item) => (
                  <FormControlLabel
                    key={item.label}
                    control={(
                      <Switch checked={item.checked} onChange={item.onChange} />
                    )}
                    disabled={item.disabled}
                    label={item.label}
                  />
                ))}
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Paper>
  );
};
