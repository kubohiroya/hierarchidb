import { SpacedSlider } from '@hierarchidb/components';
import { DEFAULT_MAX_RATIO_VALUE } from '@hierarchidb/shape-api';
import {
  BuildConfigSectionTitle,
  getBuildConfigHoverCardSx,
} from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { ToneCurveEditor } from '@hierarchidb/ui-tone-curve-editor';
import { Tune as TuneIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ShapeBuildConfig } from '~/common/types/BuildTaskResult';
import {
  buildToleranceByBandFromToneCurveAnchors,
  buildToneCurveAnchorsFromToleranceByBand,
} from '~/services/utils/toleranceByBand';

type Props = {
  geometryConfig: ShapeBuildConfig['geometryConfig'];
  disabled?: boolean;
  disableHoverLift?: boolean;
  onChange: (partial: Partial<ShapeBuildConfig['geometryConfig']>) => void;
};

type AdminLevelTabKey = 'admin0' | 'admin1' | 'admin2' | 'admin3Plus';

type AdminLevelProfile = {
  usePrevious: boolean;
  multiplierByBand: number[];
  minRatioByBand: number[];
  maxRatioByBand: number[];
  toleranceSearchMaxIterations: number;
};

type StoredAdminLevelProfile = {
  usePrevious?: boolean;
  multiplierByBand?: number[];
  minRatioByBand?: number[];
  maxRatioByBand?: number[];
  toleranceSearchMaxIterations?: number;
};

type StoredAdminLevelProfiles = Partial<Record<AdminLevelTabKey, StoredAdminLevelProfile>>;

const CURVE_Y_RANGE: [number, number] = [0, DEFAULT_MAX_RATIO_VALUE];
const DEFAULT_ITERATIONS = 24;
const DEFAULT_FALLBACK = 1;
const DEFAULT_MULTIPLIER_ANCHORS = [1, 1, 1, 1] as const;
const DEFAULT_MIN_RATIO_ANCHORS = [0, 0, 0, 0] as const;
const DEFAULT_MAX_RATIO_ANCHORS = [
  DEFAULT_MAX_RATIO_VALUE,
  DEFAULT_MAX_RATIO_VALUE,
  DEFAULT_MAX_RATIO_VALUE,
  DEFAULT_MAX_RATIO_VALUE,
] as const;

const ADMIN_LEVEL_TABS: ReadonlyArray<{ key: AdminLevelTabKey; label: string }> = [
  { key: 'admin0', label: 'Admin 0' },
  { key: 'admin1', label: 'Admin 1' },
  { key: 'admin2', label: 'Admin 2' },
  { key: 'admin3Plus', label: 'Admin 3+' },
] as const;

const PREVIOUS_TAB_BY_KEY: Partial<Record<AdminLevelTabKey, AdminLevelTabKey>> = {
  admin1: 'admin0',
  admin2: 'admin1',
  admin3Plus: 'admin2',
};

const clampIterations = (value: number): number => Math.min(64, Math.max(1, Math.round(value)));
const clampRatio = (value: number): number =>
  Math.max(0, Math.min(DEFAULT_MAX_RATIO_VALUE, Number.parseFloat(value.toFixed(3))));
const resolveSliderNumber = (value: number | number[]) =>
  Array.isArray(value) ? (value[0] ?? 0) : value;
const areRatioValuesEqual = (left: number, right: number): boolean =>
  Math.abs(clampRatio(left) - clampRatio(right)) < 1e-9;

const resolveRatioByBand = (
  input: number[] | undefined,
  zoomBandBoundaries: number[],
  fallbackAnchors: readonly [number, number, number, number]
): number[] => {
  const fallback = fallbackAnchors[0] ?? DEFAULT_FALLBACK;
  return buildToneCurveAnchorsFromToleranceByBand(
    input,
    zoomBandBoundaries,
    fallback,
    fallbackAnchors
  ).map((anchor) => clampRatio(anchor.y));
};

const resolveStoredProfiles = (
  geometryConfig: ShapeBuildConfig['geometryConfig']
): StoredAdminLevelProfiles => {
  const raw = geometryConfig.simplifyToleranceByAdminLevel;
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  return raw as StoredAdminLevelProfiles;
};

