import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Grid,
  Paper,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  FormControlLabel,
} from '@mui/material';
import { Tune as TuneIcon } from '@mui/icons-material';
import { ToneCurveEditor } from '@hierarchidb/ui-tone-curve-editor';
import { BuildConfigSectionTitle, getBuildConfigHoverCardSx } from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '~/ui/i18n';
import type { ShapeBuildConfig } from '~/common/types/index';
import { buildToneCurveAnchorsFromToleranceByBand, buildToleranceByBandFromToneCurveAnchors } from '~/services/utils/toleranceByBand';

type Props = {
  transformConfig: ShapeBuildConfig['transformConfig'];
  disabled?: boolean;
  disableHoverLift?: boolean;
  onChange: (partial: Partial<ShapeBuildConfig['transformConfig']>) => void;
};

type AdminLevelTabKey = 'admin0' | 'admin1' | 'admin2' | 'admin3Plus';

type AdminLevelProfile = {
  usePrevious: boolean;
  toleranceByBand: number[];
  retryToleranceByBand: number[];
  retryCount: number;
};

type StoredAdminLevelProfile = {
  usePrevious?: boolean;
  toleranceByBand?: number[];
  retryToleranceByBand?: number[];
  retryCount?: number;
};

type StoredAdminLevelProfiles = Partial<Record<AdminLevelTabKey, StoredAdminLevelProfile>>;

const CURVE_Y_RANGE: [number, number] = [0, 12];
const DEFAULT_RETRY_COUNT = 4;
const DEFAULT_TOLERANCE_FALLBACK = 0.1;
const DEFAULT_MAIN_ANCHORS = [0.1, 0.1, 0.1, 0.1] as const;
const DEFAULT_RETRY_ANCHORS = [0.2, 0.2, 0.3, 0.4] as const;

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

const clampRetryCount = (value: number): number => Math.min(10, Math.max(0, Math.round(value)));

const resolveSliderNumber = (value: number | number[]) => (Array.isArray(value) ? value[0] ?? 0 : value);

const normalizeToleranceValue = (value: number): number => Number.parseFloat(value.toFixed(3));

const clampToCurveYRange = (value: number): number => Math.max(CURVE_Y_RANGE[0], Math.min(CURVE_Y_RANGE[1], value));

const areToleranceValuesEqual = (left: number, right: number): boolean => (
  Math.abs(normalizeToleranceValue(left) - normalizeToleranceValue(right)) < 1e-9
);

const resolveToleranceByBand = (
  input: number[] | undefined,
  zoomBandBoundaries: number[],
  fallbackAnchors: readonly [number, number, number, number],
): number[] => {
  const fallback = fallbackAnchors[0] ?? DEFAULT_TOLERANCE_FALLBACK;
  return buildToneCurveAnchorsFromToleranceByBand(
    input,
    zoomBandBoundaries,
    fallback,
    fallbackAnchors,
  ).map((anchor) => normalizeToleranceValue(anchor.y));
};

const resolveRetryCount = (input: number | undefined, fallback: number): number => {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return clampRetryCount(input);
  }
  return clampRetryCount(fallback);
};

const resolveStoredProfiles = (
  transformConfig: ShapeBuildConfig['transformConfig'],
): StoredAdminLevelProfiles => {
  const raw = transformConfig.simplifyToleranceByAdminLevel;
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  return raw as StoredAdminLevelProfiles;
};

const resolveEditableProfile = (
  key: AdminLevelTabKey,
  transformConfig: ShapeBuildConfig['transformConfig'],
  storedProfiles: StoredAdminLevelProfiles,
): AdminLevelProfile => {
  const raw = storedProfiles[key];
  return {
    usePrevious: key === 'admin0' ? false : raw?.usePrevious === true,
    toleranceByBand: resolveToleranceByBand(
      raw?.toleranceByBand ?? transformConfig.toleranceByBand,
      transformConfig.zoomBandBoundaries,
      DEFAULT_MAIN_ANCHORS,
    ),
    retryToleranceByBand: resolveToleranceByBand(
      raw?.retryToleranceByBand ?? transformConfig.retryToleranceByBand,
      transformConfig.zoomBandBoundaries,
      DEFAULT_RETRY_ANCHORS,
    ),
    retryCount: resolveRetryCount(raw?.retryCount, transformConfig.retryCount ?? DEFAULT_RETRY_COUNT),
  };
};

