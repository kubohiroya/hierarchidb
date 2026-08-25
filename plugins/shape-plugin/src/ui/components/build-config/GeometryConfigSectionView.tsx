// Presentational component for GeometryConfigSection.

import {
  BuildConfigAccordionSummary,
  BuildConfigSectionTitle,
} from '@hierarchidb/ui-accordion-config';
import { ExpandMore as ExpandMoreIcon, Tune as TuneIcon } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  FormControlLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import { SimplifyToleranceByAdminLevelCard } from './SimplifyToleranceByAdminLevelCard.tsx';
import type { GeometryConfigSectionViewProps } from './useGeometryConfigSectionState.js';

export const GeometryConfigSectionView = React.memo<GeometryConfigSectionViewProps>(
  ({
    t,
    disabled,
    disableHoverLift,
    hoverCardSx,
    baseGeometryConfig,
    borderGeometryConfig,
    simplifyAlgorithm,
    preserveTopology,
    summaryHelp,
    handleSimplifyAlgorithmChange,
    handlePreserveTopologyChange,
    onGeometryUpdate,
    onBorderGeometryUpdate,
  }) => {
    return (
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <BuildConfigAccordionSummary
            icon={<TuneIcon color="primary" />}
            title={t('processing.geometry.title', 'Geometry')}
            info={summaryHelp}
          />
        </AccordionSummary>
        <AccordionDetails sx={{ p: 1 }}>
          <Stack spacing={2} sx={{ opacity: disabled ? 0.6 : 1 }}>
            <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
              <Stack spacing={2}>
                <BuildConfigSectionTitle
                  icon={<TuneIcon fontSize="small" color="primary" />}
                  title={t('processing.geometry.algorithmSettings.title', 'Algorithm settings')}
                />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl disabled={disabled}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {t('processing.geometry.algorithm.label', 'Simplify Algorithm')}
                      </Typography>
                      <RadioGroup
                        row
                        value={simplifyAlgorithm}
                        onChange={handleSimplifyAlgorithmChange}
                      >
                        <FormControlLabel
                          value="topojson"
                          control={<Radio size="small" />}
                          label={t(
                            'processing.geometry.algorithm.topojson',
                            'topojson (topology-preserving)'
                          )}
                        />
                        <FormControlLabel
                          value="geojson"
                          control={<Radio size="small" />}
                          label={t(
                            'processing.geometry.algorithm.geojson',
                            'geojson (turf simplify)'
                          )}
                        />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack spacing={0.5}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={preserveTopology}
                            onChange={handlePreserveTopologyChange}
                          />
                        }
                        disabled={disabled || simplifyAlgorithm === 'topojson'}
                        label={t('processing.geometry.preserveTopology.label', 'Preserve topology')}
                      />
                      {simplifyAlgorithm === 'topojson' ? (
                        <Typography variant="caption" color="text.secondary">
                          {t(
                            'processing.geometry.preserveTopology.topojsonHint',
                            'topojson mode always preserves topology in decode simplify path.'
                          )}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Grid>
                </Grid>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
              <Stack spacing={2}>
                <BuildConfigSectionTitle
                  icon={<TuneIcon fontSize="small" color="primary" />}
                  title={t(
                    'processing.geometry.borderGeometry.title',
                    'Border geometry / shared arcs'
                  )}
                />
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack spacing={0.5}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={borderGeometryConfig.enabled}
                            onChange={(event) =>
                              onBorderGeometryUpdate({ enabled: event.target.checked })
                            }
                          />
                        }
                        disabled={disabled}
                        label={t(
                          'processing.geometry.borderGeometry.enabled',
                          'Build shared-arc topology artifacts'
                        )}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          'processing.geometry.borderGeometry.hint',
                          'Runs arc extraction, arc simplification, and polygon reconstruction when the storage gate is enabled.'
                        )}
                      </Typography>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      disabled={disabled || !borderGeometryConfig.enabled}
                      label={t(
                        'processing.geometry.borderGeometry.simplifyTolerance',
                        'Arc simplify tolerance'
                      )}
                      value={borderGeometryConfig.simplifyTolerance}
                      slotProps={{
                        htmlInput: {
                          min: 0,
                          step: 0.000001,
                        },
                      }}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next) || next < 0) return;
                        onBorderGeometryUpdate({ simplifyTolerance: next });
                      }}
                    />
                  </Grid>
                </Grid>
              </Stack>
            </Paper>
            <SimplifyToleranceByAdminLevelCard
              geometryConfig={baseGeometryConfig}
              disabled={disabled}
              disableHoverLift={disableHoverLift}
              onChange={onGeometryUpdate}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>
    );
  }
);

GeometryConfigSectionView.displayName = 'GeometryConfigSectionView';
