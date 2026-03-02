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
import {
  Rule as RuleIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
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

type InvalidGeometryFilterState = {
  area: boolean;
  lineLength: boolean;
  maxEdgeLength: boolean;
  selfIntersection: boolean;
  triangleRingRatio: boolean;
};

type GeometryIntakeGuardState = {
  validationLevel: 'off' | 'basic' | 'strict';
  dedupeEpsilon: number;
  minRingAreaThreshold: number;
  normalizeRingOrientation: boolean;
  keepBaselineSnapshot: boolean;
};

const resolveGeometryIntakeGuard = (config: ShapeBuildConfig): GeometryIntakeGuardState => {
  const guard = config.sourceConfig.geometryIntakeGuard;
  return {
    validationLevel: guard?.validationLevel ?? 'off',
    dedupeEpsilon: guard?.dedupeEpsilon ?? 0.000001,
    minRingAreaThreshold: guard?.minRingAreaThreshold ?? 0,
    normalizeRingOrientation: guard?.normalizeRingOrientation ?? true,
    keepBaselineSnapshot: guard?.keepBaselineSnapshot ?? true,
  };
};

const resolveInvalidGeometryFilter = (config: ShapeBuildConfig): InvalidGeometryFilterState => ({
  area: config.tileEmitConfig.invalidGeometryFilter?.area ?? false,
  lineLength: config.tileEmitConfig.invalidGeometryFilter?.lineLength ?? false,
  maxEdgeLength: config.tileEmitConfig.invalidGeometryFilter?.maxEdgeLength ?? false,
  selfIntersection: config.tileEmitConfig.invalidGeometryFilter?.selfIntersection ?? false,
  triangleRingRatio: config.tileEmitConfig.invalidGeometryFilter?.triangleRingRatio ?? false,
});

export const SourceGeometryIntakeGuardCard: React.FC<Props> = ({
  config,
  onChange,
  disableHoverLift = false,
}) => {
  const { t } = useTranslation();
  const guardCardDisabled = true;
  const hoverCardSx = getBuildConfigHoverCardSx(guardCardDisabled, disableHoverLift);
  const resolvedGuard = useMemo(() => resolveGeometryIntakeGuard(config), [config]);

  const updateGuard = useCallback((partial: Partial<GeometryIntakeGuardState>): void => {
    onChange((prevConfig) => {
      const current = resolveGeometryIntakeGuard(prevConfig);
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
  }, [onChange]);

  const isDisabled = true;

  return (
    <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
      <Stack spacing={1.5} sx={{ opacity: guardCardDisabled ? 0.6 : 1 }}>
        <BuildConfigSectionTitle
          icon={<SecurityIcon fontSize="small" color="primary" />}
          title={t('processing.source.geometryIntakeGuard.title', 'Geometry intake guard')}
        />
        <Typography variant="body2" color="text.secondary">
          {t(
            'processing.source.geometryIntakeGuard.description',
            'Configure normalization and strictness for source geometry intake checks.',
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(
            'processing.source.geometryIntakeGuard.comingSoon',
            'This guard is reserved for a future implementation. Editing is currently disabled.',
          )}
        </Typography>

        <Grid container spacing={1.5} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth disabled>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t('processing.source.geometryIntakeGuard.validationLevel', 'Validation Level')}
              </Typography>
              <ToggleButtonGroup
                size="small"
                fullWidth
                exclusive
                disabled
                value={resolvedGuard.validationLevel}
                onChange={(_event, value) => {
                  if (value === null) return;
                  if (value !== 'off' && value !== 'basic' && value !== 'strict') return;
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
              disabled
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
              disabled
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateGuard({ minRingAreaThreshold: Math.max(0, value) });
              }}
            />
          </Grid>
        </Grid>

        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControlLabel
              control={<Switch checked={resolvedGuard.normalizeRingOrientation} onChange={(event) => updateGuard({ normalizeRingOrientation: event.target.checked })} />}
              disabled={isDisabled}
              label={t('processing.source.geometryIntakeGuard.normalizeRingOrientation', 'Normalize ring orientation')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControlLabel
              control={<Switch checked={resolvedGuard.keepBaselineSnapshot} onChange={(event) => updateGuard({ keepBaselineSnapshot: event.target.checked })} />}
              disabled={isDisabled}
              label={t('processing.source.geometryIntakeGuard.keepBaselineSnapshot', 'Keep baseline snapshot for anomaly scoring')}
            />
          </Grid>
        </Grid>
      </Stack>
    </Paper>
  );
};

export const TileEmitInvalidGeometryFilterCard: React.FC<Props> = ({
  config,
  onChange,
  disabled,
  disableHoverLift = false,
}) => {
  const { t } = useTranslation();
  const hoverCardSx = getBuildConfigHoverCardSx(disabled, disableHoverLift);
  const resolved = useMemo(() => resolveInvalidGeometryFilter(config), [config]);

  const updateFilter = useCallback((partial: Partial<InvalidGeometryFilterState>): void => {
    onChange((prevConfig) => {
      const current = resolveInvalidGeometryFilter(prevConfig);
      return applyBuildConfigPatch(prevConfig, {
        tileEmitConfig: {
          ...prevConfig.tileEmitConfig,
          invalidGeometryFilter: {
            ...current,
            ...partial,
          },
        },
      });
    });
  }, [onChange]);

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
        checked: resolved.selfIntersection,
        disabled: isDisabled,
        label: t('processing.tileEmit.invalidGeometryFilter.selfIntersection', 'Self intersection'),
        onChange: (event) => updateFilter({ selfIntersection: event.target.checked }),
      },
      {
        checked: resolved.triangleRingRatio,
        disabled: isDisabled,
        label: t('processing.tileEmit.invalidGeometryFilter.triangleRingRatio', 'Triangle ring ratio'),
        onChange: (event) => updateFilter({ triangleRingRatio: event.target.checked }),
      },
    ],
    [
      {
        checked: resolved.area,
        disabled: isDisabled,
        label: t('processing.tileEmit.invalidGeometryFilter.area', 'Area'),
        onChange: (event) => updateFilter({ area: event.target.checked }),
      },
      {
        checked: resolved.lineLength,
        disabled: isDisabled,
        label: t('processing.tileEmit.invalidGeometryFilter.lineLength', 'Line length'),
        onChange: (event) => updateFilter({ lineLength: event.target.checked }),
      },
      {
        checked: resolved.maxEdgeLength,
        disabled: isDisabled,
        label: t('processing.tileEmit.invalidGeometryFilter.maxEdgeLength', 'Max edge length'),
        onChange: (event) => updateFilter({ maxEdgeLength: event.target.checked }),
      },
    ],
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
      <Stack spacing={1.5} sx={{ opacity: disabled ? 0.6 : 1 }}>
        <BuildConfigSectionTitle
          icon={<RuleIcon fontSize="small" color="primary" />}
          title={t('processing.tileEmit.invalidGeometryFilter.title', 'Invalid geometry filtering')}
        />
        <Typography variant="body2" color="text.secondary">
          {t(
            'processing.tileEmit.invalidGeometryFilter.description',
            'Run additional invalid-shape checks in the TileEmit-stage filtering pipeline.',
          )}
        </Typography>

        <Grid container spacing={1.5}>
          {switchGroups.map((group, groupIndex) => (
            <Grid size={{ xs: 12, md: 6 }} key={`switch-group-${String(groupIndex)}`}>
              <Stack spacing={0.75}>
                {group.map((item) => (
                  <FormControlLabel
                    key={item.label}
                    control={<Switch checked={item.checked} onChange={item.onChange} />}
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