const resolveEffectiveProfiles = (
  transformConfig: ShapeBuildConfig['transformConfig'],
  storedProfiles: StoredAdminLevelProfiles,
): Record<AdminLevelTabKey, AdminLevelProfile> => {
  const base: Record<AdminLevelTabKey, AdminLevelProfile> = {
    admin0: resolveEditableProfile('admin0', transformConfig, storedProfiles),
    admin1: resolveEditableProfile('admin1', transformConfig, storedProfiles),
    admin2: resolveEditableProfile('admin2', transformConfig, storedProfiles),
    admin3Plus: resolveEditableProfile('admin3Plus', transformConfig, storedProfiles),
  };

  const admin1UsePrevious = base.admin1.usePrevious;
  const admin2UsePrevious = base.admin2.usePrevious;
  const admin3UsePrevious = base.admin3Plus.usePrevious;

  return {
    admin0: base.admin0,
    admin1: admin1UsePrevious ? base.admin0 : base.admin1,
    admin2: admin2UsePrevious ? (admin1UsePrevious ? base.admin0 : base.admin1) : base.admin2,
    admin3Plus: admin3UsePrevious
      ? (admin2UsePrevious ? (admin1UsePrevious ? base.admin0 : base.admin1) : base.admin2)
      : base.admin3Plus,
  };
};

