import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Grid,
  Stack,
  Typography,
  Paper,
  Slider,
  Tooltip,
} from '@mui/material';
import {
  AutoFixHigh as AutoFixHighIcon,
  FilterAlt as FilterAltIcon,
  InfoOutlined as InfoOutlinedIcon,
  ExpandMore as ExpandMoreIcon,
  CropOriginal as CropOriginalIcon,
  DensityLarge as DensityLargeIcon,
  DensitySmall as DensitySmallIcon,
} from '@mui/icons-material';
import { ExtractionPanel } from '../processing/ExtractionPanel.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { BuildConfigSectionTitle } from '@hierarchidb/ui-accordion-config';
import { useTransformConfigSectionView } from './useTransformConfigSectionView.ts';

type Props = {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const TransformConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const {
    t,
    baseTransformConfig,
    areaBasedTolerance,
    toleranceExpMin,
    toleranceExpMax,
    toleranceMarks,
    zTarget,
    thresholdAreaExponent,
    thresholdAreaMarks,
    thresholdAreaRange,
    hoverCardSx,
    toExponent,
    toTolerance,
    formatTolerance,
    formatPx2,
    handleThresholdAreaChange,
    handleToleranceChange,
    handleLargeAreaToleranceChange,
  } = useTransformConfigSectionView({ config, disabled, onChange });

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterAltIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.transform.title', 'Transform')}
          </Typography>
          <Tooltip
            title={t(
              'processing.transform.summaryHelp',
              'Transform runs turf.simplify with the configured tolerance.',
            )}
            placement="top"
          >
            <InfoOutlinedIcon color="action" fontSize="small" />
          </Tooltip>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2, ...hoverCardSx }}>
                <Stack spacing={2}>
                  <BuildConfigSectionTitle
                    icon={<AutoFixHighIcon fontSize="small" color="primary" />}
                    title={t('processing.filter.extractionTitle', 'Simplification')}
                  />

                  <Stack spacing={1.5}>
                    <Typography variant="subtitle2">
                      {t('processing.filter.areaBasedToleranceTitle', 'Area-based tolerance')}
                    </Typography>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CropOriginalIcon fontSize="small" />
                        <Typography variant="body2" fontWeight={600}>
                          {t(
                            'processing.filter.areaBasedToleranceThresholdArea',
                            'Threshold area for tolerance #1 and tolerance #2 (px^2)',
                          )}
                        </Typography>
                      </Stack>
                      <Box sx={{ px: 2 }}>
                        <Slider
                          value={thresholdAreaExponent}
                          min={thresholdAreaRange.min}
                          max={thresholdAreaRange.max}
                          step={0.1}
                          marks={thresholdAreaMarks}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => formatPx2(Math.pow(10, value))}
                          onChange={(_, value) => handleThresholdAreaChange(value)}
                          disabled={disabled}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          'processing.filter.areaBasedToleranceThresholdHelp',
                          'Marks use the max zoom of the first band (z={{zoom}}).',
                          { zoom: zTarget },
                        )}
                      </Typography>
                    </Stack>
                    <ExtractionPanel
                      tolerance={baseTransformConfig.tolerance}
                      toleranceLabelKey="processing.filter.tolerancePrimary"
                      showTitle={false}
                      startIcon={<DensitySmallIcon fontSize="small" />}
                      endIcon={<DensityLargeIcon fontSize="small" />}
                      onToleranceChange={handleToleranceChange}
                      min={toleranceExpMin}
                      max={toleranceExpMax}
                      step={0.25}
                      marks={toleranceMarks}
                      showPerFeatureToggle={false}
                      disabled={disabled}
                      valueTransform={{
                        toSlider: toExponent,
                        fromSlider: toTolerance,
                        formatLabel: formatTolerance,
                      }}
                    />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          'processing.filter.areaBasedToleranceLargeTolerance',
                          'Tolerance #2 on large areas',
                        )}
                      </Typography>
                      <Box sx={{ px: 2, pt: 2, pb: 2 }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <DensitySmallIcon fontSize="small" color="action" />
                          <Slider
                            sx={{ flex: 1 }}
                            value={toExponent(areaBasedTolerance.largeAreaTolerance)}
                            min={toleranceExpMin}
                            max={toleranceExpMax}
                            step={0.25}
                            valueLabelDisplay="auto"
                            track="inverted"
                            valueLabelFormat={(value) => formatTolerance(toTolerance(value))}
                            marks={toleranceMarks}
                            onChange={(_, value) => handleLargeAreaToleranceChange(value)}
                            disabled={disabled}
                          />
                          <DensityLargeIcon fontSize="small" color="action" />
                        </Stack>
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        'processing.filter.areaBasedToleranceHelp',
                        'If a feature exceeds the threshold area, tolerance is capped by the large-area value.',
                      )}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
