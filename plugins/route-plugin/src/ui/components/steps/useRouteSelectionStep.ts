import type { NodeId } from '@hierarchidb/core-types';
import type { RouteEntity } from '@hierarchidb/route-api';
import {
  type IdeGsmRouteCoverageResult,
  ROUTE_MODES,
  type RouteMode,
} from '@hierarchidb/route-api';
import {
  type Country,
  type MatrixConfig,
  type MatrixSelection,
  useIsoCountries,
} from '@hierarchidb/ui-country-select';
import type { GridColumn } from '@hierarchidb/ui-grid';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildRouteSelectionColumnId,
  parseRouteSelectionColumnId,
  ROUTE_MODE_COLUMNS,
  ROUTE_SELECTION_COLUMNS,
  type RouteSelectionColumnId,
} from './routeSelectionConstants.js';

export interface RouteSelectionStepProps {
  draft: Partial<RouteEntity>;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
  mode: 'create' | 'edit';
  nodeId?: string;
  parentId?: string;
}

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
      return {
        allowedModes: [ROUTE_MODES.WATERWAY],
        defaultChecked: new Set([ROUTE_MODES.WATERWAY]),
      };
    case 'openstreetmap':
      return { allowedModes: [ROUTE_MODES.ROAD], defaultChecked: new Set([ROUTE_MODES.ROAD]) };
    case 'transitland':
      return {
        allowedModes: [ROUTE_MODES.H_RAILWAY, ROUTE_MODES.RAILWAY],
        defaultChecked: new Set([ROUTE_MODES.H_RAILWAY, ROUTE_MODES.RAILWAY]),
      };
    default:
      return { allowedModes: ROUTE_MODE_COLUMNS.map((col) => col.id), defaultChecked: null };
  }
};

const toSelectionArrayByColumn = (
  row: boolean[] | undefined
): Record<RouteSelectionColumnId, boolean> => {
  if (Array.isArray(row) && row.length !== ROUTE_SELECTION_COLUMNS.length) {
    throw new Error(
      `[useRouteSelectionStep] selectedArrayByCountries rows must contain exactly ${ROUTE_SELECTION_COLUMNS.length} boolean cells`
    );
  }
  row?.forEach((value, index) => {
    if (typeof value !== 'boolean') {
      throw new Error(
        `[useRouteSelectionStep] selectedArrayByCountries row cell ${index} must be boolean`
      );
    }
  });
  const normalized: Record<RouteSelectionColumnId, boolean> = {} as Record<
    RouteSelectionColumnId,
    boolean
  >;
  ROUTE_SELECTION_COLUMNS.forEach((column, index) => {
    normalized[column.id] = Boolean(row?.[index]);
  });
  return normalized;
};

const enforceOrAndRule = (
  rowByColumn: Record<RouteSelectionColumnId, boolean>
): Record<RouteSelectionColumnId, boolean> => {
  const next = { ...rowByColumn };
  ROUTE_MODE_COLUMNS.forEach((modeColumn) => {
    const orId = buildRouteSelectionColumnId('or', modeColumn.id);
    const andId = buildRouteSelectionColumnId('and', modeColumn.id);
    if (next[orId]) {
      next[andId] = true;
    }
  });
  return next;
};

const toSelectionArray = (rowByColumn: Record<RouteSelectionColumnId, boolean>): boolean[] =>
  ROUTE_SELECTION_COLUMNS.map((column) => Boolean(rowByColumn[column.id]));

function isStrictRouteMode(value: unknown): value is RouteMode {
  return ROUTE_MODE_COLUMNS.some((column) => column.id === value);
}

function assertCoverageModeList(
  modes: unknown,
  countryCode: string,
  coverageKey: 'coverageByCountryOr' | 'coverageByCountryAnd'
): asserts modes is RouteMode[] {
  if (!Array.isArray(modes)) {
    throw new Error(`[useRouteSelectionStep] ${coverageKey}.${countryCode} must be an array`);
  }
  modes.forEach((mode) => {
    if (!isStrictRouteMode(mode)) {
      throw new Error(
        `[useRouteSelectionStep] ${coverageKey}.${countryCode} contains unsupported route mode: ${String(mode)}`
      );
    }
  });
}

