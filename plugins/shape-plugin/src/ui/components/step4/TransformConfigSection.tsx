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
import { useTranslation } from '../../i18n.js';
import { useTransformConfigSection } from './useTransformConfigSection.ts';
import { ExtractionPanel } from '../processing/ExtractionPanel.js';
import type { ReactNode } from 'react';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Props = {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

const SectionTitle: React.FC<{ icon: ReactNode; title: string }> = ({ icon, title }) => (
  <Stack direction="row" spacing={1} alignItems="center">
    {icon}
    <Typography variant="subtitle2">{title}</Typography>
  </Stack>
);

const EARTH_RADIUS = 6378137;
const MVT_EXTENT = 4096;
const MAX_MERCATOR_LAT = 85.05112878;

type Bbox = {
  name: string;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

const COUNTRY_BBOXES: Bbox[] = [
  { name: 'Russia', minLon: 19, minLat: 41, maxLon: 180, maxLat: 82 },
  { name: 'Canada', minLon: -141, minLat: 42, maxLon: -52, maxLat: 83 },
  { name: 'China', minLon: 73, minLat: 18, maxLon: 135, maxLat: 54 },
  { name: 'Australia', minLon: 113, minLat: -44, maxLon: 154, maxLat: -10 },
  { name: 'Greenland', minLon: -73, minLat: 59, maxLon: -12, maxLat: 83 },
  { name: 'India', minLon: 68, minLat: 6, maxLon: 97, maxLat: 35 },
];

const metersPerPixel = (z: number): number => (
  (2 * Math.PI * EARTH_RADIUS) / (MVT_EXTENT * Math.pow(2, z))
);

const lonLatToMercator = (lon: number, lat: number): [number, number] => {
  const clampedLat = Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat));
  const x = (lon * Math.PI * EARTH_RADIUS) / 180;
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (clampedLat * Math.PI) / 360));
  return [x, y];
};

const computeBboxAreaPx2 = (bbox: Bbox, zTarget: number): number => {
  const [minX, minY] = lonLatToMercator(bbox.minLon, bbox.minLat);
  const [maxX, maxY] = lonLatToMercator(bbox.maxLon, bbox.maxLat);
  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  const areaMeters2 = width * height;
  if (!Number.isFinite(areaMeters2) || areaMeters2 <= 0) return 0;
  const mpp = metersPerPixel(zTarget);
  if (!Number.isFinite(mpp) || mpp <= 0) return 0;
  const areaPx2 = areaMeters2 / (mpp * mpp);
  return Number.isFinite(areaPx2) ? areaPx2 : 0;
};

const formatPx2 = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}e9`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}e6`;
  }
  return new Intl.NumberFormat('en-US').format(Math.round(value));
};

export const TransformConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const { t } = useTranslation();
  const {
    baseTransformConfig,
    update,
  } = useTransformConfigSection({ config, onChange });

  const toleranceExpMin = Math.log2(0.005);
  const toleranceExpMax = 0;
  const toExponent = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) return toleranceExpMin;
    const exponent = Math.log2(value);
    return Math.min(toleranceExpMax, Math.max(toleranceExpMin, exponent));
  };
  const toTolerance = (exponent: number): number => Math.pow(2, exponent);
  const formatTolerance = (value: number): string => {
    const rounded = Number(value.toFixed(4));
    return String(rounded);
  };
  const toleranceMarks = [toleranceExpMin, -6, -4, -2, toleranceExpMax]
    .filter((value, index, array) => array.indexOf(value) === index)
    .map((value) => ({ value, label: formatTolerance(toTolerance(value)) }));
  const areaBasedTolerance = baseTransformConfig.areaBasedTolerance;
  const zoomBandBoundaries = baseTransformConfig.zoomBandBoundaries;
  const zTarget = zoomBandBoundaries[1] ?? zoomBandBoundaries[0] ?? 0;
  const thresholdAreaExponent = Math.log10(
    Math.max(1, areaBasedTolerance.thresholdAreaPx2)
  );
  const thresholdAreaMarks = COUNTRY_BBOXES.map((bbox) => {
    const areaPx2 = computeBboxAreaPx2(bbox, zTarget);
    return {
      value: Math.log10(Math.max(1, areaPx2)),
      label: bbox.name,
    };
  });
  const markValues = thresholdAreaMarks.map((mark) => mark.value);
  const thresholdAreaRange = {
    min: Math.floor(Math.min(thresholdAreaExponent, ...markValues) - 0.5),
    max: Math.ceil(Math.max(thresholdAreaExponent, ...markValues) + 0.5),
  };
  const hoverCardSx = disabled
    ? {}
    : {
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme: { shadows: string[] }) => theme.shadows[8],
        },
      };

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
                  <SectionTitle
                    icon={<AutoFixHighIcon fontSize="small" color="primary" />}
                    title={t('processing.filter.extractionTitle', 'Simplification')}
                  />
                  <ExtractionPanel
                    tolerance={baseTransformConfig.tolerance}
                    toleranceLabelKey="processing.filter.tolerancePrimary"
                    showTitle={false}
                    startIcon={<DensitySmallIcon fontSize="small" />}
                    endIcon={<DensityLargeIcon fontSize="small" />}
                    onToleranceChange={(tolerance) => {
                      const nextLargeAreaTolerance = Math.min(
                        areaBasedTolerance.largeAreaTolerance,
                        tolerance,
                      );
                      update({
                        transformConfig: {
                          ...baseTransformConfig,
                          tolerance,
                          areaBasedTolerance: {
                            ...areaBasedTolerance,
                            largeAreaTolerance: nextLargeAreaTolerance,
                          },
                        },
                      });
                    }}
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
                            'Threshold area for relaxed tolerance on large areas (px^2)',
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
                          track="inverted"
                          valueLabelFormat={(value) => formatPx2(Math.pow(10, value))}
                          onChange={(_, value) => {
                            if (Array.isArray(value)) return;
                            const nextArea = Math.pow(10, value);
                            if (!Number.isFinite(nextArea)) return;
                            update({
                              transformConfig: {
                                ...baseTransformConfig,
                                areaBasedTolerance: {
                                  ...areaBasedTolerance,
                                  thresholdAreaPx2: nextArea,
                                },
                              },
                            });
                          }}
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
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          'processing.filter.areaBasedToleranceLargeTolerance',
                          'Relaxed tolerance on large areas',
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
                            onChange={(_, value) => {
                              if (Array.isArray(value)) return;
                              const nextTolerance = toTolerance(value);
                              const clamped = Math.min(nextTolerance, baseTransformConfig.tolerance);
                              update({
                                transformConfig: {
                                  ...baseTransformConfig,
                                  areaBasedTolerance: {
                                    ...areaBasedTolerance,
                                    largeAreaTolerance: clamped,
                                  },
                                },
                              });
                            }}
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