const resolveEditableProfile = (
  key: AdminLevelTabKey,
  geometryConfig: ShapeBuildConfig['geometryConfig'],
  storedProfiles: StoredAdminLevelProfiles
): AdminLevelProfile => {
  const raw = storedProfiles[key];
  return {
    usePrevious: key === 'admin0' ? false : raw?.usePrevious === true,
    multiplierByBand: resolveRatioByBand(
      raw?.multiplierByBand ?? geometryConfig.toleranceMultiplierByBand,
      geometryConfig.zoomBandBoundaries,
      DEFAULT_MULTIPLIER_ANCHORS
    ),
    minRatioByBand: resolveRatioByBand(
      raw?.minRatioByBand ?? geometryConfig.toleranceMinRatioByBand,
      geometryConfig.zoomBandBoundaries,
      DEFAULT_MIN_RATIO_ANCHORS
    ),
    maxRatioByBand: resolveRatioByBand(
      raw?.maxRatioByBand ?? geometryConfig.toleranceMaxRatioByBand,
      geometryConfig.zoomBandBoundaries,
      DEFAULT_MAX_RATIO_ANCHORS
    ),
    toleranceSearchMaxIterations:
      typeof raw?.toleranceSearchMaxIterations === 'number'
        ? clampIterations(raw.toleranceSearchMaxIterations)
        : clampIterations(geometryConfig.toleranceSearchMaxIterations ?? DEFAULT_ITERATIONS),
  };
};

const resolveEffectiveProfiles = (
  geometryConfig: ShapeBuildConfig['geometryConfig'],
  storedProfiles: StoredAdminLevelProfiles
): Record<AdminLevelTabKey, AdminLevelProfile> => {
  const base: Record<AdminLevelTabKey, AdminLevelProfile> = {
    admin0: resolveEditableProfile('admin0', geometryConfig, storedProfiles),
    admin1: resolveEditableProfile('admin1', geometryConfig, storedProfiles),
    admin2: resolveEditableProfile('admin2', geometryConfig, storedProfiles),
    admin3Plus: resolveEditableProfile('admin3Plus', geometryConfig, storedProfiles),
  };

  const admin1UsePrevious = base.admin1.usePrevious;
  const admin2UsePrevious = base.admin2.usePrevious;
  const admin3UsePrevious = base.admin3Plus.usePrevious;

  return {
    admin0: base.admin0,
    admin1: admin1UsePrevious ? base.admin0 : base.admin1,
    admin2: admin2UsePrevious ? (admin1UsePrevious ? base.admin0 : base.admin1) : base.admin2,
    admin3Plus: admin3UsePrevious
      ? admin2UsePrevious
        ? admin1UsePrevious
          ? base.admin0
          : base.admin1
        : base.admin2
      : base.admin3Plus,
  };
};

const clampProfileBands = (
  multiplierByBand: number[],
  minRatioByBand: number[],
  maxRatioByBand: number[]
): Pick<AdminLevelProfile, 'multiplierByBand' | 'minRatioByBand' | 'maxRatioByBand'> => {
  const maxLength = Math.max(multiplierByBand.length, minRatioByBand.length, maxRatioByBand.length);
  const nextMultiplier: number[] = [];
  const nextMin: number[] = [];
  const nextMax: number[] = [];
  for (let index = 0; index < maxLength; index += 1) {
    const rawMin = clampRatio(minRatioByBand[index] ?? 0);
    const rawMax = clampRatio(maxRatioByBand[index] ?? DEFAULT_MAX_RATIO_VALUE);
    const minValue = Math.min(rawMin, rawMax);
    const maxValue = Math.max(rawMin, rawMax);
    const rawMultiplier = clampRatio(multiplierByBand[index] ?? 1);
    const multiplierValue = Math.max(minValue, Math.min(maxValue, rawMultiplier));
    nextMin.push(minValue);
    nextMax.push(maxValue);
    nextMultiplier.push(multiplierValue);
  }
  return {
    multiplierByBand: nextMultiplier,
    minRatioByBand: nextMin,
    maxRatioByBand: nextMax,
  };
};