export const SimplifyToleranceByAdminLevelCard: React.FC<Props> = ({
  transformConfig,
  disabled,
  disableHoverLift = false,
  onChange,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminLevelTabKey>('admin0');
  const curveWidthRef = useRef<HTMLDivElement | null>(null);
  const [simplifyCurveWidth, setSimplifyCurveWidth] = useState(500);
  const hoverCardSx = getBuildConfigHoverCardSx(disabled, disableHoverLift);

  const storedProfiles = useMemo(
    () => resolveStoredProfiles(transformConfig),
    [transformConfig],
  );
  const editableProfiles = useMemo(() => ({
    admin0: resolveEditableProfile('admin0', transformConfig, storedProfiles),
    admin1: resolveEditableProfile('admin1', transformConfig, storedProfiles),
    admin2: resolveEditableProfile('admin2', transformConfig, storedProfiles),
    admin3Plus: resolveEditableProfile('admin3Plus', transformConfig, storedProfiles),
  }), [storedProfiles, transformConfig]);

  const effectiveProfiles = useMemo(
    () => resolveEffectiveProfiles(transformConfig, storedProfiles),
    [storedProfiles, transformConfig],
  );

  const activeEditable = editableProfiles[activeTab];
  const activeEffective = effectiveProfiles[activeTab];
  const previousTabKey = PREVIOUS_TAB_BY_KEY[activeTab];
  const hasReferenceToggle = activeTab !== 'admin0';
  const usePrevious = hasReferenceToggle ? activeEditable.usePrevious : false;
  const controlsDisabled = Boolean(disabled || usePrevious);
  const activeValues = usePrevious ? activeEffective : activeEditable;

  const xMarks = transformConfig.zoomBandBoundaries.map((value) => ({ value, label: String(value) }));
  const retryCountMarks = [0, 2, 4, 6, 8, 10].map((value) => ({ value, label: String(value) }));

  const resolvedMainAnchors = buildToneCurveAnchorsFromToleranceByBand(
    activeValues.toleranceByBand,
    transformConfig.zoomBandBoundaries,
    DEFAULT_MAIN_ANCHORS[0] ?? DEFAULT_TOLERANCE_FALLBACK,
    DEFAULT_MAIN_ANCHORS,
  );

  const resolvedRetryAnchors = buildToneCurveAnchorsFromToleranceByBand(
    activeValues.retryToleranceByBand,
    transformConfig.zoomBandBoundaries,
    DEFAULT_RETRY_ANCHORS[0] ?? DEFAULT_TOLERANCE_FALLBACK,
    DEFAULT_RETRY_ANCHORS,
  );

  const updateStoredProfile = useCallback((
    key: AdminLevelTabKey,
    partial: Partial<StoredAdminLevelProfile>,
  ) => {
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

    const patch: Partial<ShapeBuildConfig['transformConfig']> = {
      simplifyToleranceByAdminLevel: nextProfiles,
    };

    if (key === 'admin0') {
      const admin0 = nextProfiles.admin0 ?? {};
      if (Array.isArray(admin0.toleranceByBand)) {
        patch.toleranceByBand = admin0.toleranceByBand;
      }
      if (Array.isArray(admin0.retryToleranceByBand)) {
        patch.retryToleranceByBand = admin0.retryToleranceByBand;
      }
      if (typeof admin0.retryCount === 'number' && Number.isFinite(admin0.retryCount)) {
        patch.retryCount = clampRetryCount(admin0.retryCount);
      }
    }

    onChange(patch);
  }, [onChange, storedProfiles]);

  const handleMainAnchorYChange = useCallback((index: number, rawValue: number) => {
    if (controlsDisabled || !Number.isFinite(rawValue)) {
      return;
    }

    const nextAnchors = resolvedMainAnchors.map((anchor, anchorIndex) => (
      anchorIndex === index ? { ...anchor, y: clampToCurveYRange(rawValue) } : anchor
    ));

    const next = buildToleranceByBandFromToneCurveAnchors(
      nextAnchors,
      transformConfig.zoomBandBoundaries,
      DEFAULT_MAIN_ANCHORS[0] ?? DEFAULT_TOLERANCE_FALLBACK,
    ).map((value) => normalizeToleranceValue(value));

    if (next.length === activeEditable.toleranceByBand.length
      && next.every((value, toleranceIndex) => areToleranceValuesEqual(
        value,
        activeEditable.toleranceByBand[toleranceIndex] ?? value,
      ))
    ) {
      return;
    }

    updateStoredProfile(activeTab, { toleranceByBand: next });
  }, [
    activeEditable.toleranceByBand,
    activeTab,
    controlsDisabled,
    resolvedMainAnchors,
    transformConfig.zoomBandBoundaries,
    updateStoredProfile,
  ]);

  const handleRetryAnchorYChange = useCallback((index: number, rawValue: number) => {
    if (controlsDisabled || !Number.isFinite(rawValue)) {
      return;
    }

    const nextAnchors = resolvedRetryAnchors.map((anchor, anchorIndex) => (
      anchorIndex === index ? { ...anchor, y: clampToCurveYRange(rawValue) } : anchor
    ));

    const next = buildToleranceByBandFromToneCurveAnchors(
      nextAnchors,
      transformConfig.zoomBandBoundaries,
      DEFAULT_RETRY_ANCHORS[0] ?? DEFAULT_TOLERANCE_FALLBACK,
    ).map((value) => normalizeToleranceValue(value));

    if (next.length === activeEditable.retryToleranceByBand.length
      && next.every((value, toleranceIndex) => areToleranceValuesEqual(
        value,
        activeEditable.retryToleranceByBand[toleranceIndex] ?? value,
      ))
    ) {
      return;
    }

    updateStoredProfile(activeTab, { retryToleranceByBand: next });
  }, [
    activeEditable.retryToleranceByBand,
    activeTab,
    controlsDisabled,
    resolvedRetryAnchors,
    transformConfig.zoomBandBoundaries,
    updateStoredProfile,
  ]);

  const copyFromPreviousTab = useCallback(() => {
    if (!previousTabKey || controlsDisabled) {
      return;
    }
    const source = effectiveProfiles[previousTabKey];
    updateStoredProfile(activeTab, {
      usePrevious: false,
      toleranceByBand: source.toleranceByBand,
      retryToleranceByBand: source.retryToleranceByBand,
      retryCount: source.retryCount,
    });
  }, [activeTab, controlsDisabled, effectiveProfiles, previousTabKey, updateStoredProfile]);

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
          title={t('processing.transform.simplifySettings.title', 'Simplify settings')}
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
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
            <FormControlLabel
              control={(
                <Switch
                  checked={usePrevious}
                  onChange={(event) => {
                    updateStoredProfile(activeTab, { usePrevious: event.target.checked });
                  }}
                  disabled={disabled}
                />
              )}
              label={t('processing.transform.adminLevel.usePrevious', 'Use values from previous tab')}
            />
            <Button
              variant="outlined"
              onClick={copyFromPreviousTab}
              disabled={Boolean(disabled || usePrevious)}
            >
              {t('processing.transform.adminLevel.copyPrevious', 'Copy values from previous tab')}
            </Button>
          </Stack>
        ) : null}

        <Box sx={{ opacity: controlsDisabled ? 0.6 : 1 }}>
          <Grid container spacing={3} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  {t('processing.transform.simplifyTolerance.label', 'Simplify tolerance')}
                </Typography>
                <div
                  ref={curveWidthRef}
                  style={{ width: '100%' }}
                >
                  <ToneCurveEditor
                    width={simplifyCurveWidth}
                    height={180}
                    xRange={[
                      transformConfig.zoomBandBoundaries[0] ?? 1,
                      transformConfig.zoomBandBoundaries.at(-1) ?? 11,
                    ]}
                    yRange={CURVE_Y_RANGE}
                    lineStyles={toneCurveLineStyles}
                    xMarks={xMarks}
                    anchors={resolvedMainAnchors}
                    xFixedValues={resolvedMainAnchors.map((anchor) => anchor.x)}
                    allowAnchorCountChange={false}
                    horizontalZoom={false}
                    verticalZoom
                    xSnapStep={0.1}
                    ySnapStep={0.1}
                    overlaySeries={[
                      {
                        anchors: resolvedRetryAnchors,
                        xFixedValues: resolvedRetryAnchors.map((anchor) => anchor.x),
                        yFixedValues: [],
                        allowAnchorCountChange: false,
                        editable: !controlsDisabled,
                        onChange: (overlayAnchors) => {
                          if (controlsDisabled) return;
                          const next = buildToleranceByBandFromToneCurveAnchors(
                            overlayAnchors,
                            transformConfig.zoomBandBoundaries,
                            DEFAULT_RETRY_ANCHORS[0] ?? DEFAULT_TOLERANCE_FALLBACK,
                          ).map((value) => normalizeToleranceValue(value));

                          if (next.length === activeEditable.retryToleranceByBand.length
                            && next.every((value, index) => areToleranceValuesEqual(
                              value,
                              activeEditable.retryToleranceByBand[index] ?? value,
                            ))
                          ) {
                            return;
                          }
                          updateStoredProfile(activeTab, { retryToleranceByBand: next });
                        },
                      },
                    ]}
                    onChange={(anchors) => {
                      if (controlsDisabled) return;
                      const next = buildToleranceByBandFromToneCurveAnchors(
                        anchors,
                        transformConfig.zoomBandBoundaries,
                        DEFAULT_MAIN_ANCHORS[0] ?? DEFAULT_TOLERANCE_FALLBACK,
                      ).map((value) => normalizeToleranceValue(value));

                      if (next.length === activeEditable.toleranceByBand.length
                        && next.every((value, index) => areToleranceValuesEqual(
                          value,
                          activeEditable.toleranceByBand[index] ?? value,
                        ))
                      ) {
                        return;
                      }
                      updateStoredProfile(activeTab, { toleranceByBand: next });
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
                    {resolvedRetryAnchors.map((anchor, index) => (
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
                        disabled={controlsDisabled}
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
                    {resolvedMainAnchors.map((anchor, index) => (
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
                        disabled={controlsDisabled}
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
                    sx={{ flex: 1, minWidth: 220, mt: '16px' }}
                    value={activeValues.retryCount}
                    min={0}
                    max={10}
                    step={1}
                    marks={retryCountMarks}
                    disabled={controlsDisabled}
                    valueLabelDisplay="on"
                    onChange={(_event, value) => {
                      const next = clampRetryCount(resolveSliderNumber(value));
                      if (next === activeEditable.retryCount) {
                        return;
                      }
                      updateStoredProfile(activeTab, { retryCount: next });
                    }}
                  />
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Box>

        <Typography variant="caption" color="text.secondary">
          {t(
            'processing.transform.adminLevel.description',
            'Configure simplify tolerance by admin level. Admin 1+ can reference values from the previous tab.',
          )}
        </Typography>
      </Stack>
    </Paper>
  );
};
