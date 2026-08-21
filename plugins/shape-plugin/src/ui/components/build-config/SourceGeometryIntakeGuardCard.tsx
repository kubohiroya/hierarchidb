import {
  BuildConfigSectionTitle,
  getBuildConfigHoverCardSx,
} from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { Security as SecurityIcon } from '@mui/icons-material';
import {
  FormControl,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { ShapeBuildConfig } from '~/common/types/index';
import { useSourceGeometryIntakeGuardCardView } from './useSourceGeometryIntakeGuardCardView.js';

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
  const hoverCardSx = getBuildConfigHoverCardSx(true, disableHoverLift);
  const view = useSourceGeometryIntakeGuardCardView(config, onChange);

  return (
    <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
      <Stack spacing={1.5} sx={{ opacity: 0.6 }}>
        <BuildConfigSectionTitle
          icon={<SecurityIcon fontSize="small" color="primary" />}
          title={t('processing.source.geometryIntakeGuard.title', 'Geometry intake guard')}
        />
        <Typography variant="body2" color="text.secondary">
          {t(
            'processing.source.geometryIntakeGuard.description',
            'Configure normalization and strictness for source geometry intake checks.'
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(
            'processing.source.geometryIntakeGuard.comingSoon',
            'This guard is reserved for a future implementation. Editing is currently disabled.'
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
                value={view.resolvedGuard.validationLevel}
                onChange={view.handleValidationLevelChange}
              >
                <ToggleButton value="off">
                  {t('processing.source.geometryIntakeGuard.level.off', 'off')}
                </ToggleButton>
                <ToggleButton value="basic">
                  {t('processing.source.geometryIntakeGuard.level.basic', 'basic')}
                </ToggleButton>
                <ToggleButton value="strict">
                  {t('processing.source.geometryIntakeGuard.level.strict', 'strict')}
                </ToggleButton>
              </ToggleButtonGroup>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              size="small"
              type="number"
              label={t(
                'processing.source.geometryIntakeGuard.dedupeEpsilon',
                'Duplicate vertex epsilon'
              )}
              value={view.resolvedGuard.dedupeEpsilon}
              disabled
              onChange={view.handleDedupeEpsilonChange}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              size="small"
              type="number"
              label={t(
                'processing.source.geometryIntakeGuard.minRingAreaThreshold',
                'Minimum ring area threshold'
              )}
              value={view.resolvedGuard.minRingAreaThreshold}
              disabled
              onChange={view.handleMinRingAreaThresholdChange}
            />
          </Grid>
        </Grid>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={view.resolvedGuard.normalizeRingOrientation}
                  onChange={view.handleNormalizeRingOrientationChange}
                />
              }
              disabled
              label={t(
                'processing.source.geometryIntakeGuard.normalizeRingOrientation',
                'Normalize ring orientation'
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={view.resolvedGuard.keepBaselineSnapshot}
                  onChange={view.handleKeepBaselineSnapshotChange}
                />
              }
              disabled
              label={t(
                'processing.source.geometryIntakeGuard.keepBaselineSnapshot',
                'Keep baseline snapshot for anomaly scoring'
              )}
            />
          </Grid>
        </Grid>
      </Stack>
    </Paper>
  );
};
