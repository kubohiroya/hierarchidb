import {
  BuildConfigSectionTitle,
  getBuildConfigHoverCardSx,
} from '@hierarchidb/ui-accordion-config';
import { Rule as RuleIcon } from '@mui/icons-material';
import { FormControlLabel, Grid, Paper, Stack, Switch, Typography } from '@mui/material';
import { memo } from 'react';
import type { TileEmitInvalidGeometryFilterCardState } from './useTileEmitInvalidGeometryFilterCardState.js';

type Props = TileEmitInvalidGeometryFilterCardState & {
  disabled: boolean;
  disableHoverLift: boolean;
  title: string;
  description: string;
};

export const TileEmitInvalidGeometryFilterCardView = memo(
  ({ disabled, disableHoverLift, title, description, switchGroups }: Props) => (
    <Paper
      variant="outlined"
      sx={{ p: 2, ...getBuildConfigHoverCardSx(disabled, disableHoverLift) }}
    >
      <Stack spacing={1.5} sx={{ opacity: disabled ? 0.6 : 1 }}>
        <BuildConfigSectionTitle
          icon={<RuleIcon fontSize="small" color="primary" />}
          title={title}
        />
        <Typography variant="body2" color="text.secondary">
          {description}
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
  )
);

TileEmitInvalidGeometryFilterCardView.displayName = 'TileEmitInvalidGeometryFilterCardView';
