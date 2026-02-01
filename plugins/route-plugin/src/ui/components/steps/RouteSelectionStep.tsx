/**
 * RouteSelectionStep - Step 3 of route creation dialog.
 * Selects Route Selection per country, aligned with LocationSelectionStep UI.
 */

import type React from 'react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Select,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import { DirectionsBoat, DirectionsCar, ExpandMore, Flight, Train, Tram } from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/core-types';
import type { RouteEntity, RouteUpdaterPayload } from '@hierarchidb/route-api';
import { useTranslation } from '../../../common/i18n/index.js';
import { getRouteUpdaterPayload } from '../../../common/utils/draft.js';
import { CountryMatrixSelector, useIsoCountries, type MatrixConfig, type MatrixSelection } from '@hierarchidb/ui-country-select';
import { ROUTE_MODES, type IdeGsmRouteCoverageResult, type RouteMode } from '@hierarchidb/route-api';
import { AuthReadyGate } from '@hierarchidb/ui-auth';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import { GenericDataGrid, type GridColumn } from '@hierarchidb/ui-grid';
import {
  buildDefaultRouteStyleConfig,
  mergeRouteStyleConfig,
} from '../../../common/styles/routeStyle.js';

export interface RouteSelectionStepProps {
  draft: RouteUpdaterPayload;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
  mode: 'create' | 'edit';
  nodeId?: string;
  parentId?: string;
}

type SelectionColumn = {
  id: RouteMode;
  labelKey: string;
  icon: SvgIconComponent;
};

const ROUTE_MODE_COLUMNS: SelectionColumn[] = [
  { id: ROUTE_MODES.AIRWAY, labelKey: 'transportModes.air', icon: Flight },
  { id: ROUTE_MODES.WATERWAY, labelKey: 'transportModes.sea', icon: DirectionsBoat },
  { id: ROUTE_MODES.H_RAILWAY, labelKey: 'transportModes.highSpeedRail', icon: Train },
  { id: ROUTE_MODES.RAILWAY, labelKey: 'transportModes.rail', icon: Tram },
  { id: ROUTE_MODES.ROAD, labelKey: 'transportModes.road', icon: DirectionsCar },
];

const ROUTE_STYLE_OPTIONS = [
  { id: 'solid', labelKey: 'routeConfig.style.lineStyle.solid', fallback: 'Solid' },
  { id: 'dashed', labelKey: 'routeConfig.style.lineStyle.dashed', fallback: 'Dashed' },
  { id: 'dotted', labelKey: 'routeConfig.style.lineStyle.dotted', fallback: 'Dotted' },
] as const;

const LINE_WIDTH_MIN = 1;
const LINE_WIDTH_MAX = 8;

type ModePolicy = {
  allowedModes: RouteMode[];
  defaultChecked: Set<RouteMode> | null;
};

const resolveModePolicy = (source?: string | null): ModePolicy => {
  switch (source) {
    case 'openflights':
      return { allowedModes: [ROUTE_MODES.AIRWAY], defaultChecked: new Set([ROUTE_MODES.AIRWAY]) };
    case 'searoute':
    case 'searoute-js':
    case 'naturalearth-rivers':
      return { allowedModes: [ROUTE_MODES.WATERWAY], defaultChecked: new Set([ROUTE_MODES.WATERWAY]) };
    case 'openstreetmap':
      return { allowedModes: [ROUTE_MODES.ROAD], defaultChecked: new Set([ROUTE_MODES.ROAD]) };
    case 'transitland':
      return { allowedModes: [ROUTE_MODES.H_RAILWAY, ROUTE_MODES.RAILWAY], defaultChecked: new Set([ROUTE_MODES.H_RAILWAY, ROUTE_MODES.RAILWAY]) };
    case 'ide-gsm':
    case 'custom':
    default:
      return { allowedModes: ROUTE_MODE_COLUMNS.map((col) => col.id), defaultChecked: null };
  }
};

