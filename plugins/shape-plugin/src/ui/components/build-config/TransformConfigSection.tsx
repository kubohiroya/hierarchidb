import {
  Grid,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Switch,
  FormControl,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import {
  BuildConfigAccordionSummary,
  BuildConfigSectionTitle,
  getBuildConfigHoverCardSx,
} from '@hierarchidb/ui-accordion-config';
import { ToneCurveEditor } from '@hierarchidb/ui-tone-curve-editor';
import { useTranslation } from '~/ui/i18n';
import { type ShapeBuildConfig } from '~/common/types/index';
import { useTransformConfigSection } from '~/ui/hooks/useTransformConfigSection';
import { buildToleranceByBandFromToneCurveAnchors, buildToneCurveAnchorsFromToleranceByBand } from '~/services/utils/toleranceByBand';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  disabled?: boolean;
  disableHoverLift?: boolean;
};

const CURVE_Y_RANGE: [number, number] = [0, 12];

export const TransformConfigSection: React.FC<Props> = ({
  config,
  onChange,
  disabled,
  disableHoverLift = false,
}) => {
  const { t } = useTranslation();
  const { baseTransformConfig, update } = useTransformConfigSection({ config, onChange });
  const hoverCardSx = getBuildConfigHoverCardSx(disabled, disableHoverLift);
  const normalizeToleranceValue = useCallback((value: number): number => (
    Number.parseFloat(value.toFixed(3))
  ), []);
  const clampToCurveYRange = useCallback((value: number) => (
    Math.max(CURVE_Y_RANGE[0], Math.min(CURVE_Y_RANGE[1], value))
  ), []);
  const areToleranceValuesEqual = useCallback((left: number, right: number): boolean => {
    return Math.abs(normalizeToleranceValue(left) - normalizeToleranceValue(right)) < 1e-9;
  }, [normalizeToleranceValue]);
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
  const toneCurveDefaultAnchorValues = [0.1, 0.1, 0.1, 0.1] as const;
  const toneCurveRetrySecondDefaultAnchorValues = [0.2, 0.2, 0.3, 0.4] as const;
  const toneCurveDefaultFallback = toneCurveDefaultAnchorValues[0] ?? 0.1;
  const toneCurveRetryFallback = toneCurveRetrySecondDefaultAnchorValues[0] ?? 0.1;
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
      toneCurveDefaultFallback,
      toneCurveDefaultAnchorValues,
    )
    : buildToneCurveAnchorsFromToleranceByBand(
      undefined,
      baseTransformConfig.zoomBandBoundaries,
      toneCurveDefaultFallback,
      toneCurveDefaultAnchorValues,
    );
  const hasCompleteRetryToleranceByBand = (baseTransformConfig.retryToleranceByBand?.length ?? 0) === bandCount;
  const resolvedToneCurveRetrySecondAnchors = hasCompleteRetryToleranceByBand
    ? buildToneCurveAnchorsFromToleranceByBand(
      baseTransformConfig.retryToleranceByBand,
      baseTransformConfig.zoomBandBoundaries,
      toneCurveRetryFallback,
      toneCurveRetrySecondDefaultAnchorValues,
    )
    : buildToneCurveAnchorsFromToleranceByBand(
      undefined,
      baseTransformConfig.zoomBandBoundaries,
      toneCurveRetryFallback,
      toneCurveRetrySecondDefaultAnchorValues,
    );
  const xMarks = baseTransformConfig.zoomBandBoundaries.map((value) => ({ value, label: String(value) }));

  const updateTransformConfig = useCallback((partial: Partial<ShapeBuildConfig['transformConfig']>) => (
    update({
      transformConfig: partial,
    })
  ), [update]);
  const handleMainAnchorYChange = useCallback((index: number, rawValue: number) => {
    if (disabled || !Number.isFinite(rawValue)) {
      return;
    }

    const nextAnchors = resolvedToneCurveAnchors.map((anchor, anchorIndex) => (
      anchorIndex === index ? { ...anchor, y: clampToCurveYRange(rawValue) } : anchor
    ));
    const next = buildToleranceByBandFromToneCurveAnchors(
      nextAnchors,
      baseTransformConfig.zoomBandBoundaries,
      toneCurveDefaultFallback,
    );
    const normalized = next.map((value) => normalizeToleranceValue(value));

    if (next.length === (baseTransformConfig.toleranceByBand?.length ?? 0)
      && next.every((value, toleranceIndex) => areToleranceValuesEqual(
        value,
        baseTransformConfig.toleranceByBand?.[toleranceIndex] ?? value,
      ))
    ) {
      return;
    }
    updateTransformConfig({ toleranceByBand: normalized });
  }, [
    baseTransformConfig.toleranceByBand,
    baseTransformConfig.zoomBandBoundaries,
    clampToCurveYRange,
    disabled,
    resolvedToneCurveAnchors,
    normalizeToleranceValue,
    toneCurveDefaultFallback,
    areToleranceValuesEqual,
    updateTransformConfig,
  ]);

  const handleRetryAnchorYChange = useCallback((index: number, rawValue: number) => {
    if (disabled || !Number.isFinite(rawValue)) {
      return;
    }

    const nextAnchors = resolvedToneCurveRetrySecondAnchors.map((anchor, anchorIndex) => (
      anchorIndex === index ? { ...anchor, y: clampToCurveYRange(rawValue) } : anchor
    ));
    const next = buildToleranceByBandFromToneCurveAnchors(
      nextAnchors,
      baseTransformConfig.zoomBandBoundaries,
      toneCurveRetryFallback,
    );
    const normalized = next.map((value) => normalizeToleranceValue(value));

    if (next.length === (baseTransformConfig.retryToleranceByBand?.length ?? 0)
      && next.every((value, toleranceIndex) => areToleranceValuesEqual(
        value,
        baseTransformConfig.retryToleranceByBand?.[toleranceIndex] ?? value,
      ))
    ) {
      return;
    }
    updateTransformConfig({ retryToleranceByBand: normalized });
  }, [
    baseTransformConfig.retryToleranceByBand,
    baseTransformConfig.zoomBandBoundaries,
    clampToCurveYRange,
    disabled,
    resolvedToneCurveRetrySecondAnchors,
    normalizeToleranceValue,
    toneCurveRetryFallback,
    areToleranceValuesEqual,
    updateTransformConfig,
  ]);
  const spinnerTextFieldSx = {
    width: 160,
    '& .MuiInputLabel-root': {
      whiteSpace: 'nowrap',
    },
  } as const;

  const curveWidthRef = useRef<HTMLDivElement | null>(null);
  const [simplifyCurveWidth, setSimplifyCurveWidth] = useState(500);

  useEffect(() => {
    const node = curveWidthRef.current;
    if (!node) {
      return;
    }

    const update = () => {
      const nextWidth = Math.max(280, node.clientWidth);
      setSimplifyCurveWidth(nextWidth);
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

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
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
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
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack spacing={0.5}>
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
                  </Stack>
                </Grid>
              </Grid>

              <Grid container spacing={3} alignItems="flex-start">
                <Grid size={{ xs: 12, md: 8 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      {t('processing.transform.simplifyTolerance.label', 'Simplify tolerance')}
                    </Typography>
                    <div ref={curveWidthRef} style={{ width: '100%' }}>
                      <ToneCurveEditor
                        width={simplifyCurveWidth}
                        height={180}
                        xRange={[
                          baseTransformConfig.zoomBandBoundaries[0] ?? 1,
                          baseTransformConfig.zoomBandBoundaries.at(-1) ?? 11,
                        ]}
                        yRange={CURVE_Y_RANGE}
                        lineStyles={toneCurveLineStyles}
                        xMarks={xMarks}
                        anchors={resolvedToneCurveAnchors}
                        xFixedValues={resolvedToneCurveAnchors.map((anchor) => anchor.x)}
                        allowAnchorCountChange={false}
                        horizontalZoom={false}
                        verticalZoom
                        xSnapStep={0.1}
                        ySnapStep={0.1}
                        overlaySeries={[
                          {
                            anchors: resolvedToneCurveRetrySecondAnchors,
                            xFixedValues: resolvedToneCurveRetrySecondAnchors.map((anchor) => anchor.x),
                            yFixedValues: [],
                            allowAnchorCountChange: false,
                            editable: true,
                            onChange: (overlayAnchors) => {
                              if (disabled) return;
                              const next = buildToleranceByBandFromToneCurveAnchors(
                                overlayAnchors,
                                baseTransformConfig.zoomBandBoundaries,
                                toneCurveRetryFallback,
                              );
                              const normalized = next.map((value) => normalizeToleranceValue(value));
                              if (next.length === (baseTransformConfig.retryToleranceByBand?.length ?? 0)
                                && next.every((value, index) => areToleranceValuesEqual(
                                  value,
                                  baseTransformConfig.retryToleranceByBand?.[index] ?? value,
                                ))
                              ) {
                                return;
                              }
                              updateTransformConfig({ retryToleranceByBand: normalized });
                            },
                          },
                        ]}
                        onChange={(anchors) => {
                          if (disabled) return;
                          const next = buildToleranceByBandFromToneCurveAnchors(
                            anchors,
                            baseTransformConfig.zoomBandBoundaries,
                            toneCurveDefaultFallback,
                          );
                          const normalized = next.map((value) => normalizeToleranceValue(value));
                          if (next.length === (baseTransformConfig.toleranceByBand?.length ?? 0)
                            && next.every((value, index) => areToleranceValuesEqual(
                              value,
                              baseTransformConfig.toleranceByBand?.[index] ?? value,
                            ))
                          ) {
                            return;
                          }
                          updateTransformConfig({ toleranceByBand: normalized });
                        }}
                      />
                    </div>
                    <Paper
                      variant="outlined"
                      sx={{
                        mt: 1.5,
                        p: 1,
                        borderColor: '#ef4444',
                        width: '100%',
                        overflow: 'visible',
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'nowrap', overflowX: 'auto', pt: 1 }}>
                        {resolvedToneCurveRetrySecondAnchors.map((anchor, index) => (
                          <TextField
                            key={`retry-anchor-${index}`}
                            label={String(normalizeToleranceValue(anchor.x))}
                            type="number"
                            size="small"
                            value={normalizeToleranceValue(anchor.y)}
                            inputProps={{
                              step: 0.1,
                              min: CURVE_Y_RANGE[0],
                              max: CURVE_Y_RANGE[1],
                            }}
                            disabled={disabled}
                            onChange={(event) => {
                              const nextValue = Number.parseFloat(event.target.value);
                              handleRetryAnchorYChange(index, nextValue);
                            }}
                            sx={spinnerTextFieldSx}
                          />
                        ))}
                      </Stack>
                    </Paper>
                    <Paper
                      variant="outlined"
                      sx={{
                        mt: 1,
                        p: 1,
                        borderColor: '#0b5ed7',
                        width: '100%',
                        overflow: 'visible',
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'nowrap', overflowX: 'auto', pt: 1 }}>
                        {resolvedToneCurveAnchors.map((anchor, index) => (
                          <TextField
                            key={`anchor-${index}`}
                            label={String(normalizeToleranceValue(anchor.x))}
                            type="number"
                            size="small"
                            value={normalizeToleranceValue(anchor.y)}
                            inputProps={{
                              step: 0.1,
                              min: CURVE_Y_RANGE[0],
                              max: CURVE_Y_RANGE[1],
                            }}
                            disabled={disabled}
                            onChange={(event) => {
                              const nextValue = Number.parseFloat(event.target.value);
                              handleMainAnchorYChange(index, nextValue);
                            }}
                            sx={spinnerTextFieldSx}
                          />
                        ))}
                      </Stack>
                    </Paper>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack spacing={0.5} alignItems="flex-start">
                    <Typography variant="body2" color="text.secondary">
                      {t('processing.transform.retryToleranceStep.label', 'Retry count')}
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ paddingTop: '20px' }}>
                      <Slider
                        sx={{ flex: 1, minWidth: 220 }}
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
                </Grid>
              </Grid>
            </Stack>
          </Paper>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