function assertStrictCoverageResult(
  value: IdeGsmRouteCoverageResult | null | undefined
): asserts value is IdeGsmRouteCoverageResult {
  if (!value) {
    throw new Error('[useRouteSelectionStep] IDE-GSM coverage result is required');
  }
  const raw = value as IdeGsmRouteCoverageResult & { coverageByCountry?: unknown };
  if ('coverageByCountry' in raw) {
    throw new Error('[useRouteSelectionStep] coverageByCountry alias is not supported');
  }
  if (
    !raw.coverageByCountryOr ||
    typeof raw.coverageByCountryOr !== 'object' ||
    Array.isArray(raw.coverageByCountryOr)
  ) {
    throw new Error('[useRouteSelectionStep] coverageByCountryOr must be an object');
  }
  if (
    !raw.coverageByCountryAnd ||
    typeof raw.coverageByCountryAnd !== 'object' ||
    Array.isArray(raw.coverageByCountryAnd)
  ) {
    throw new Error('[useRouteSelectionStep] coverageByCountryAnd must be an object');
  }
  const countries = new Set([
    ...Object.keys(raw.coverageByCountryOr),
    ...Object.keys(raw.coverageByCountryAnd),
  ]);
  if (countries.size === 0) {
    throw new Error('[useRouteSelectionStep] IDE-GSM coverage must contain at least one country');
  }
  Object.entries(raw.coverageByCountryOr).forEach(([countryCode, modes]) => {
    assertCoverageModeList(modes, countryCode, 'coverageByCountryOr');
  });
  Object.entries(raw.coverageByCountryAnd).forEach(([countryCode, modes]) => {
    assertCoverageModeList(modes, countryCode, 'coverageByCountryAnd');
  });
  const hasAnyCell = [...countries].some(
    (countryCode) =>
      (raw.coverageByCountryOr[countryCode]?.length ?? 0) > 0 ||
      (raw.coverageByCountryAnd[countryCode]?.length ?? 0) > 0
  );
  if (!hasAnyCell) {
    throw new Error(
      '[useRouteSelectionStep] IDE-GSM coverage must contain at least one selectable cell'
    );
  }
}