const RouteSelectionContent: React.FC<RouteSelectionStepProps> = ({
  draft: draftProp,
  onUpdate,
  onValidationChange,
  mode: _mode,
  nodeId: _nodeId,
  parentId: _parentId,
}) => {
  const { t, translations } = useTranslation();
  const { api, initialize } = useWorkerAPI();
  const iso = useIsoCountries();
  const draft = useMemo(() => getRouteUpdaterPayload(draftProp), [draftProp]);
  const dataSourceName = draft.dataSourceName ?? null;
  const ideGsmSourceId = draft.tabularSourceId ?? null;
  const isIdeGsm = dataSourceName === 'ide-gsm';
  const routeNodeId = (draftProp.treeNodeId ?? _nodeId) as NodeId | undefined;
  const styleDefaults = useMemo(() => buildDefaultRouteStyleConfig(), []);
  const styleConfig = useMemo(
    () => mergeRouteStyleConfig(draft.routeStyleConfig ?? styleDefaults),
    [draft.routeStyleConfig, styleDefaults],
  );
  const policy = useMemo(() => resolveModePolicy(dataSourceName), [dataSourceName]);
  const allowedModeSet = useMemo(() => new Set(policy.allowedModes), [policy.allowedModes]);
  const lastDataSourceRef = useRef<string | null>(dataSourceName);
  const lastCoverageRef = useRef<string | null>(null);
  const [coverage, setCoverage] = useState<IdeGsmRouteCoverageResult | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);

  const emitUpdate = useCallback(
    (updates: Partial<RouteEntity>) => {
      onUpdate({
        ...updates,
      });
    },
    [onUpdate],
  );

  const selectionByCountries = useMemo(() => draft.selectedArrayByCountries ?? {}, [draft.selectedArrayByCountries]);

  useEffect(() => {
    if (!isIdeGsm) {
      setCoverage(null);
      setCoverageError(null);
      setCoverageLoading(false);
      return;
    }
    if (!ideGsmSourceId) {
      setCoverage(null);
      setCoverageError(t('routeConfig.ideGsmMissingSource', 'IDE-GSM source is required.'));
      setCoverageLoading(false);
      return;
    }
    if (!routeNodeId) {
      setCoverage(null);
      setCoverageError(t('routeConfig.ideGsmMissingNode', 'Route node is not available.'));
      setCoverageLoading(false);
      return;
    }
    let cancelled = false;
    setCoverageLoading(true);
    setCoverageError(null);
    void (async () => {
      try {
        if (!api) {
          throw new Error(t('routeConfig.ideGsmMissingWorker', 'Worker API is unavailable.'));
        }
        await initialize();
        const routeMutation = await api.getRouteMutationAPI();
        const result = await routeMutation.resolveIdeGsmRouteCoverage({
          nodeId: routeNodeId,
          tabularSourceId: ideGsmSourceId,
        });
        if (cancelled) return;
        if (!result || Object.keys(result.coverageByCountry ?? {}).length === 0) {
          throw new Error(t('routeConfig.ideGsmEmptyCoverage', 'No routes found in IDE-GSM data.'));
        }
        setCoverage(result);
        if (result.errors.length > 0) {
          setErrorDialogOpen(true);
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setCoverage(null);
        setCoverageError(message);
      } finally {
        if (!cancelled) setCoverageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, ideGsmSourceId, initialize, isIdeGsm, routeNodeId, t]);

  const coverageModeMap = useMemo(() => {
    const map = new Map<string, Set<RouteMode>>();
    if (!coverage) return map;
    Object.entries(coverage.coverageByCountry ?? {}).forEach(([country, modes]) => {
      map.set(country, new Set(modes));
    });
    return map;
  }, [coverage]);

  const resolveAllowedModesForCountry = useCallback((countryCode: string) => {
    const allowed = new Set<RouteMode>();
    if (isIdeGsm) {
      const coverageModes = coverageModeMap.get(countryCode);
      if (!coverageModes) return allowed;
      coverageModes.forEach((mode) => {
        if (allowedModeSet.has(mode)) {
          allowed.add(mode);
        }
      });
      return allowed;
    }
    policy.allowedModes.map((mode) => allowed.add(mode));
    return allowed;
  }, [allowedModeSet, coverageModeMap, isIdeGsm, policy.allowedModes]);

  const coverageKey = useMemo(() => {
    if (!isIdeGsm || !coverage) return null;
    return JSON.stringify(coverage.coverageByCountry ?? {});
  }, [coverage, isIdeGsm]);

  const matrixConfig: MatrixConfig = useMemo(() => ({
    columns: ROUTE_MODE_COLUMNS.map((mode) => ({
      id: mode.id,
      label: t(mode.labelKey, mode.id),
      description: t(mode.labelKey, mode.id),
      type: 'custom',
      width: 150,
      icon: mode.icon,
    })),
    virtualization: {
      rowHeight: 40,
      overscan: 8,
    },
  }), [t]);

  const deepEqualSelectionRecord = useCallback((
    current: Record<string, boolean[]>,
    next: Record<string, boolean[]>,
  ): boolean => {
    if (iso.status !== 'ready') return true;
    for (const country of iso.countries) {
      const rowA = current[country.code] ?? [];
      const rowB = next[country.code] ?? [];
      if (rowA.length !== rowB.length) return false;
      for (let j = 0; j < rowA.length; j += 1) {
        if (rowA[j] !== rowB[j]) return false;
      }
    }
    return true;
  }, [iso.countries, iso.status]);

  const selectionMatrixSource = useMemo(() => {
    if (iso.status !== 'ready') return [];
    return iso.countries.map((country) => selectionByCountries[country.code] ?? []);
  }, [iso, selectionByCountries]);

  const selectionRecordSource = useMemo(() => {
    if (iso.status !== 'ready') return {};
    return selectionByCountries;
  }, [iso, selectionByCountries]);

  const currentSelections: MatrixSelection[] = useMemo(() => {
    if (iso.status !== 'ready') return [];
    return iso.countries.map((country, index) => {
      const row = selectionMatrixSource[index] ?? [];
      const selections: Record<string, boolean> = {};
      matrixConfig.columns.forEach((col, colIdx) => {
        selections[col.id] = Boolean(row[colIdx]);
      });
      return { countryCode: country.code, selections };
    });
  }, [iso, selectionMatrixSource, matrixConfig.columns]);

  const normalizeSelectionRecord = useCallback((applyDefaults: boolean) => {
    if (iso.status !== 'ready') return {};
    const normalized: Record<string, boolean[]> = {};
    iso.countries.forEach((country) => {
      const row = selectionByCountries[country.code] ?? [];
      const allowedByCountry = resolveAllowedModesForCountry(country.code);
      normalized[country.code] = matrixConfig.columns.map((col, colIdx) => {
        if (!allowedByCountry.has(col.id as RouteMode)) return false;
        if (applyDefaults) return true;
        return Boolean(row[colIdx]);
      });
    });
    return normalized;
  }, [iso.countries, iso.status, matrixConfig.columns, resolveAllowedModesForCountry, selectionByCountries]);

  const hasAnySelection = useMemo(() => {
    if (iso.status !== 'ready') return false;
    return iso.countries.some((country) => {
      const row = selectionByCountries[country.code] ?? [];
      return row.some(Boolean);
    });
  }, [iso.countries, iso.status, selectionByCountries]);

  useEffect(() => {
    if (iso.status !== 'ready') return;
    const dataSourceChanged = lastDataSourceRef.current !== dataSourceName;
    if (dataSourceChanged) {
      lastDataSourceRef.current = dataSourceName;
    }
    const coverageChanged = lastCoverageRef.current !== coverageKey;
    if (coverageChanged) {
      lastCoverageRef.current = coverageKey;
    }
    const shouldApplyDefaults = Boolean(
      (isIdeGsm && coverage && (dataSourceChanged || !hasAnySelection || (coverageChanged && !hasAnySelection))) ||
      (!isIdeGsm && policy.defaultChecked && (dataSourceChanged || !hasAnySelection))
    );
    const normalized = normalizeSelectionRecord(shouldApplyDefaults);
    if (!deepEqualSelectionRecord(selectionRecordSource, normalized)) {
      emitUpdate({ selectedArrayByCountries: normalized });
    }
  }, [coverage, coverageKey, dataSourceName, deepEqualSelectionRecord, emitUpdate, hasAnySelection, isIdeGsm, iso.status, normalizeSelectionRecord, policy.defaultChecked, selectionRecordSource]);

  const applySelections = useCallback(
    (nextSelections: MatrixSelection[]) => {
      if (iso.status !== 'ready') return;
      const normalized: Record<string, boolean[]> = {};
      iso.countries.forEach((country) => {
        const entry = nextSelections.find((sel) => sel.countryCode === country.code);
        const selections = entry?.selections ?? {};
        const allowedByCountry = resolveAllowedModesForCountry(country.code);
        normalized[country.code] = matrixConfig.columns.map((col) => {
          return allowedByCountry.has(col.id as RouteMode) ? Boolean(selections[col.id]) : false;
        });
      });
      if (!deepEqualSelectionRecord(selectionRecordSource, normalized)) {
        emitUpdate({ selectedArrayByCountries: normalized });
      }
    },
    [deepEqualSelectionRecord, emitUpdate, iso.countries, iso.status, matrixConfig.columns, resolveAllowedModesForCountry, selectionRecordSource],
  );

  const updateStyleConfig = useCallback((next: typeof styleConfig) => {
    emitUpdate({ routeStyleConfig: next });
  }, [emitUpdate]);

  const handleModeColorChange = useCallback((mode: RouteMode, value: string) => {
    updateStyleConfig({
      ...styleConfig,
      modeColors: {
        ...styleConfig.modeColors,
        [mode]: value,
      },
    });
  }, [styleConfig, updateStyleConfig]);

  const handleLineWidthChange = useCallback((value: number | number[]) => {
    const raw = Array.isArray(value) ? value[0] ?? styleConfig.lineWidth : value;
    const nextWidth = Math.min(LINE_WIDTH_MAX, Math.max(LINE_WIDTH_MIN, Number(raw)));
    updateStyleConfig({
      ...styleConfig,
      lineWidth: nextWidth,
    });
  }, [styleConfig, updateStyleConfig]);

  const handleLineStyleChange = useCallback((value: string) => {
    const nextStyle = ROUTE_STYLE_OPTIONS.find((option) => option.id === value)?.id ?? 'solid';
    updateStyleConfig({
      ...styleConfig,
      lineStyle: nextStyle,
    });
  }, [styleConfig, updateStyleConfig]);

  useEffect(() => {
  const isValid =
    hasAnySelection &&
    (!isIdeGsm ||
      (!coverageError &&
        !coverageLoading &&
        Boolean(coverage) &&
        (coverage?.errors?.length ?? 0) === 0));
  onValidationChange(isValid);
  }, [coverage, coverageError, coverageLoading, hasAnySelection, isIdeGsm, onValidationChange]);

  const selectionErrorMessage = useMemo(() => {
    if (!isIdeGsm) return null;
    if (!ideGsmSourceId) {
      return t('routeConfig.ideGsmMissingSource', 'IDE-GSM source is required.');
    }
    if (coverageError) return coverageError;
    if (coverage && coverage.errors.length > 0) {
      return t('routeConfig.ideGsmValidationError', 'Resolve IDE-GSM parsing errors before selecting routes.');
    }
    return null;
  }, [coverage, coverageError, ideGsmSourceId, isIdeGsm, t]);

  const errorRows = useMemo(() => {
    if (!coverage?.errors?.length) return [];
    const label = draft.ideGsmFileName ?? '';
    return coverage.errors.map((error) => ({
      ...error,
      sourceLabel: label,
    }));
  }, [coverage?.errors, draft.ideGsmFileName]);

  const errorColumns = useMemo<GridColumn<(typeof errorRows)[number]>[]>(() => ([
    { id: 'sourceLabel', label: t('routeConfig.ideGsmErrors.columns.source', 'Source'), width: 200 },
    { id: 'rowNumber', label: t('routeConfig.ideGsmErrors.columns.row', 'Row'), width: 80, sortable: true },
    { id: 'start', label: t('routeConfig.ideGsmErrors.columns.start', 'Start'), width: 160 },
    { id: 'end', label: t('routeConfig.ideGsmErrors.columns.end', 'End'), width: 160 },
    { id: 'reason', label: t('routeConfig.ideGsmErrors.columns.reason', 'Reason'), width: 360 },
  ]), [t]);

  if (iso.status === 'loading') {
    return (
      <Box>
        <Alert severity="info">{t('routeConfig.loadingCountries', 'Loading countries...')}</Alert>
      </Box>
    );
  }

  if (iso.status === 'error') {
    const message = 'message' in iso ? iso.message : '';
    return (
      <Box>
        <Alert severity="error">
          {t('routeConfig.loadError', 'Failed to load country list')}: {message}
        </Alert>
      </Box>
    );
  }

  if (iso.status !== 'ready' || iso.countries.length === 0) {
    return (
      <Box>
        <Alert severity="warning">
          {t('routeConfig.emptyCountries', 'No countries available. Please try again later.')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <CountryMatrixSelector
        countries={iso.countries}
        matrixConfig={matrixConfig}
        selections={currentSelections}
        onSelectionsChange={applySelections}
        showRowSelection
        showAlphabetIndex
        showRegionIndex
        rowHeight={40}
        isCellEnabled={(country, columnId) => resolveAllowedModesForCountry(country.code).has(columnId as RouteMode)}
        loading={isIdeGsm && coverageLoading}
        errorMessage={selectionErrorMessage}
        height="100%"
        maxHeight={undefined}
      />
      {isIdeGsm && coverage?.errors?.length ? (
        <Box sx={{ mt: 1 }}>
          <Alert
            severity="error"
            action={(
              <Button color="inherit" size="small" onClick={() => setErrorDialogOpen(true)}>
                {t('routeConfig.ideGsmErrors.open', 'Details')}
              </Button>
            )}
          >
            {t('routeConfig.ideGsmErrors.summary', 'IDE-GSM parsing errors detected. Review the error list.')}
          </Alert>
        </Box>
      ) : null}
      <Dialog
        open={errorDialogOpen}
        onClose={() => setErrorDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('routeConfig.ideGsmErrors.title', 'IDE-GSM errors')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {draft.ideGsmFileName ? (
            <Typography variant="body2" color="text.secondary">
              {t('routeConfig.ideGsmErrors.sourceLabel', 'Source')}: {draft.ideGsmFileName}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary">
            {t('routeConfig.ideGsmErrors.description', 'Some routes could not be resolved. Check the rows below.')}
          </Typography>
          <Box sx={{ height: 360 }}>
            <GenericDataGrid
              columns={errorColumns}
              rows={errorRows}
              getRowId={(row) => row.id}
              enableVirtualization
              rowHeight={38}
              maxHeight={360}
              stickyHeader
              dense
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setErrorDialogOpen(false)} variant="contained">
            {t('common.close', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>
      {policy.defaultChecked && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          {t('routeConfig.defaultSelectionNote', 'Default selections are applied based on the data source.')}
        </Typography>
      )}
      {translations && dataSourceName && !policy.defaultChecked && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          {t('routeConfig.customSelectionNote', 'Choose the Route Selection to fetch for each country.')}
        </Typography>
      )}
      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box>
            <Typography variant="subtitle1">
              {t('routeConfig.style.title', 'Route style')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('routeConfig.style.description', 'Configure colors and line styles per transport mode.')}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2">
              {t('routeConfig.style.modeColorsTitle', 'Mode colors')}
            </Typography>
            <Grid container spacing={2}>
              {ROUTE_MODE_COLUMNS.map((mode) => (
                <Grid key={mode.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <mode.icon fontSize="small" />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {t(mode.labelKey, mode.id)}
                    </Typography>
                    <TextField
                      type="color"
                      size="small"
                      value={styleConfig.modeColors[mode.id]}
                      onChange={(event) => handleModeColorChange(mode.id, event.target.value)}
                      inputProps={{ 'aria-label': t('routeConfig.style.modeColorLabel', 'Color') }}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
            <Divider />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('routeConfig.style.lineWidthLabel', 'Line width')}
                </Typography>
                <Slider
                  min={LINE_WIDTH_MIN}
                  max={LINE_WIDTH_MAX}
                  value={styleConfig.lineWidth}
                  onChange={(_, next) => handleLineWidthChange(next)}
                  valueLabelDisplay="auto"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('routeConfig.style.lineStyleLabel', 'Line style')}
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={styleConfig.lineStyle}
                  onChange={(event) => handleLineStyleChange(String(event.target.value))}
                >
                  {ROUTE_STYLE_OPTIONS.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {t(option.labelKey, option.fallback)}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export const RouteSelectionStep: React.FC<RouteSelectionStepProps> = (props) => {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <Box sx={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>
            {t('auth.loading', 'Checking authentication...')}
          </Typography>
        </Box>
      }
    >
      <AuthReadyGate>
        <RouteSelectionContent {...props} />
      </AuthReadyGate>
    </Suspense>
  );
};