export const SimplifyToleranceByAdminLevelCard: React.FC<Props> = ({
  geometryConfig,
  disabled,
  disableHoverLift = false,
  onChange,
}) => {
  const { t } = useTranslation('shape-plugin');
  const [activeTab, setActiveTab] = useState<AdminLevelTabKey>('admin0');
  const curveWidthRef = useRef<HTMLDivElement | null>(null);
  const [simplifyCurveWidth, setSimplifyCurveWidth] = useState(500);
  const hoverCardSx = getBuildConfigHoverCardSx(disabled, disableHoverLift);

  const storedProfiles = useMemo(() => resolveStoredProfiles(geometryConfig), [geometryConfig]);
  const editableProfiles = useMemo(
    () => ({
      admin0: resolveEditableProfile('admin0', geometryConfig, storedProfiles),
      admin1: resolveEditableProfile('admin1', geometryConfig, storedProfiles),
      admin2: resolveEditableProfile('admin2', geometryConfig, storedProfiles),
      admin3Plus: resolveEditableProfile('admin3Plus', geometryConfig, storedProfiles),
    }),
    [storedProfiles, geometryConfig]
  );

  const effectiveProfiles = useMemo(
    () => resolveEffectiveProfiles(geometryConfig, storedProfiles),
    [storedProfiles, geometryConfig]
  );

  const activeEditable = editableProfiles[activeTab];
  const activeEffective = effectiveProfiles[activeTab];
  const previousTabKey = PREVIOUS_TAB_BY_KEY[activeTab];
  const hasReferenceToggle = activeTab !== 'admin0';
  const usePrevious = hasReferenceToggle ? activeEditable.usePrevious : false;
  const controlsDisabled = Boolean(disabled || usePrevious);
  const activeValues = usePrevious ? activeEffective : activeEditable;

  const xMarks = geometryConfig.zoomBandBoundaries.map((value) => ({
    value,
    label: String(value),
  }));
  const iterationMarks = [8, 16, 24, 32, 48, 64].map((value) => ({ value, label: String(value) }));
  const buildZoomLabel = useCallback(
    (zoomValue: number): string =>
      t('processing.geometry.simplifyTolerance.zoomLabel', 'Zoom {{zoom}}', {
        zoom: Number.isFinite(zoomValue) ? Number.parseFloat(zoomValue.toFixed(3)) : '-',
      }),
    [t]
  );

  const resolvedMultiplierAnchors = buildToneCurveAnchorsFromToleranceByBand(
    activeValues.multiplierByBand,
    geometryConfig.zoomBandBoundaries,
    DEFAULT_MULTIPLIER_ANCHORS[0] ?? DEFAULT_FALLBACK,
    DEFAULT_MULTIPLIER_ANCHORS
  );
  const resolvedMinAnchors = buildToneCurveAnchorsFromToleranceByBand(
    activeValues.minRatioByBand,
    geometryConfig.zoomBandBoundaries,
    DEFAULT_MIN_RATIO_ANCHORS[0] ?? 0,
    DEFAULT_MIN_RATIO_ANCHORS
  );
  const resolvedMaxAnchors = buildToneCurveAnchorsFromToleranceByBand(
    activeValues.maxRatioByBand,
    geometryConfig.zoomBandBoundaries,
    DEFAULT_MAX_RATIO_ANCHORS[0] ?? DEFAULT_MAX_RATIO_VALUE,
    DEFAULT_MAX_RATIO_ANCHORS
  );

  const updateStoredProfile = useCallback(
    (key: AdminLevelTabKey, partial: Partial<StoredAdminLevelProfile>) => {
      const nextProfiles = {
        admin0: { ...(storedProfiles.admin0 ?? {}) },
        admin1: { ...(storedProfiles.admin1 ?? {}) },
        admin2: { ...(storedProfiles.admin2 ?? {}) },
        admin3Plus: { ...(storedProfiles.admin3Plus ?? {}) },
      };
      nextProfiles[key] = {
        ...(nextProfiles[key] ?? {}),
        ...partial,
      };

      const patch: Partial<ShapeBuildConfig['geometryConfig']> = {
        simplifyToleranceByAdminLevel: nextProfiles,
      };

      if (key === 'admin0') {
        const admin0 = nextProfiles.admin0 ?? {};
        if (Array.isArray(admin0.multiplierByBand)) {
          patch.toleranceMultiplierByBand = admin0.multiplierByBand;
        }
        if (Array.isArray(admin0.minRatioByBand)) {
          patch.toleranceMinRatioByBand = admin0.minRatioByBand;
        }
        if (Array.isArray(admin0.maxRatioByBand)) {
          patch.toleranceMaxRatioByBand = admin0.maxRatioByBand;
        }
        if (
          typeof admin0.toleranceSearchMaxIterations === 'number' &&
          Number.isFinite(admin0.toleranceSearchMaxIterations)
        ) {
          patch.toleranceSearchMaxIterations = clampIterations(admin0.toleranceSearchMaxIterations);
        }
      }

      onChange(patch);
    },
    [onChange, storedProfiles]
  );

  const updateBands = useCallback(
    (nextPartial: {
      multiplierByBand?: number[];
      minRatioByBand?: number[];
      maxRatioByBand?: number[];
    }) => {
      const mergedMultiplier = nextPartial.multiplierByBand ?? activeEditable.multiplierByBand;
      const mergedMin = nextPartial.minRatioByBand ?? activeEditable.minRatioByBand;
      const mergedMax = nextPartial.maxRatioByBand ?? activeEditable.maxRatioByBand;
      const normalized = clampProfileBands(mergedMultiplier, mergedMin, mergedMax);

      const isSameMultiplier =
        normalized.multiplierByBand.length === activeEditable.multiplierByBand.length &&
        normalized.multiplierByBand.every((value, index) =>
          areRatioValuesEqual(value, activeEditable.multiplierByBand[index] ?? value)
        );
      const isSameMin =
        normalized.minRatioByBand.length === activeEditable.minRatioByBand.length &&
        normalized.minRatioByBand.every((value, index) =>
          areRatioValuesEqual(value, activeEditable.minRatioByBand[index] ?? value)
        );
      const isSameMax =
        normalized.maxRatioByBand.length === activeEditable.maxRatioByBand.length &&
        normalized.maxRatioByBand.every((value, index) =>
          areRatioValuesEqual(value, activeEditable.maxRatioByBand[index] ?? value)
        );

      if (isSameMultiplier && isSameMin && isSameMax) {
        return;
      }

      updateStoredProfile(activeTab, {
        multiplierByBand: normalized.multiplierByBand,
        minRatioByBand: normalized.minRatioByBand,
        maxRatioByBand: normalized.maxRatioByBand,
      });
    },
    [
      activeEditable.maxRatioByBand,
      activeEditable.minRatioByBand,
      activeEditable.multiplierByBand,
      activeTab,
      updateStoredProfile,
    ]
  );

  const copyFromPreviousTab = useCallback(() => {
    if (!previousTabKey || controlsDisabled) {
      return;
    }
    const source = effectiveProfiles[previousTabKey];
    updateStoredProfile(activeTab, {
      usePrevious: false,
      multiplierByBand: source.multiplierByBand,
      minRatioByBand: source.minRatioByBand,
      maxRatioByBand: source.maxRatioByBand,
      toleranceSearchMaxIterations: source.toleranceSearchMaxIterations,
    });
  }, [activeTab, controlsDisabled, effectiveProfiles, previousTabKey, updateStoredProfile]);

  const toneCurveLineStyles = [
    {
      lineColor: '#0b5ed7',
      anchorPointColor: '#0b5ed7',
      lineWidth: 2,
    },
    {
      lineColor: '#6b7280',
      anchorPointColor: '#6b7280',
      lineWidth: 2,
      lineDashArray: '6 4',
    },
    {
      lineColor: '#ef4444',
      anchorPointColor: '#ef4444',
      lineWidth: 2,
      lineDashArray: '6 4',
    },
  ] as const;

  const spinnerTextFieldSx = {
    width: 160,
    '& .MuiInputLabel-root': {
      whiteSpace: 'nowrap',
    },
  } as const;

  useEffect(() => {
    const node = curveWidthRef.current;
    if (!node) return;

    const updateWidth = () => {
      const nextWidth = Math.max(280, node.clientWidth);
      setSimplifyCurveWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
      <Stack spacing={2}>
        <BuildConfigSectionTitle
          icon={<TuneIcon fontSize="small" color="primary" />}
          title={t('processing.geometry.simplifySettings.title', 'Simplify settings')}
        />

        <Tabs
          value={activeTab}
          onChange={(_event, value: AdminLevelTabKey) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {ADMIN_LEVEL_TABS.map((tab) => (
            <Tab key={tab.key} value={tab.key} label={tab.label} />
          ))}
        </Tabs>

        {hasReferenceToggle ? (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={usePrevious}
                  onChange={(event) => {
                    updateStoredProfile(activeTab, { usePrevious: event.target.checked });
                  }}
                  disabled={disabled}
                />
              }
              label={t(
                'processing.geometry.adminLevel.usePrevious',
                'Use values from previous tab'
              )}
            />
            <Button
              variant="outlined"
              onClick={copyFromPreviousTab}
              disabled={Boolean(disabled || usePrevious)}
            >
              {t('processing.geometry.adminLevel.copyPrevious', 'Copy values from previous tab')}
            </Button>
          </Stack>
        ) : null}

        <Box sx={{ opacity: controlsDisabled ? 0.6 : 1 }}>
          <Grid container spacing={3} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  {t('processing.geometry.simplifyTolerance.label', 'Simplify tolerance profile')}
                </Typography>
                <div ref={curveWidthRef} style={{ width: '100%' }}>
                  <ToneCurveEditor
                    width={simplifyCurveWidth}
                    height={180}
                    xRange={[
                      geometryConfig.zoomBandBoundaries[0] ?? 1,
                      geometryConfig.zoomBandBoundaries.at(-1) ?? 11,
                    ]}
                    yRange={CURVE_Y_RANGE}
                    lineStyles={toneCurveLineStyles}
                    xMarks={xMarks}
                    anchors={resolvedMultiplierAnchors}
                    xFixedValues={resolvedMultiplierAnchors.map((anchor) => anchor.x)}
                    allowAnchorCountChange={false}
                    horizontalZoom={false}
                    verticalZoom
                    xSnapStep={0.1}
                    ySnapStep={0.05}
                    overlaySeries={[
                      {
                        anchors: resolvedMinAnchors,
                        xFixedValues: resolvedMinAnchors.map((anchor) => anchor.x),
                        allowAnchorCountChange: false,
                        editable: !controlsDisabled,
                        onChange: (overlayAnchors) => {
                          if (controlsDisabled) return;
                          const next = buildToleranceByBandFromToneCurveAnchors(
                            overlayAnchors,
                            geometryConfig.zoomBandBoundaries,
                            DEFAULT_MIN_RATIO_ANCHORS[0] ?? 0
                          ).map((value) => clampRatio(value));
                          updateBands({ minRatioByBand: next });
                        },
                      },
                      {
                        anchors: resolvedMaxAnchors,
                        xFixedValues: resolvedMaxAnchors.map((anchor) => anchor.x),
                        allowAnchorCountChange: false,
                        editable: !controlsDisabled,
                        onChange: (overlayAnchors) => {
                          if (controlsDisabled) return;
                          const next = buildToleranceByBandFromToneCurveAnchors(
                            overlayAnchors,
                            geometryConfig.zoomBandBoundaries,
                            DEFAULT_MAX_RATIO_ANCHORS[0] ?? DEFAULT_MAX_RATIO_VALUE
                          ).map((value) => clampRatio(value));
                          updateBands({ maxRatioByBand: next });
                        },
                      },
                    ]}
                    onChange={(anchors) => {
                      if (controlsDisabled) return;
                      const next = buildToleranceByBandFromToneCurveAnchors(
                        anchors,
                        geometryConfig.zoomBandBoundaries,
                        DEFAULT_MULTIPLIER_ANCHORS[0] ?? DEFAULT_FALLBACK
                      ).map((value) => clampRatio(value));
                      updateBands({ multiplierByBand: next });
                    }}
                  />
                </div>

                <Paper
                  variant="outlined"
                  sx={{
                    mt: 1,
                    p: 1,
                    borderColor: '#ef4444',
                    width: '100%',
                    overflow: 'visible',
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: 'nowrap', overflowX: 'auto', pt: 1 }}
                  >
                    <Typography width={80}>Max ratio</Typography>
                    {resolvedMaxAnchors.map((anchor, index) => (
                      <TextField
                        key={`max-anchor-${String(index)}`}
                        label={buildZoomLabel(anchor.x)}
                        type="number"
                        size="small"
                        value={clampRatio(anchor.y)}
                        inputProps={{
                          step: 0.05,
                          min: CURVE_Y_RANGE[0],
                          max: CURVE_Y_RANGE[1],
                        }}
                        disabled={controlsDisabled}
                        onChange={(event) => {
                          const nextValue = Number.parseFloat(event.target.value);
                          if (!Number.isFinite(nextValue)) return;
                          const next = [...activeEditable.maxRatioByBand];
                          next[index] = clampRatio(nextValue);
                          updateBands({ maxRatioByBand: next });
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
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: 'nowrap', overflowX: 'auto', pt: 1 }}
                  >
                    <Typography width={80}>Multiplier</Typography>
                    {resolvedMultiplierAnchors.map((anchor, index) => (
                      <TextField
                        key={`multiplier-anchor-${String(index)}`}
                        label={buildZoomLabel(anchor.x)}
                        type="number"
                        size="small"
                        value={clampRatio(anchor.y)}
                        inputProps={{
                          step: 0.05,
                          min: CURVE_Y_RANGE[0],
                          max: CURVE_Y_RANGE[1],
                        }}
                        disabled={controlsDisabled}
                        onChange={(event) => {
                          const nextValue = Number.parseFloat(event.target.value);
                          if (!Number.isFinite(nextValue)) return;
                          const next = [...activeEditable.multiplierByBand];
                          next[index] = clampRatio(nextValue);
                          updateBands({ multiplierByBand: next });
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
                    borderColor: '#6b7280',
                    width: '100%',
                    overflow: 'visible',
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: 'nowrap', overflowX: 'auto', pt: 1 }}
                  >
                    <Typography width={80}>Min ratio</Typography>
                    {resolvedMinAnchors.map((anchor, index) => (
                      <TextField
                        key={`min-anchor-${String(index)}`}
                        label={buildZoomLabel(anchor.x)}
                        type="number"
                        size="small"
                        value={clampRatio(anchor.y)}
                        inputProps={{
                          step: 0.05,
                          min: CURVE_Y_RANGE[0],
                          max: CURVE_Y_RANGE[1],
                        }}
                        disabled={controlsDisabled}
                        onChange={(event) => {
                          const nextValue = Number.parseFloat(event.target.value);
                          if (!Number.isFinite(nextValue)) return;
                          const next = [...activeEditable.minRatioByBand];
                          next[index] = clampRatio(nextValue);
                          updateBands({ minRatioByBand: next });
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
                  {t('processing.geometry.retryToleranceStep.label', 'Max search iterations')}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ paddingTop: '32px' }}>
                  <SpacedSlider
                    topSpacing={16}
                    sx={{ flex: 1, minWidth: 220 }}
                    value={activeValues.toleranceSearchMaxIterations}
                    min={1}
                    max={64}
                    step={1}
                    marks={iterationMarks}
                    disabled={controlsDisabled}
                    valueLabelDisplay="on"
                    onChange={(_event, value) => {
                      const next = clampIterations(resolveSliderNumber(value));
                      if (next === activeEditable.toleranceSearchMaxIterations) {
                        return;
                      }
                      updateStoredProfile(activeTab, { toleranceSearchMaxIterations: next });
                    }}
                  />
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Box>

        <Typography variant="caption" color="text.secondary">
          {t(
            'processing.geometry.adminLevel.description',
            'Configure simplify tolerance by admin level. Admin 1+ can reference values from the previous tab.'
          )}
        </Typography>
      </Stack>
    </Paper>
  );
};
