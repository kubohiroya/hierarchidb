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
import { useTranslation } from '@hierarchidb/ui-i18n';
import type { ShapeBuildConfig } from '~/common/types/index';
import {
  useSourceGeometryIntakeGuardCardView,
  useTileEmitInvalidGeometryFilterCardView,
} from './useSourceInvalidGeometryFilterCardView.js';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  disabled?: boolean;
  disableHoverLift?: boolean;
};

export const SourceGeometryIntakeGuardCard: React.FC<Props> = ({
  config,
  onChange,
  disableHoverLift = false,
}) => {
  const { t } = useTranslation('shape-plugin');
  const guardCardDisabled = true;
  const hoverCardSx = getBuildConfigHoverCardSx(guardCardDisabled, disableHoverLift);
  const {
    resolvedGuard,
    handleValidationLevelChange,
    handleDedupeEpsilonChange,
    handleMinRingAreaThresholdChange,
    handleNormalizeRingOrientationChange,
    handleKeepBaselineSnapshotChange,
  } = useSourceGeometryIntakeGuardCardView(config, onChange);

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
                onChange={handleValidationLevelChange}
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
              onChange={handleDedupeEpsilonChange}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              size="small"
              type="number"
              label={t('processing.source.geometryIntakeGuard.minRingAreaThreshold', 'Minimum ring area threshold')}
              value={resolvedGuard.minRingAreaThreshold}
              disabled
              onChange={handleMinRingAreaThresholdChange}
            />
          </Grid>
        </Grid>

        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControlLabel
              control={<Switch checked={resolvedGuard.normalizeRingOrientation} onChange={handleNormalizeRingOrientationChange} />}
              disabled={isDisabled}
              label={t('processing.source.geometryIntakeGuard.normalizeRingOrientation', 'Normalize ring orientation')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControlLabel
              control={<Switch checked={resolvedGuard.keepBaselineSnapshot} onChange={handleKeepBaselineSnapshotChange} />}
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
  const { t } = useTranslation('shape-plugin');
  const hoverCardSx = getBuildConfigHoverCardSx(disabled, disableHoverLift);
  const { switchGroups } = useTileEmitInvalidGeometryFilterCardView(
    config,
    onChange,
    disabled,
    {
      selfIntersection: t('processing.tileEmit.invalidGeometryFilter.selfIntersection', 'Self intersection'),
      triangleRingRatio: t('processing.tileEmit.invalidGeometryFilter.triangleRingRatio', 'Triangle ring ratio'),
      area: t('processing.tileEmit.invalidGeometryFilter.area', 'Area'),
      lineLength: t('processing.tileEmit.invalidGeometryFilter.lineLength', 'Line length'),
      maxEdgeLength: t('processing.tileEmit.invalidGeometryFilter.maxEdgeLength', 'Max edge length'),
    },
  );

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
