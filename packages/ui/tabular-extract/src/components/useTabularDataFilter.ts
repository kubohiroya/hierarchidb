import type {
  TabularColumnInfo,
  TabularColumnType,
  TabularTableMetadata,
} from '@hierarchidb/tabular-store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTabularFilter } from '../hooks/useTabularFilter';
import type { TabularDataResult, TabularFilterOperator, TabularFilterRule } from '../types/index';
import type { FilterOperatorOption } from './TabularDataFilterRulesTable.js';

const MAX_PREVIEW_ROWS = 500;

export const FILTER_OPERATORS: FilterOperatorOption[] = [
  { value: 'equals', label: 'Equals', types: ['string', 'number', 'date', 'boolean'] },
  { value: 'not_equals', label: 'Not Equals', types: ['string', 'number', 'date', 'boolean'] },
  { value: 'contains', label: 'Contains', types: ['string'] },
  { value: 'not_contains', label: 'Does Not Contain', types: ['string'] },
  { value: 'starts_with', label: 'Starts With', types: ['string'] },
  { value: 'ends_with', label: 'Ends With', types: ['string'] },
  { value: 'greater_than', label: 'Greater Than', types: ['number', 'date'] },
  { value: 'less_than', label: 'Less Than', types: ['number', 'date'] },
  { value: 'greater_equal', label: 'Greater Than or Equal', types: ['number', 'date'] },
  { value: 'less_equal', label: 'Less Than or Equal', types: ['number', 'date'] },
  { value: 'is_null', label: 'Is Empty', types: ['string', 'number', 'date', 'boolean'] },
  { value: 'is_not_null', label: 'Is Not Empty', types: ['string', 'number', 'date', 'boolean'] },
  { value: 'regex', label: 'Regular Expression', types: ['string'] },
];

const operatorRequiresValue = (operator: TabularFilterOperator): boolean =>
  operator !== 'is_null' && operator !== 'is_not_null';

const normalizeInitialFilter = (rule: TabularFilterRule): TabularFilterRule => {
  if (typeof rule.enabled === 'boolean') {
    return rule;
  }
  const hasValue = rule.value !== '' && rule.value !== null && rule.value !== undefined;
  const enabled = operatorRequiresValue(rule.operator) ? hasValue : true;
  return { ...rule, enabled };
};

interface UseTabularDataFilterArgs {
  tableMetadata: TabularTableMetadata;
  pluginId: string;
  initialFilters: TabularFilterRule[];
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewData?: (data: TabularDataResult) => void;
  onPreviewRows?: (rows: TabularDataResult['rows']) => void;
  onSyncFilters?: (filters: TabularFilterRule[]) => void;
}

