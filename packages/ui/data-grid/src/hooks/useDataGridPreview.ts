import { useEffect, useMemo, useState, useId } from 'react';
import { useCrossHighlightSync } from '../hooks/useCrossHighlightSync.js';
import { ensureDefaultStyles } from '../utils/ensureDefaultStyles.js';
import { getDBName } from '@hierarchidb/util';
import { type ColumnFilter, TabularDatabaseManager, TabularQueryService } from '@hierarchidb/tabular-store';
import type { Id } from '../CrossViewStyles.js';

export type DataGridPreviewOp = ColumnFilter['op'];

const isValidId = (value: unknown): value is Id => typeof value === 'string' || typeof value === 'number';

export interface UseDataGridPreviewOptions {
  pluginId?: string;
  tableId?: string | null;
  rows?: Array<Record<string, unknown>>;
  columns?: string[];
}

export const useDataGridPreview = ({
  pluginId = 'generic',
  tableId,
  rows: providedRows,
  columns: providedColumns,
}: UseDataGridPreviewOptions) => {
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [filters, setFilters] = useState<Array<{ column: string; op: DataGridPreviewOp; value: string }>>([]);
  const [visibleCols, setVisibleCols] = useState<string[] | null>(null);
  const [sortState, setSortState] = useState<{ column?: string; direction?: 'asc' | 'desc' }>({
    column: undefined,
    direction: 'asc',
  });
  const controlId = useId();

  type GridCol = {
    id: string;
    label: string;
    sortable?: boolean;
    filterable?: boolean;
    width?: number | string;
    align?: 'left' | 'center' | 'right';
    hidden?: boolean;
  };

  const detectedNumeric = useMemo(() => {
    const numericSet = new Set<string>();
    const sampleRows = rows.slice(0, 25) as Array<Record<string, unknown>>;
    const activeCols = visibleCols && visibleCols.length > 0 ? visibleCols : columns;
    activeCols.forEach((col) => {
      const values = sampleRows.map((r) => r?.[col]);
      const isNumeric = values.length > 0 && values.every((v) => typeof v === 'number');
      if (isNumeric) numericSet.add(col);
    });
    return numericSet;
  }, [columns, rows, visibleCols]);

  const gridColumns = useMemo(() => {
    const active = visibleCols && visibleCols.length > 0 ? visibleCols : columns;
    const cols: GridCol[] = active.map((c) => ({
      id: c,
      label: c,
      sortable: true,
      filterable: false,
      align: detectedNumeric.has(c) ? 'right' : 'left',
    }));
    return cols;
  }, [columns, detectedNumeric, visibleCols]);

  const datasetId = useMemo(() => `${pluginId}:${tableId || 'unknown'}` as const, [pluginId, tableId]);
  const { rowSets, dataGrid } = useCrossHighlightSync({ datasetId });

  useEffect(() => {
    if (!tableId || (Array.isArray(providedRows) && providedRows.length === 0)) {
      return;
    }
    try {
      ensureDefaultStyles(datasetId, { includeRow: true, includeMap: true });
    } catch (err) {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('[DataGridPreview] ensureDefaultStyles failed', err);
      }
    }
  }, [datasetId, tableId, providedRows]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Array.isArray(providedRows) && providedRows.length > 0) {
        setColumns(providedColumns && providedColumns.length ? providedColumns : Object.keys(providedRows[0] ?? {}));
        if (!visibleCols && providedColumns) setVisibleCols(providedColumns);
        setRows(providedRows);
        setLoading(false);
        setError(undefined);
        return;
      }
      if (!tableId) {
        setColumns([]);
        setRows([]);
        return;
      }
      setLoading(true);
      setError(undefined);
      try {
        const manager = new TabularDatabaseManager(getDBName(`${pluginId}-metadata`));
        const meta = await manager.get(tableId);
        type ColumnMeta = string | { name?: unknown; id?: unknown } | undefined | null;
        const rawColumns: ColumnMeta[] = Array.isArray(meta?.columns) ? meta.columns : [];
        const cols = rawColumns
          .map((col: ColumnMeta) => {
            if (typeof col === 'string') return col;
            if (col && typeof col === 'object') {
              if ('name' in col && typeof col.name === 'string') {
                return col.name;
              }
              if ('id' in col) {
                const identifier = col.id;
                if (typeof identifier === 'string' || typeof identifier === 'number') {
                  return String(identifier);
                }
              }
            }
            return undefined;
          })
          .filter((value: string | undefined): value is string => typeof value === 'string');
        if (!cancelled) {
          setColumns(cols);
          if (!visibleCols) setVisibleCols(cols);
        }
        const svc = new TabularQueryService(pluginId);
        const filterArgs: ColumnFilter[] = filters.map(({ column, op, value }) => ({ column, op, value }));
        const data = await svc.query(tableId, filterArgs, 1000);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) setError((err as { message: string })?.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [datasetId, filters, pluginId, tableId, visibleCols, providedRows, providedColumns]);

  const matchedRowSet = useMemo(() => {
    if (rowSets.matched.size > 0) {
      return rowSets.matched;
    }
    const derived = new Set<Id>();
    rows.forEach((row, index) => {
      const rowObj = row as Record<string, unknown> | undefined;
      const identifier = isValidId(rowObj?.id) ? rowObj!.id : (index as Id);
      derived.add(identifier);
    });
    return derived;
  }, [rowSets.matched, rows]);

  const addFilter = () => setFilters((fs) => [...fs, { column: '', op: 'contains', value: '' }]);
  const removeFilter = (i: number) => setFilters((fs) => fs.filter((_, idx) => idx !== i));
  const updateFilter = (i: number, patch: Partial<{ column: string; op: DataGridPreviewOp; value: string }>) =>
    setFilters((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const sortedRows = useMemo(() => {
    const { column, direction } = sortState;
    if (!column || !direction) return rows as Array<Record<string, unknown>>;
    const copy = [...(rows as Array<Record<string, unknown>>)];
    copy.sort((a, b) => {
      const av = a?.[column];
      const bv = b?.[column];
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return direction === 'asc' ? av - bv : bv - av;
      }
      return direction === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [rows, sortState]);

  const handleSort = (column: string, direction: 'asc' | 'desc') => {
    setSortState({ column, direction });
  };

  return {
    controlId,
    columns,
    rows,
    loading,
    error,
    filters,
    visibleCols,
    setVisibleCols,
    gridColumns,
    matchedRowSet,
    rowSets,
    dataGrid,
    datasetId,
    sortState,
    sortedRows,
    onSort: handleSort,
    addFilter,
    removeFilter,
    updateFilter,
  };
};
