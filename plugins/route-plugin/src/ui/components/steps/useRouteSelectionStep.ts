import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SvgIconComponent } from '@mui/icons-material';
import { DirectionsBoat, DirectionsCar, Flight, Train, Tram } from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/core-types';
import type { RouteEntity, RouteUpdaterPayload } from '@hierarchidb/route-api';
import { ROUTE_MODES, type IdeGsmRouteCoverageResult, type RouteMode } from '@hierarchidb/route-api';
import { useTranslation } from '../../../common/i18n/index.js';
import { getRouteUpdaterPayload } from '../../../common/utils/draft.js';
import { useIsoCountries, type MatrixConfig, type MatrixSelection } from '@hierarchidb/ui-country-select';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import { type GridColumn } from '@hierarchidb/ui-grid';
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

export const ROUTE_MODE_COLUMNS: SelectionColumn[] = [
  { id: ROUTE_MODES.AIRWAY, labelKey: 'transportModes.air', icon: Flight },
  { id: ROUTE_MODES.WATERWAY, labelKey: 'transportModes.sea', icon: DirectionsBoat },
  { id: ROUTE_MODES.H_RAILWAY, labelKey: 'transportModes.highSpeedRail', icon: Train },
  { id: ROUTE_MODES.RAILWAY, labelKey: 'transportModes.rail', icon: Tram },
  { id: ROUTE_MODES.ROAD, labelKey: 'transportModes.road', icon: DirectionsCar },
];

export const ROUTE_STYLE_OPTIONS = [
  { id: 'solid', labelKey: 'routeConfig.style.lineStyle.solid', fallback: 'Solid' },
  { id: 'dashed', labelKey: 'routeConfig.style.lineStyle.dashed', fallback: 'Dashed' },
  { id: 'dotted', labelKey: 'routeConfig.style.lineStyle.dotted', fallback: 'Dotted' },
] as const;

export const LINE_WIDTH_MIN = 1;
export const LINE_WIDTH_MAX = 8;

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

export const useRouteSelectionStep = ({
  draft: draftProp,
  onUpdate,
  onValidationChange,
  nodeId: _nodeId,
}: RouteSelectionStepProps) => {
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
  }, [
    coverage,
    coverageKey,
    dataSourceName,
    deepEqualSelectionRecord,
    emitUpdate,
    hasAnySelection,
    isIdeGsm,
    iso.status,
    normalizeSelectionRecord,
    policy.defaultChecked,
    selectionRecordSource,
  ]);

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

  return {
    t,
    translations,
    iso,
    draft,
    dataSourceName,
    isIdeGsm,
    coverage,
    coverageLoading,
    selectionErrorMessage,
    errorDialogOpen,
    setErrorDialogOpen,
    errorRows,
    errorColumns,
    matrixConfig,
    currentSelections,
    applySelections,
    resolveAllowedModesForCountry,
    policy,
    styleConfig,
    handleModeColorChange,
    handleLineWidthChange,
    handleLineStyleChange,
  };
};