export const useTabularDataFilter = ({
  tableMetadata,
  pluginId,
  initialFilters,
  onFiltersChanged,
  onPreviewData,
  onPreviewRows,
  onSyncFilters,
}: UseTabularDataFilterArgs) => {
  const normalizedInitialFilters = useMemo(
    () => initialFilters.map(normalizeInitialFilter),
    [initialFilters]
  );
  const [filters, setFilters] = useState<TabularFilterRule[]>(normalizedInitialFilters);
  const [previewDirty, setPreviewDirty] = useState(false);
  const filtersRef = useRef(filters);

  const { previewData, error, getFilteredPreview, validateFilters, isLoading, setRules } =
    useTabularFilter({
      tableId: tableMetadata.id,
      pluginId,
      maxPreviewRows: MAX_PREVIEW_ROWS,
      initialRules: normalizedInitialFilters,
    });

  useEffect(() => {
    if (normalizedInitialFilters.length === 0) return;
    if (previewData) return;
    setPreviewDirty(true);
  }, [normalizedInitialFilters.length, previewData]);

  const previewBusy = previewDirty || isLoading;
  const hasMetadataColumns = Boolean(tableMetadata.columns && tableMetadata.columns.length > 0);
  const hasPreviewColumns = Boolean(previewData?.columns && previewData.columns.length > 0);

  const columnOptionsRef = useRef<TabularColumnInfo[]>([]);
  const columnOptions: TabularColumnInfo[] = useMemo(() => {
    const nextColumns = hasMetadataColumns
      ? (tableMetadata.columns ?? [])
      : (previewData?.columns ?? []);
    const prevColumns = columnOptionsRef.current;
    const sameLength = prevColumns.length === nextColumns.length;
    const shallowEqual =
      sameLength &&
      prevColumns.every((col, idx) => {
        const other = nextColumns[idx];
        return (
          col?.name === other?.name && col?.type === other?.type && col?.index === other?.index
        );
      });
    if (shallowEqual) {
      return prevColumns;
    }
    columnOptionsRef.current = nextColumns;
    return nextColumns;
  }, [hasMetadataColumns, previewData?.columns, tableMetadata.columns]);
  const previewColumns: TabularColumnInfo[] =
    hasPreviewColumns && previewData?.columns ? previewData.columns : columnOptions;

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    if (!onFiltersChanged) return;
    const timer = window.setTimeout(() => onFiltersChanged(filters), 120);
    return () => window.clearTimeout(timer);
  }, [filters, onFiltersChanged]);

  const lastPreviewSignatureRef = useRef<string>('');
  useEffect(() => {
    if (!previewData) return;
    onPreviewRows?.(previewData.rows);
    if (!onPreviewData) return;
    const { rows, ...rest } = previewData;
    const rowCount =
      Array.isArray(rows) && typeof rows.length === 'number'
        ? rows.length
        : ((rest as { totalRows?: number }).totalRows ?? 0);
    const payload: TabularDataResult = {
      ...(rest as Omit<TabularDataResult, 'rows'>),
      rows: [],
      totalRows: (rest as { totalRows?: number }).totalRows ?? rowCount,
    };
    const signature = JSON.stringify({
      columns: payload.columns,
      totalRows: payload.totalRows,
      rowCount,
      hash: (rest as { hash?: string }).hash ?? null,
    });
    if (signature === lastPreviewSignatureRef.current) return;
    lastPreviewSignatureRef.current = signature;
    onPreviewData(payload);
  }, [previewData, onPreviewData, onPreviewRows]);

  useEffect(() => {
    if (columnOptions.length === 0) return;
    setFilters((prev) => {
      const nextRules = prev.map((rule) => {
        const columnExists = columnOptions.some((col) => col.name === rule.column);
        const columnName = columnExists ? rule.column : (columnOptions[0]?.name ?? rule.column);
        const normalizeType = (type?: TabularColumnType): TabularColumnType => type ?? 'string';
        const columnType = normalizeType(
          columnOptions.find((col) => col.name === columnName)?.type
        );
        const availableOps = FILTER_OPERATORS.filter((op) => op.types.includes(columnType));
        const operator = availableOps.some((op) => op.value === rule.operator)
          ? rule.operator
          : (availableOps[0]?.value ?? rule.operator);
        return {
          ...rule,
          column: columnName,
          operator,
        } as TabularFilterRule;
      });
      const changed =
        nextRules.length !== prev.length ||
        nextRules.some((rule, idx) => {
          const current = prev[idx];
          return !current || current.column !== rule.column || current.operator !== rule.operator;
        });
      return changed ? nextRules : prev;
    });
  }, [columnOptions]);

  const enabledFilters = useMemo(() => filters.filter((f) => f.enabled !== false), [filters]);
  const effectiveFilters = enabledFilters.length > 0 ? enabledFilters : filters;
  const hasAnyFilters = filters.length > 0;

  const filtersEqual = useCallback((a: TabularFilterRule[], b: TabularFilterRule[]): boolean => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      const left = a[i];
      const right = b[i];
      if (
        !left ||
        !right ||
        left.id !== right.id ||
        left.column !== right.column ||
        left.operator !== right.operator ||
        left.value !== right.value ||
        left.enabled !== right.enabled
      ) {
        return false;
      }
    }
    return true;
  }, []);

  useEffect(() => {
    if (!onSyncFilters) return;
    if (filtersEqual(initialFilters, normalizedInitialFilters)) return;
    onSyncFilters(normalizedInitialFilters);
  }, [filtersEqual, initialFilters, normalizedInitialFilters, onSyncFilters]);

  const handleFiltersChange = useCallback(
    (next: TabularFilterRule[]) => {
      setFilters((prev) => {
        if (filtersEqual(prev, next)) {
          return prev;
        }
        return next;
      });
      setPreviewDirty((prev) => (prev ? prev : true));
    },
    [filtersEqual]
  );

  const syncFilters = useCallback(() => {
    onSyncFilters?.(filters);
  }, [filters, onSyncFilters]);

  const handleCreateFilterFromCell = useCallback(
    ({
      column,
      operator,
      value,
    }: {
      column: string;
      operator: TabularFilterOperator;
      value: string | number | null;
    }) => {
      if (!column) return;
      const id = `cell-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
      setFilters((prev) => [
        ...prev,
        {
          id,
          column,
          operator,
          value: value ?? '',
          enabled: true,
        },
      ]);
      setPreviewDirty(true);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (onSyncFilters) {
        onSyncFilters(filtersRef.current);
      }
    };
  }, [onSyncFilters]);

  const handlePreview = useCallback(() => {
    syncFilters();
    if (!hasAnyFilters) {
      setPreviewDirty(false);
      return;
    }
    const validation = validateFilters(effectiveFilters);
    if (!validation.isValid) {
      setPreviewDirty(false);
      return;
    }
    getFilteredPreview(effectiveFilters);
    setPreviewDirty(false);
  }, [effectiveFilters, getFilteredPreview, hasAnyFilters, syncFilters, validateFilters]);

  const handlePreviewRef = useRef(handlePreview);
  useEffect(() => {
    handlePreviewRef.current = handlePreview;
  }, [handlePreview]);

  useEffect(() => {
    if (!previewDirty) return;
    const timer = window.setTimeout(() => {
      handlePreviewRef.current();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [previewDirty]);

  useEffect(() => {
    const current = filtersRef.current;
    if (filtersEqual(current, normalizedInitialFilters)) {
      return;
    }
    setFilters(normalizedInitialFilters);
    setRules(normalizedInitialFilters);
    setPreviewDirty(true);
  }, [filtersEqual, normalizedInitialFilters, setRules]);

  const rowHeight = 36;
  const previewVisible = Math.max(10, Math.min(previewData?.rows?.length ?? 0, 20));
  const previewHeightRows = Math.max(1, previewVisible - 4);
  const previewHeight = Math.min(480, 48 + rowHeight * previewHeightRows);

  return {
    filters,
    previewData,
    error,
    previewBusy,
    columnOptions,
    previewColumns,
    rowHeight,
    previewHeight,
    handleFiltersChange,
    handleCreateFilterFromCell,
    setPreviewDirty,
  };
};
