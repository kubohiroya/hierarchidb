import {
  BuildConfigSectionTitle,
  getBuildConfigHoverCardSx,
} from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { Rule as RuleIcon } from '@mui/icons-material';
import { FormControlLabel, Grid, Paper, Stack, Switch, Typography } from '@mui/material';
import type { ShapeBuildConfig } from '~/common/types/index';
import { useTileEmitInvalidGeometryFilterCardView } from './useTileEmitInvalidGeometryFilterCardView.js';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  disabled?: boolean;
  disableHoverLift?: boolean;
};

export const TileEmitInvalidGeometryFilterCard: React.FC<Props> = ({
  config,
  onChange,
  disabled,
  disableHoverLift = false,
}) => {
  const { t } = useTranslation('shape-plugin');
  const hoverCardSx = getBuildConfigHoverCardSx(disabled, disableHoverLift);
  const { switchGroups } = useTileEmitInvalidGeometryFilterCardView(config, onChange, disabled, {
    selfIntersection: t(
      'processing.tileEmit.invalidGeometryFilter.selfIntersection',
      'Self intersection'
    ),
    triangleRingRatio: t(
      'processing.tileEmit.invalidGeometryFilter.triangleRingRatio',
      'Triangle ring ratio'
    ),
    area: t('processing.tileEmit.invalidGeometryFilter.area', 'Area'),
    lineLength: t('processing.tileEmit.invalidGeometryFilter.lineLength', 'Line length'),
    maxEdgeLength: t('processing.tileEmit.invalidGeometryFilter.maxEdgeLength', 'Max edge length'),
  });

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
            'Run additional invalid-shape checks immediately before vector-tile indexing.'
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
