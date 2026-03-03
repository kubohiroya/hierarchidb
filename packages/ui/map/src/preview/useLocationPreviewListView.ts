import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GridColumn } from '@hierarchidb/ui-grid';
import { useFloatingWindow } from '@hierarchidb/ui-floating-window';

const WINDOW_PERSIST_KEY = 'hierarchidb:ui:floating-window:location:metadata';

const formatCellValue = (value: unknown) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

type RowFilterConfig = {
  mode: 'all' | 'viewport';
  onModeChange: (mode: 'all' | 'viewport') => void;
  searchOnly: boolean;
  onSearchOnlyChange: (value: boolean) => void;
  labels?: {
    title?: string;
    allRows?: string;
    viewportRows?: string;
    searchOnly?: string;
  };
};

type UseLocationPreviewListViewArgs = {
  title: string;
  rows?: Array<Record<string, unknown>>;
  columns?: string[];
  columnFormatters?: Record<string, (value: unknown, row: Record<string, unknown>) => React.ReactNode>;
  rowFilterConfig?: RowFilterConfig;
};

export const useLocationPreviewListView = ({
  title,
  rows,
  columns,
  columnFormatters,
  rowFilterConfig,
}: UseLocationPreviewListViewArgs) => {
  const { windowState, handlers } = useFloatingWindow({
    persistKey: WINDOW_PERSIST_KEY,
    initialPosition: { x: 80, y: 140 },
    initialSize: { width: 560, height: 420 },
  });
  const { show } = handlers;

  useEffect(() => {
    show();
  }, [show]);

  const [searchValue, setSearchValue] = useState('');
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [jsonDialogValue, setJsonDialogValue] = useState<unknown>(null);
  const [jsonDialogTitle, setJsonDialogTitle] = useState<string>('Metadata');

  const normalizedRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const searchOnly = rowFilterConfig?.searchOnly ?? true;

  const resolvedColumns = useMemo(() => {
    if (columns && columns.length > 0) return columns;
    const keys = new Set<string>();
    normalizedRows.forEach((row) => {
      Object.keys(row).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [columns, normalizedRows]);

  const filteredRows = useMemo(() => {
    if (!searchOnly) return normalizedRows;
    const query = searchValue.trim().toLowerCase();
    if (!query) return normalizedRows;
    return normalizedRows.filter((row) => (
      resolvedColumns.some((column) => {
        const value = row[column];
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      })
    ));
  }, [normalizedRows, resolvedColumns, searchOnly, searchValue]);

  const resolvedTitle = useMemo(() => {
    const total = normalizedRows.length;
    if (!total) return title;
    const totalLabel = total.toLocaleString();
    const query = searchValue.trim();
    if (query && searchOnly) {
      const filteredLabel = filteredRows.length.toLocaleString();
      return `${title} (${filteredLabel}/${totalLabel} rows)`;
    }
    return `${title} (${totalLabel} rows)`;
  }, [filteredRows.length, normalizedRows.length, searchOnly, searchValue, title]);

  const gridColumns = useMemo<GridColumn<(typeof normalizedRows)[number]>[]>(() => (
    resolvedColumns.map((column) => ({
      id: column,
      label: column,
      width: column === 'metadata' ? 240 : 140,
      sortable: true,
      format: (value, row) => columnFormatters?.[column]?.(value, row) ?? formatCellValue(value),
    }))
  ), [columnFormatters, resolvedColumns]);

  const handleCellClick = useCallback((params: { row: Record<string, unknown>; columnId: string }) => {
    if (params.columnId !== 'metadata') return;
    const value = params.row.metadata;
    setJsonDialogValue(value ?? null);
    const name = typeof params.row.name === 'string' && params.row.name.length > 0
      ? params.row.name
      : params.row.id != null
        ? String(params.row.id)
        : 'Metadata';
    setJsonDialogTitle(`Metadata: ${name}`);
    setJsonDialogOpen(true);
  }, []);

  const closeJsonDialog = useCallback(() => {
    setJsonDialogOpen(false);
  }, []);

  return {
    windowState,
    handlers,
    searchValue,
    setSearchValue,
    jsonDialogOpen,
    jsonDialogValue,
    jsonDialogTitle,
    closeJsonDialog,
    normalizedRows,
    filteredRows,
    resolvedTitle,
    gridColumns,
    handleCellClick,
    searchOnly,
  };
};