export const useRouteSelectionStep = ({
  draft: draftProp,
  onUpdate,
  onValidationChange,
  nodeId: _nodeId,
}: RouteSelectionStepProps) => {
  const { t } = useTranslation('route-plugin');
  const { api, initialize } = useWorkerAPI();
  const iso = useIsoCountries();
  const draft = draftProp;
  const dataSourceName = draft.dataSourceName ?? null;
  const ideGsmSourceId = draft.tabularSourceId ?? null;
  const isIdeGsm = dataSourceName === 'ide-gsm';
  const routeNodeId = _nodeId as NodeId | undefined;
  const policy = useMemo(() => resolveModePolicy(dataSourceName), [dataSourceName]);
  const allowedModeSet = useMemo(() => new Set(policy.allowedModes), [policy.allowedModes]);
  const lastDataSourceRef = useRef<string | null>(dataSourceName);
  const lastCoverageRef = useRef<string | null>(null);
  const lastCoverageRequestKeyRef = useRef<string | null>(null);
  const [coverage, setCoverage] = useState<IdeGsmRouteCoverageResult | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const coverageRequestKey = useMemo(() => {
    if (!isIdeGsm || !ideGsmSourceId || !routeNodeId) return null;
    return `${String(routeNodeId)}:${ideGsmSourceId}`;
  }, [ideGsmSourceId, isIdeGsm, routeNodeId]);

  const emitUpdate = useCallback(
    (updates: Partial<RouteEntity>) => {
      onUpdate({
        ...updates,
      });
    },
    [onUpdate]
  );

  const selectionByCountries = useMemo(
    () => draft.selectedArrayByCountries ?? {},
    [draft.selectedArrayByCountries]
  );

  useEffect(() => {
    if (!isIdeGsm) {
      lastCoverageRequestKeyRef.current = null;
      setCoverage(null);
      setCoverageError(null);
      setCoverageLoading(false);
      return;
    }
    if (!ideGsmSourceId) {
      lastCoverageRequestKeyRef.current = null;
      setCoverage(null);
      setCoverageError(t('routeConfig.ideGsmMissingSource', 'IDE-GSM source is required.'));
      setCoverageLoading(false);
      return;
    }
    if (!routeNodeId) {
      lastCoverageRequestKeyRef.current = null;
      setCoverage(null);
      setCoverageError(t('routeConfig.ideGsmMissingNode', 'Route node is not available.'));
      setCoverageLoading(false);
      return;
    }
    if (!coverageRequestKey) {
      return;
    }
    if (lastCoverageRequestKeyRef.current === coverageRequestKey) {
      return;
    }
    lastCoverageRequestKeyRef.current = coverageRequestKey;
    let cancelled = false;
    setCoverageLoading(true);
    setCoverageError(null);
    void (async () => {
      try {
        if (!api) {
          throw new Error(
            String(t('routeConfig.ideGsmMissingWorker', 'Worker API is unavailable.'))
          );
        }
        await initialize();
        const routeMutation = await api.getRouteMutationAPI();
        const result = await routeMutation.resolveIdeGsmRouteCoverage({
          nodeId: routeNodeId,
          tabularSourceId: ideGsmSourceId,
        });
        if (cancelled) return;
        assertStrictCoverageResult(result);
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
  }, [api, coverageRequestKey, ideGsmSourceId, initialize, isIdeGsm, routeNodeId, t]);

  const coverageOrModeMap = useMemo(() => {
    const map = new Map<string, Set<RouteMode>>();
    if (!coverage) return map;
    Object.entries(coverage.coverageByCountryOr).forEach(([country, modes]) => {
      map.set(country, new Set(modes));
    });
    return map;
  }, [coverage]);

  const coverageAndModeMap = useMemo(() => {
    const map = new Map<string, Set<RouteMode>>();
    if (!coverage) return map;
    Object.entries(coverage.coverageByCountryAnd ?? {}).forEach(([country, modes]) => {
      map.set(country, new Set(modes));
    });
    return map;
  }, [coverage]);

  const resolveAvailableColumnSetForCountry = useCallback(
    (countryCode: string) => {
      const available = new Set<RouteSelectionColumnId>();
      if (isIdeGsm) {
        const coverageOrModes = coverageOrModeMap.get(countryCode);
        const coverageAndModes = coverageAndModeMap.get(countryCode);
        ROUTE_MODE_COLUMNS.forEach((modeColumn) => {
          if (!allowedModeSet.has(modeColumn.id)) return;
          if (coverageOrModes?.has(modeColumn.id)) {
            available.add(buildRouteSelectionColumnId('or', modeColumn.id));
          }
          if (coverageAndModes?.has(modeColumn.id)) {
            available.add(buildRouteSelectionColumnId('and', modeColumn.id));
          }
        });
        return available;
      }
      ROUTE_MODE_COLUMNS.forEach((modeColumn) => {
        if (!allowedModeSet.has(modeColumn.id)) return;
        available.add(buildRouteSelectionColumnId('or', modeColumn.id));
        available.add(buildRouteSelectionColumnId('and', modeColumn.id));
      });
      return available;
    },
    [allowedModeSet, coverageAndModeMap, coverageOrModeMap, isIdeGsm]
  );

  const coverageKey = useMemo(() => {
    if (!isIdeGsm || !coverage) return null;
    return JSON.stringify({
      or: coverage.coverageByCountryOr,
      and: coverage.coverageByCountryAnd,
    });
  }, [coverage, isIdeGsm]);

  const selectableCountries: Country[] = useMemo(() => {
    if (iso.status !== 'ready') return [];
    if (!isIdeGsm) return iso.countries;
    if (!coverage) return [];
    const coverageCountryCodes = new Set([
      ...Object.keys(coverage.coverageByCountryOr),
      ...Object.keys(coverage.coverageByCountryAnd),
    ]);
    return iso.countries.filter((country) => coverageCountryCodes.has(country.code));
  }, [coverage, isIdeGsm, iso.countries, iso.status]);

  const matrixConfig: MatrixConfig = useMemo(
    () => ({
      columns: ROUTE_SELECTION_COLUMNS.map((column) => {
        const conditionLabel =
          column.condition === 'or'
            ? t('routeConfig.conditionOr', 'OR')
            : t('routeConfig.conditionAnd', 'AND');
        return {
          id: column.id,
          label: `${conditionLabel} ${t(column.labelKey, column.mode)}`,
          description: `${conditionLabel} ${t(column.labelKey, column.mode)}`,
          type: 'custom',
          width: 168,
          icon: column.icon,
        };
      }),
      virtualization: {
        rowHeight: 40,
        overscan: 8,
      },
    }),
    [t]
  );

  const selectionSignature = useCallback(
    (selection: Record<string, boolean[]>) => {
      if (iso.status !== 'ready') return '';
      return selectableCountries
        .map((country) => {
          const row = selection[country.code] ?? [];
          const bits = matrixConfig.columns.map((_, colIdx) => (row[colIdx] ? '1' : '0')).join('');
          return `${country.code}:${bits}`;
        })
        .join('|');
    },
    [iso.status, matrixConfig.columns, selectableCountries]
  );

  const selectionMatrixSource = useMemo(() => {
    if (iso.status !== 'ready') return [];
    return selectableCountries.map((country) => selectionByCountries[country.code]);
  }, [iso.status, selectableCountries, selectionByCountries]);

  const selectionRecordSource = useMemo(() => {
    if (iso.status !== 'ready') return {};
    return selectionByCountries;
  }, [iso, selectionByCountries]);

  const currentSelections: MatrixSelection[] = useMemo(() => {
    if (iso.status !== 'ready') return [];
    return selectableCountries.map((country, index) => {
      const row = toSelectionArrayByColumn(selectionMatrixSource[index]);
      const selections: Record<string, boolean> = {};
      matrixConfig.columns.forEach((col) => {
        selections[col.id] = Boolean(row[col.id as RouteSelectionColumnId]);
      });
      return { countryCode: country.code, selections };
    });
  }, [iso.status, selectableCountries, selectionMatrixSource, matrixConfig.columns]);

  const normalizeSelectionRecord = useCallback(
    (applyDefaults: boolean) => {
      if (iso.status !== 'ready') return {};
      const normalized: Record<string, boolean[]> = {};
      selectableCountries.forEach((country) => {
        const currentRow = toSelectionArrayByColumn(selectionByCountries[country.code]);
        const availableColumns = resolveAvailableColumnSetForCountry(country.code);
        const nextRowByColumn: Record<RouteSelectionColumnId, boolean> = {} as Record<
          RouteSelectionColumnId,
          boolean
        >;
        ROUTE_SELECTION_COLUMNS.forEach((column) => {
          const isAvailable = availableColumns.has(column.id);
          if (!isAvailable) {
            nextRowByColumn[column.id] = false;
            return;
          }
          nextRowByColumn[column.id] = applyDefaults ? true : Boolean(currentRow[column.id]);
        });
        normalized[country.code] = toSelectionArray(enforceOrAndRule(nextRowByColumn));
      });
      return normalized;
    },
    [iso.status, resolveAvailableColumnSetForCountry, selectableCountries, selectionByCountries]
  );

  const hasAnySelection = useMemo(() => {
    if (iso.status !== 'ready') return false;
    return selectableCountries.some((country) => {
      const row = selectionByCountries[country.code] ?? [];
      return row.some(Boolean);
    });
  }, [iso.status, selectableCountries, selectionByCountries]);

  useEffect(() => {
    if (iso.status !== 'ready') return;
    if (isIdeGsm && !coverage) return;
    const dataSourceChanged = lastDataSourceRef.current !== dataSourceName;
    if (dataSourceChanged) {
      lastDataSourceRef.current = dataSourceName;
    }
    const coverageChanged = lastCoverageRef.current !== coverageKey;
    if (coverageChanged) {
      lastCoverageRef.current = coverageKey;
    }
    const shouldApplyDefaults = Boolean(
      (isIdeGsm &&
        coverage &&
        (dataSourceChanged || !hasAnySelection || (coverageChanged && !hasAnySelection))) ||
        (!isIdeGsm && policy.defaultChecked && (dataSourceChanged || !hasAnySelection))
    );
    const normalized = normalizeSelectionRecord(shouldApplyDefaults);
    if (selectionSignature(selectionRecordSource) !== selectionSignature(normalized)) {
      emitUpdate({ selectedArrayByCountries: normalized });
    }
  }, [
    coverage,
    coverageKey,
    dataSourceName,
    emitUpdate,
    hasAnySelection,
    isIdeGsm,
    iso.status,
    normalizeSelectionRecord,
    policy.defaultChecked,
    selectionSignature,
    selectionRecordSource,
  ]);

  const applySelections = useCallback(
    (nextSelections: MatrixSelection[]) => {
      if (iso.status !== 'ready') return;
      const normalized: Record<string, boolean[]> = {};
      selectableCountries.forEach((country) => {
        const entry = nextSelections.find((sel) => sel.countryCode === country.code);
        const selections = entry?.selections ?? {};
        const availableColumns = resolveAvailableColumnSetForCountry(country.code);
        const nextRowByColumn: Record<RouteSelectionColumnId, boolean> = {} as Record<
          RouteSelectionColumnId,
          boolean
        >;
        ROUTE_SELECTION_COLUMNS.forEach((column) => {
          if (!availableColumns.has(column.id)) {
            nextRowByColumn[column.id] = false;
            return;
          }
          nextRowByColumn[column.id] = Boolean(selections[column.id]);
        });
        normalized[country.code] = toSelectionArray(enforceOrAndRule(nextRowByColumn));
      });
      if (selectionSignature(selectionRecordSource) !== selectionSignature(normalized)) {
        emitUpdate({ selectedArrayByCountries: normalized });
      }
    },
    [
      emitUpdate,
      iso.status,
      resolveAvailableColumnSetForCountry,
      selectableCountries,
      selectionRecordSource,
      selectionSignature,
    ]
  );

  const isCellEnabledForCountry = useCallback(
    (countryCode: string, columnId: string) => {
      const parsed = parseRouteSelectionColumnId(columnId);
      if (!parsed) return false;
      const availableColumns = resolveAvailableColumnSetForCountry(countryCode);
      if (!availableColumns.has(columnId as RouteSelectionColumnId)) return false;
      if (parsed.condition === 'and') {
        const row = toSelectionArrayByColumn(selectionByCountries[countryCode]);
        const orId = buildRouteSelectionColumnId('or', parsed.mode);
        if (row[orId]) return false;
      }
      return true;
    },
    [resolveAvailableColumnSetForCountry, selectionByCountries]
  );

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
      return t(
        'routeConfig.ideGsmValidationError',
        'Resolve IDE-GSM parsing errors before selecting routes.'
      );
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

  const errorColumns = useMemo<GridColumn<(typeof errorRows)[number]>[]>(
    () => [
      {
        id: 'sourceLabel',
        label: t('routeConfig.ideGsmErrors.columns.source', 'Source'),
        width: 200,
      },
      {
        id: 'rowNumber',
        label: t('routeConfig.ideGsmErrors.columns.row', 'Row'),
        width: 80,
        sortable: true,
      },
      { id: 'start', label: t('routeConfig.ideGsmErrors.columns.start', 'Start'), width: 160 },
      { id: 'end', label: t('routeConfig.ideGsmErrors.columns.end', 'End'), width: 160 },
      { id: 'reason', label: t('routeConfig.ideGsmErrors.columns.reason', 'Reason'), width: 360 },
    ],
    [t]
  );

  return {
    t,
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
    selectableCountries,
    currentSelections,
    applySelections,
    isCellEnabledForCountry,
    policy,
  };
};
