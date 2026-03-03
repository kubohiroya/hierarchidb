import { useCallback, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { TabularFilterOperator } from '../types/index';

interface UseTabularPreviewGridArgs {
  rows: Array<Record<string, unknown>>;
  columns?: string[];
  height?: number;
  rowLimit?: number | null;
  initialVisibleRows?: number;
  minVisibleRows?: number;
  maxVisibleRows?: number;
  resizable?: boolean;
  onCreateFilter?: (rule: {
    column: string;
    operator: TabularFilterOperator;
    value: string | number | null;
  }) => void;
}

export const useTabularPreviewGrid = ({
  rows,
  columns,
  height,
  rowLimit,
  initialVisibleRows,
  minVisibleRows,
  maxVisibleRows,
  resizable,
  onCreateFilter,
}: UseTabularPreviewGridArgs) => {
  const rowHeight = 42;
  const resolvedRowLimit = rowLimit ?? rows.length;
  const effectiveRows = useMemo(
    () => (resolvedRowLimit && resolvedRowLimit > 0 ? rows.slice(0, resolvedRowLimit) : rows),
    [resolvedRowLimit, rows],
  );
  const defaultVisibleRows = initialVisibleRows ?? Math.min(effectiveRows.length || 0, 10);
  const minRows = minVisibleRows ?? 5;
  const maxRows = maxVisibleRows ?? 50;
  const [sort, setSort] = useState<{ column?: string; direction?: 'asc' | 'desc' }>({
    column: undefined,
    direction: 'asc',
  });
  const [searchText, setSearchText] = useState('');
  const [menuState, setMenuState] = useState<{
    open: boolean;
    anchorPosition: { top: number; left: number } | null;
    column?: string;
    value?: unknown;
  }>({ open: false, anchorPosition: null });

  const detectedColumns = useMemo(() => {
    if (columns && columns.length > 0) return columns;
    if (rows.length === 0) return [];
    return Object.keys(rows[0] ?? {});
  }, [columns, rows]);

  const numericCols = useMemo(() => {
    const set = new Set<string>();
    const sample = effectiveRows.slice(0, 50);
    detectedColumns.forEach((col) => {
      const allNumeric =
        sample.length > 0 && sample.every((r) => typeof r?.[col] === 'number' && Number.isFinite(r?.[col] as number));
      if (allNumeric) {
        set.add(col);
      }
    });
    return set;
  }, [detectedColumns, effectiveRows]);

  const gridColumns = useMemo(
    () =>
      detectedColumns.map((c) => ({
        id: c,
        label: c,
        sortable: true,
        align: numericCols.has(c) ? ('right' as const) : ('left' as const),
      })),
    [detectedColumns, numericCols],
  );

  const sortedRows = useMemo(() => {
    const filtered = searchText
      ? effectiveRows.filter((row) =>
        Object.values(row ?? {}).some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(searchText.toLowerCase()),
        ),
      )
      : effectiveRows;
    const { column, direction } = sort;
    if (!column || !direction) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a?.[column];
      const bv = b?.[column];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return direction === 'asc' ? av - bv : bv - av;
      }
      return direction === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [effectiveRows, searchText, sort]);

  const maxVisible = Math.max(minRows, Math.min(sortedRows.length || minRows, maxRows));
  const defaultHeight = height ?? 48 + rowHeight * Math.max(defaultVisibleRows, minRows);
  const [gridHeight, setGridHeight] = useState<number>(Math.min(defaultHeight, 48 + rowHeight * maxVisible));
  const resizingRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleResizeStart = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!resizable) return;
    e.preventDefault();
    resizingRef.current = { startY: e.clientY, startHeight: gridHeight };
    const handleMove = (ev: MouseEvent) => {
      const current = resizingRef.current;
      if (!current) return;
      const delta = ev.clientY - current.startY;
      const nextHeight = Math.max(
        48 + rowHeight * minRows,
        Math.min(48 + rowHeight * maxRows, current.startHeight + delta),
      );
      setGridHeight(nextHeight);
    };
    const handleUp = () => {
      resizingRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [gridHeight, maxRows, minRows, resizable]);

  const openFilterMenu = useCallback((event: { clientX: number; clientY: number }, columnId: string, value: unknown) => {
    setMenuState({
      open: true,
      anchorPosition: { top: event.clientY, left: event.clientX },
      column: columnId,
      value,
    });
  }, []);

  const closeFilterMenu = useCallback(() => {
    setMenuState({ open: false, anchorPosition: null });
  }, []);

  const createFilterFromMenu = useCallback((operator: TabularFilterOperator) => {
    if (onCreateFilter && menuState.column) {
      const normalizedValue =
        menuState.value == null
          ? null
          : typeof menuState.value === 'object'
            ? String(menuState.value)
            : (menuState.value as string | number | null);
      onCreateFilter({
        column: menuState.column,
        operator,
        value: normalizedValue,
      });
    }
    closeFilterMenu();
  }, [closeFilterMenu, menuState.column, menuState.value, onCreateFilter]);

  return {
    rowHeight,
    effectiveRows,
    sortedRows,
    gridColumns,
    gridHeight,
    sort,
    searchText,
    menuState,
    setSort,
    setSearchText,
    handleResizeStart,
    openFilterMenu,
    closeFilterMenu,
    createFilterFromMenu,
  };
};
