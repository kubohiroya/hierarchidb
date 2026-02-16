import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  InfoOutlined as InfoOutlinedIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../i18n.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { useTransformConfigSection } from './useTransformConfigSection.ts';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig) => void;
  disabled?: boolean;
};

export const TransformConfigSection: React.FC<Props> = ({ config, onChange, disabled }) => {
  const { t } = useTranslation();
  const { baseTransformConfig, update } = useTransformConfigSection({ config, onChange });

  const simplifyAlgorithm = baseTransformConfig.simplifyAlgorithm ?? 'topojson';
  const preserveTopology = baseTransformConfig.preserveTopology ?? true;
  const executionLogLevel = baseTransformConfig.executionLogLevel ?? 'summary';
  const anomalyDetection = {
    enabled: baseTransformConfig.anomalyDetection?.enabled ?? true,
    scoreThreshold: baseTransformConfig.anomalyDetection?.scoreThreshold ?? 2.2,
    maxEdgeLengthRatio: baseTransformConfig.anomalyDetection?.maxEdgeLengthRatio ?? 12,
    maxAreaDriftPercent: baseTransformConfig.anomalyDetection?.maxAreaDriftPercent ?? 35,
    maxSelfIntersectionCount: baseTransformConfig.anomalyDetection?.maxSelfIntersectionCount ?? 0,
    maxLineLengthDriftPercent: baseTransformConfig.anomalyDetection?.maxLineLengthDriftPercent ?? 45,
    maxVertexDriftPercent: baseTransformConfig.anomalyDetection?.maxVertexDriftPercent ?? 40,
    geojson: {
      maxTriangleShareDriftPercent:
        baseTransformConfig.anomalyDetection?.geojson?.maxTriangleShareDriftPercent ?? 2,
      maxTriangleEdgeToBBoxRatio:
        baseTransformConfig.anomalyDetection?.geojson?.maxTriangleEdgeToBBoxRatio ?? 1.15,
    },
    topojson: {
      minSharedArcRatioPercent:
        baseTransformConfig.anomalyDetection?.topojson?.minSharedArcRatioPercent ?? 12,
    },
  };
  const anomalyRetry = {
    enabled: baseTransformConfig.anomalyRetry?.enabled ?? true,
    maxRetries: baseTransformConfig.anomalyRetry?.maxRetries ?? 2,
    toleranceScale: baseTransformConfig.anomalyRetry?.toleranceScale ?? 0.7,
    fallbackMode: baseTransformConfig.anomalyRetry?.fallbackMode ?? 'best_score',
  };

  const summaryHelp = simplifyAlgorithm === 'topojson'
    ? t(
      'processing.transform.summaryHelpTopojson',
      'Transform uses topology-preserving topojson simplify during decode and skips geojson simplify in the simplify stage.',
    )
    : t(
      'processing.transform.summaryHelpGeojson',
      'Transform decodes geometry first, then runs geojson simplify with the configured tolerance.',
    );

  const updateTransformConfig = (partial: Partial<typeof baseTransformConfig>) => {
    update({
      transformConfig: {
        ...baseTransformConfig,
        ...partial,
      },
    });
  };

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TuneIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.transform.title', 'Transform')}
          </Typography>
          <Tooltip
            title={summaryHelp}
            placement="top"
          >
            <InfoOutlinedIcon color="action" fontSize="small" />
          </Tooltip>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={2} sx={{ opacity: disabled ? 0.6 : 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t(
              'processing.transform.concurrencyMovedToBuildStep',
              'Transform concurrency has moved to the Build step. Click the stage spinner in progress summary to edit it.',
            )}
          </Typography>

          <FormControl disabled={disabled}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('processing.transform.algorithm.label', 'Simplify Algorithm')}
            </Typography>
            <RadioGroup
              row
              value={simplifyAlgorithm}
              onChange={(_event, value) => {
                if (value !== 'geojson' && value !== 'topojson') return;
                updateTransformConfig({ simplifyAlgorithm: value });
              }}
            >
              <FormControlLabel
                value="topojson"
                control={<Radio size="small" />}
                label={t('processing.transform.algorithm.topojson', 'topojson (topology-preserving)')}
              />
              <FormControlLabel
                value="geojson"
                control={<Radio size="small" />}
                label={t('processing.transform.algorithm.geojson', 'geojson (turf simplify)')}
              />
            </RadioGroup>
          </FormControl>

          <FormControlLabel
            control={(
              <Switch
                checked={preserveTopology}
                onChange={(event) => updateTransformConfig({ preserveTopology: event.target.checked })}
              />
            )}
            disabled={disabled || simplifyAlgorithm === 'topojson'}
            label={t('processing.transform.preserveTopology.label', 'Preserve topology')}
          />
          {simplifyAlgorithm === 'topojson' ? (
            <Typography variant="caption" color="text.secondary">
              {t(
                'processing.transform.preserveTopology.topojsonHint',
                'topojson mode always preserves topology in decode simplify path.',
              )}
            </Typography>
          ) : null}

          <FormControl fullWidth disabled={disabled}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('processing.transform.executionLogLevel.label', 'Execution Log Level')}
            </Typography>
            <Select
              size="small"
              value={executionLogLevel}
              onChange={(event) => {
                const value = event.target.value;
                if (value !== 'off' && value !== 'summary' && value !== 'verbose') return;
                updateTransformConfig({ executionLogLevel: value });
              }}
            >
              <MenuItem value="off">{t('processing.transform.executionLogLevel.off', 'off')}</MenuItem>
              <MenuItem value="summary">{t('processing.transform.executionLogLevel.summary', 'summary')}</MenuItem>
              <MenuItem value="verbose">{t('processing.transform.executionLogLevel.verbose', 'verbose')}</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="subtitle2">
            {t('processing.transform.anomaly.title', 'Anomaly Detection & Auto Retry')}
          </Typography>
          <FormControlLabel
            control={(
              <Switch
                checked={anomalyDetection.enabled}
                onChange={(event) => updateTransformConfig({
                  anomalyDetection: {
                    ...anomalyDetection,
                    enabled: event.target.checked,
                  },
                })}
              />
            )}
            disabled={disabled}
            label={t('processing.transform.anomaly.enabled', 'Enable anomaly detection')}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              type="number"
              label={t('processing.transform.anomaly.scoreThreshold', 'Anomaly score threshold')}
              value={anomalyDetection.scoreThreshold}
              disabled={disabled || !anomalyDetection.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateTransformConfig({
                  anomalyDetection: {
                    ...anomalyDetection,
                    scoreThreshold: Math.max(0.1, value),
                  },
                });
              }}
            />
            <TextField
              size="small"
              type="number"
              label={t('processing.transform.anomaly.maxEdgeLengthRatio', 'Max edge length ratio')}
              value={anomalyDetection.maxEdgeLengthRatio}
              disabled={disabled || !anomalyDetection.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateTransformConfig({
                  anomalyDetection: {
                    ...anomalyDetection,
                    maxEdgeLengthRatio: Math.max(1, value),
                  },
                });
              }}
            />
            <TextField
              size="small"
              type="number"
              label={t('processing.transform.anomaly.maxAreaDriftPercent', 'Max area drift (%)')}
              value={anomalyDetection.maxAreaDriftPercent}
              disabled={disabled || !anomalyDetection.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateTransformConfig({
                  anomalyDetection: {
                    ...anomalyDetection,
                    maxAreaDriftPercent: Math.max(0, value),
                  },
                });
              }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              type="number"
              label={t('processing.transform.anomaly.maxSelfIntersectionCount', 'Max self intersections')}
              value={anomalyDetection.maxSelfIntersectionCount}
              disabled={disabled || !anomalyDetection.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateTransformConfig({
                  anomalyDetection: {
                    ...anomalyDetection,
                    maxSelfIntersectionCount: Math.max(0, Math.floor(value)),
                  },
                });
              }}
            />
            <TextField
              size="small"
              type="number"
              label={t('processing.transform.anomaly.maxLineLengthDriftPercent', 'Max line length drift (%)')}
              value={anomalyDetection.maxLineLengthDriftPercent}
              disabled={disabled || !anomalyDetection.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateTransformConfig({
                  anomalyDetection: {
                    ...anomalyDetection,
                    maxLineLengthDriftPercent: Math.max(0, value),
                  },
                });
              }}
            />
            <TextField
              size="small"
              type="number"
              label={t('processing.transform.anomaly.maxVertexDriftPercent', 'Max vertex drift (%)')}
              value={anomalyDetection.maxVertexDriftPercent}
              disabled={disabled || !anomalyDetection.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateTransformConfig({
                  anomalyDetection: {
                    ...anomalyDetection,
                    maxVertexDriftPercent: Math.max(0, value),
                  },
                });
              }}
            />
          </Stack>

          {simplifyAlgorithm === 'geojson' ? (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'processing.transform.anomaly.geojson.caption',
                  'GeoJSON path checks triangle-shape drift using edge length against polygon BBox span.',
                )}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  size="small"
                  type="number"
                  label={t(
                    'processing.transform.anomaly.geojson.maxTriangleShareDriftPercent',
                    'Max triangle share drift (%)',
                  )}
                  value={anomalyDetection.geojson.maxTriangleShareDriftPercent}
                  disabled={disabled || !anomalyDetection.enabled}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isFinite(value)) return;
                    updateTransformConfig({
                      anomalyDetection: {
                        ...anomalyDetection,
                        geojson: {
                          ...anomalyDetection.geojson,
                          maxTriangleShareDriftPercent: Math.max(0, value),
                        },
                      },
                    });
                  }}
                />
                <TextField
                  size="small"
                  type="number"
                  label={t(
                    'processing.transform.anomaly.geojson.maxTriangleEdgeToBBoxRatio',
                    'Max triangle edge/BBox ratio',
                  )}
                  value={anomalyDetection.geojson.maxTriangleEdgeToBBoxRatio}
                  disabled={disabled || !anomalyDetection.enabled}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isFinite(value)) return;
                    updateTransformConfig({
                      anomalyDetection: {
                        ...anomalyDetection,
                        geojson: {
                          ...anomalyDetection.geojson,
                          maxTriangleEdgeToBBoxRatio: Math.max(0.1, value),
                        },
                      },
                    });
                  }}
                />
              </Stack>
            </Stack>
          ) : null}

          {simplifyAlgorithm === 'topojson' ? (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'processing.transform.anomaly.topojson.caption',
                  'TopoJSON path uses shared-arc continuity diagnostics from topology references.',
                )}
              </Typography>
              <TextField
                size="small"
                type="number"
                label={t(
                  'processing.transform.anomaly.topojson.minSharedArcRatioPercent',
                  'Min shared arc ratio (%)',
                )}
                value={anomalyDetection.topojson.minSharedArcRatioPercent}
                disabled={disabled || !anomalyDetection.enabled}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!Number.isFinite(value)) return;
                  updateTransformConfig({
                    anomalyDetection: {
                      ...anomalyDetection,
                      topojson: {
                        ...anomalyDetection.topojson,
                        minSharedArcRatioPercent: Math.min(100, Math.max(0, value)),
                      },
                    },
                  });
                }}
              />
            </Stack>
          ) : null}

          <FormControlLabel
            control={(
              <Switch
                checked={anomalyRetry.enabled}
                onChange={(event) => updateTransformConfig({
                  anomalyRetry: {
                    ...anomalyRetry,
                    enabled: event.target.checked,
                  },
                })}
              />
            )}
            disabled={disabled || !anomalyDetection.enabled}
            label={t('processing.transform.anomaly.retry.enabled', 'Enable automatic retry')}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              type="number"
              label={t('processing.transform.anomaly.retry.maxRetries', 'Max retries')}
              value={anomalyRetry.maxRetries}
              disabled={disabled || !anomalyDetection.enabled || !anomalyRetry.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateTransformConfig({
                  anomalyRetry: {
                    ...anomalyRetry,
                    maxRetries: Math.max(0, Math.floor(value)),
                  },
                });
              }}
            />
            <TextField
              size="small"
              type="number"
              label={t('processing.transform.anomaly.retry.toleranceScale', 'Retry tolerance scale')}
              value={anomalyRetry.toleranceScale}
              disabled={disabled || !anomalyDetection.enabled || !anomalyRetry.enabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                updateTransformConfig({
                  anomalyRetry: {
                    ...anomalyRetry,
                    toleranceScale: Math.min(1, Math.max(0.1, value)),
                  },
                });
              }}
            />
          </Stack>

          <FormControl fullWidth disabled={disabled || !anomalyDetection.enabled || !anomalyRetry.enabled}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('processing.transform.anomaly.retry.fallbackMode', 'Fallback mode')}
            </Typography>
            <Select
              size="small"
              value={anomalyRetry.fallbackMode}
              onChange={(event) => {
                const value = event.target.value;
                if (value !== 'switch_algorithm' && value !== 'disable_simplify' && value !== 'best_score') {
                  return;
                }
                updateTransformConfig({
                  anomalyRetry: {
                    ...anomalyRetry,
                    fallbackMode: value,
                  },
                });
              }}
            >
              <MenuItem value="best_score">
                {t('processing.transform.anomaly.retry.fallback.bestScore', 'Use best anomaly score')}
              </MenuItem>
              <MenuItem value="switch_algorithm">
                {t('processing.transform.anomaly.retry.fallback.switchAlgorithm', 'Try switching algorithm')}
              </MenuItem>
              <MenuItem value="disable_simplify">
                {t('processing.transform.anomaly.retry.fallback.disableSimplify', 'Disable simplify for this task')}
              </MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
