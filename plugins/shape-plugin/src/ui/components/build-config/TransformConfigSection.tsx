import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Switch,
  FormControl,
  FormControlLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  InfoOutlined as InfoOutlinedIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import {
  BuildConfigAccordionSummary,
  BuildConfigSectionTitle,
  getBuildConfigHoverCardSx,
} from '@hierarchidb/ui-accordion-config';
import { ToneCurveEditor } from '@hierarchidb/ui-tone-curve-editor';
import { useTranslation } from '~/ui/i18n';
import type { ShapeBuildConfig } from '~/common/types/index';
import { useTransformConfigSection } from '~/ui/hooks/useTransformConfigSection';
import { buildToleranceByBandFromToneCurveAnchors, buildToneCurveAnchorsFromToleranceByBand } from '~/services/utils/toleranceByBand';
import type { ChangeEvent } from 'react';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig) => void;
  disabled?: boolean;
};

export const TransformConfigSection: React.FC<Props> = ({ config, onChange, disabled }) => {
  const { t } = useTranslation();
  const { baseTransformConfig, update } = useTransformConfigSection({ config, onChange });
  const hoverCardSx = getBuildConfigHoverCardSx(disabled);
  const clampRetryCount = (value: number): number => Math.min(10, Math.max(0, Math.round(value)));
  const resolveSliderNumber = (value: number | number[]) => (Array.isArray(value) ? value[0] ?? 0 : value);
  const retryCountMarks = [
    0, 2, 4, 6, 8, 10,
  ].map((value) => ({ value, label: String(value) }));

  const simplifyAlgorithm = baseTransformConfig.simplifyAlgorithm ?? 'topojson';
  const simplifyRetryCount = typeof baseTransformConfig.retryCount === 'number'
    && Number.isFinite(baseTransformConfig.retryCount)
    ? clampRetryCount(baseTransformConfig.retryCount)
    : 4;
  const preserveTopology = baseTransformConfig.preserveTopology ?? true;
  const executionLogLevel = baseTransformConfig.executionLogLevel ?? 'summary';
  const toleranceFallback = 0.1;
  const toneCurveDefaultAnchorValues = [0.5, 0.5, 0.5, 0.5] as const;
  const toneCurveRetrySecondDefaultAnchorValues = [2, 1.5, 1, 1] as const;
  const toneCurveLineStyles = [
    {
      lineColor: '#0b5ed7',
      anchorPointColor: '#0b5ed7',
      lineWidth: 2,
    },
    {
      lineColor: '#ef4444',
      anchorPointColor: '#ef4444',
      lineWidth: 2,
      lineDashArray: '6 4',
    },
  ] as const;
  const bandCount = Math.max(1, baseTransformConfig.zoomBandBoundaries.length);
  const hasCompleteToleranceByBand = (baseTransformConfig.toleranceByBand?.length ?? 0) === bandCount;
  const resolvedToneCurveAnchors = hasCompleteToleranceByBand
    ? buildToneCurveAnchorsFromToleranceByBand(
      baseTransformConfig.toleranceByBand,
      baseTransformConfig.zoomBandBoundaries,
      toleranceFallback,
      toneCurveDefaultAnchorValues,
    )
    : buildToneCurveAnchorsFromToleranceByBand(
      undefined,
      baseTransformConfig.zoomBandBoundaries,
      toleranceFallback,
      toneCurveDefaultAnchorValues,
    );
  const hasCompleteRetryToleranceByBand = (baseTransformConfig.retryToleranceByBand?.length ?? 0) === bandCount;
  const resolvedToneCurveRetrySecondAnchors = hasCompleteRetryToleranceByBand
    ? buildToneCurveAnchorsFromToleranceByBand(
      baseTransformConfig.retryToleranceByBand,
      baseTransformConfig.zoomBandBoundaries,
      toleranceFallback,
      toneCurveRetrySecondDefaultAnchorValues,
    )
    : buildToneCurveAnchorsFromToleranceByBand(
      undefined,
      baseTransformConfig.zoomBandBoundaries,
      toleranceFallback,
      toneCurveRetrySecondDefaultAnchorValues,
    );
  const xMarks = baseTransformConfig.zoomBandBoundaries.map((value) => ({ value, label: String(value) }));

  const updateTransformConfig = (partial: Partial<ShapeBuildConfig['transformConfig']>) => (
    update({
      transformConfig: {
        ...baseTransformConfig,
        ...partial,
      },
    })
  );

  const summaryHelp = simplifyAlgorithm === 'topojson'
    ? t(
      'processing.transform.summaryHelpTopojson',
      'Transform uses topojson simplify first, then runs topology repair checks.',
    )
    : t(
      'processing.transform.summaryHelpGeojson',
      'Transform runs turf.simplify with the configured tolerance.',
    );

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <BuildConfigAccordionSummary
          icon={<TuneIcon color="primary" />}
          title={t('processing.transform.title', 'Transform')}
          info={summaryHelp}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ p: 1 }}>
        <Stack spacing={2} sx={{ opacity: disabled ? 0.6 : 1 }}>
          <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
            <Stack spacing={2}>
              <BuildConfigSectionTitle
                icon={<TuneIcon fontSize="small" color="primary" />}
                title={t('processing.transform.simplifySettings.title', 'Simplify settings')}
              />
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
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      updateTransformConfig({ preserveTopology: event.target.checked });
                    }}
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

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  {t('processing.transform.simplifyTolerance.label', 'Simplify tolerance')}
                </Typography>
                <ToneCurveEditor
                  width={500}
                  height={180}
                  xRange={[baseTransformConfig.zoomBandBoundaries[0] ?? 1, baseTransformConfig.zoomBandBoundaries.at(-1) ?? 11]}
                  yRange={[0, 12]}
                  lineStyles={toneCurveLineStyles}
                  xMarks={xMarks}
                  anchors={resolvedToneCurveAnchors}
                  xFixedValues={resolvedToneCurveAnchors.map((anchor) => anchor.x)}
                  allowAnchorCountChange={false}
                  xSnapStep={0.1}
                  ySnapStep={0.1}
                  overlaySeries={[
                    {
                      anchors: resolvedToneCurveRetrySecondAnchors,
                      xFixedValues: resolvedToneCurveRetrySecondAnchors.map((anchor) => anchor.x),
                      yFixedValues: [],
                      allowAnchorCountChange: false,
                      editable: false,
                      onChange: (overlayAnchors) => {
                        if (disabled) return;
                        const next = buildToleranceByBandFromToneCurveAnchors(
                          overlayAnchors,
                          baseTransformConfig.zoomBandBoundaries,
                          toleranceFallback,
                        );
                        updateTransformConfig({ retryToleranceByBand: next });
                      },
                    },
                  ]}
                  onChange={(anchors) => {
                    if (disabled) return;
                    const next = buildToleranceByBandFromToneCurveAnchors(
                      anchors,
                      baseTransformConfig.zoomBandBoundaries,
                      toleranceFallback,
                    );
                    updateTransformConfig({ toleranceByBand: next });
                  }}
                />
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  {t('processing.transform.retryToleranceStep.label', 'Retry count')}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ paddingTop: '32px' }}>
                  <Slider
                    sx={{ flex: 1 }}
                    value={simplifyRetryCount}
                    min={0}
                    max={10}
                    step={1}
                    marks={retryCountMarks}
                    disabled={disabled}
                    valueLabelDisplay="on"
                    onChange={(_event, value) => {
                      const next = clampRetryCount(resolveSliderNumber(value));
                      updateTransformConfig({ retryCount: next });
                    }}
                  />
                </Stack>
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
            <Stack spacing={2}>
              <BuildConfigSectionTitle
                icon={<InfoOutlinedIcon fontSize="small" color="primary" />}
                title={t('processing.transform.logging.title', 'Execution logging')}
              />
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
            </Stack>
          </Paper>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
