import {
  BuildConfigSectionTitle,
  getBuildConfigHoverCardSx,
} from '@hierarchidb/ui-accordion-config';
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
import { memo } from 'react';
import type { SourceGeometryIntakeGuardCardState } from './useSourceGeometryIntakeGuardCardState.js';

type Props = SourceGeometryIntakeGuardCardState & {
  disableHoverLift: boolean;
  labels: {
    title: string;
    description: string;
    comingSoon: string;
    validationLevel: string;
    levelOff: string;
    levelBasic: string;
    levelStrict: string;
    dedupeEpsilon: string;
    minRingAreaThreshold: string;
    normalizeRingOrientation: string;
    keepBaselineSnapshot: string;
  };
};

export const SourceGeometryIntakeGuardCardView = memo(
  ({
    disableHoverLift,
    labels,
    resolvedGuard,
    handleValidationLevelChange,
    handleDedupeEpsilonChange,
    handleMinRingAreaThresholdChange,
    handleNormalizeRingOrientationChange,
    handleKeepBaselineSnapshotChange,
  }: Props) => (
    <Paper variant="outlined" sx={{ p: 2, ...getBuildConfigHoverCardSx(true, disableHoverLift) }}>
      <Stack spacing={1.5} sx={{ opacity: 0.6 }}>
        <BuildConfigSectionTitle
          icon={<SecurityIcon fontSize="small" color="primary" />}
          title={labels.title}
        />
        <Typography variant="body2" color="text.secondary">
          {labels.description}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {labels.comingSoon}
        </Typography>
        <Grid container spacing={1.5} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth disabled>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {labels.validationLevel}
              </Typography>
              <ToggleButtonGroup
                size="small"
                fullWidth
                exclusive
                disabled
                value={resolvedGuard.validationLevel}
                onChange={handleValidationLevelChange}
              >
                <ToggleButton value="off">{labels.levelOff}</ToggleButton>
                <ToggleButton value="basic">{labels.levelBasic}</ToggleButton>
                <ToggleButton value="strict">{labels.levelStrict}</ToggleButton>
              </ToggleButtonGroup>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              size="small"
              type="number"
              label={labels.dedupeEpsilon}
              value={resolvedGuard.dedupeEpsilon}
              disabled
              onChange={handleDedupeEpsilonChange}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              size="small"
              type="number"
              label={labels.minRingAreaThreshold}
              value={resolvedGuard.minRingAreaThreshold}
              disabled
              onChange={handleMinRingAreaThresholdChange}
            />
          </Grid>
        </Grid>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={resolvedGuard.normalizeRingOrientation}
                  onChange={handleNormalizeRingOrientationChange}
                />
              }
              disabled
              label={labels.normalizeRingOrientation}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={resolvedGuard.keepBaselineSnapshot}
                  onChange={handleKeepBaselineSnapshotChange}
                />
              }
              disabled
              label={labels.keepBaselineSnapshot}
            />
          </Grid>
        </Grid>
      </Stack>
    </Paper>
  )
);

SourceGeometryIntakeGuardCardView.displayName = 'SourceGeometryIntakeGuardCardView';
