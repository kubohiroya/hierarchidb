import { useEffect, useMemo, useRef } from 'react';
import type { GridGroupingState } from '@hierarchidb/ui-grid';
import { useFloatingWindow } from '@hierarchidb/ui-floating-window';
import type {
  MapPreviewStatusLabels,
} from './MapPreviewFloatingTable.js';
import type { ShapePreviewListProps } from './ShapePreviewList.js';
import { formatAdminLevelLabel } from './layerSetDefinitions.js';

const WINDOW_PERSIST_KEY = 'hierarchidb:ui:floating-window:shape:features';

const formatBBox = (bbox?: [number, number, number, number]) => {
  if (!bbox || bbox.length !== 4) return '';
  const [minX, minY, maxX, maxY] = bbox;
  if ([minX, minY, maxX, maxY].some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    return '';
  }
  return `${minX.toFixed(4)}, ${minY.toFixed(4)}, ${maxX.toFixed(4)}, ${maxY.toFixed(4)}`;
};

const formatArea = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return value.toLocaleString();
};

type UseShapePreviewListViewParams = Pick<
  ShapePreviewListProps,
  | 'title'
  | 'rows'
  | 'search'
  | 'matchedRows'
  | 'countText'
  | 'countLabels'
  | 'errorSummaryById'
  | 'statusLabels'
  | 'selectedRows'
  | 'rowFilterConfig'
  | 'onWindowStateChange'
>;

export const useShapePreviewListView = ({
  title,
  rows,
  search,
  matchedRows,
  countText,
  countLabels,
  errorSummaryById,
  statusLabels,
  selectedRows,
  rowFilterConfig,
  onWindowStateChange,
}: UseShapePreviewListViewParams) => {
  const initialPosition = useMemo(() => ({ x: 80, y: 140 }), []);
  const initialSize = useMemo(() => ({ width: 560, height: 420 }), []);
  const { windowState, handlers } = useFloatingWindow({
    persistKey: WINDOW_PERSIST_KEY,
    initialPosition,
    initialSize,
  });
  const { show } = handlers;

  useEffect(() => {
    show();
  }, [show]);

  useEffect(() => {
    onWindowStateChange?.({
      isMinimized: windowState.isMinimized,
      isVisible: windowState.isVisible,
    });
  }, [onWindowStateChange, windowState.isMinimized, windowState.isVisible]);

  const normalizedRef = useRef(false);
  useEffect(() => {
    if (!windowState.isVisible) {
      show();
      return;
    }
    if (normalizedRef.current) return;

    const width = window.innerWidth || 0;
    const height = window.innerHeight || 0;
    if (width === 0 || height === 0) return;

    const hasValidSize = Number.isFinite(windowState.size.width)
      && Number.isFinite(windowState.size.height)
      && windowState.size.width >= 200
      && windowState.size.height >= 140;
    if (!hasValidSize) {
      handlers.setSize(initialSize);
    }

    const offscreen =
      windowState.position.x > width - 48
      || windowState.position.y > height - 48
      || windowState.position.x + windowState.size.width < 48
      || windowState.position.y + windowState.size.height < 48;

    if (offscreen) {
      handlers.setPosition(initialPosition);
    }

    normalizedRef.current = true;
  }, [handlers, initialPosition, initialSize, show, windowState]);

  const resolvedStatusLabels: MapPreviewStatusLabels = statusLabels ?? {
    completed: 'Completed',
    failed: 'Failed',
  };

  const searchOnly = rowFilterConfig?.searchOnly ?? true;

  const tableRows = useMemo(() => {
    const normalizeCount = (value?: number) => (typeof value === 'number' ? value : '');
    const keyword = search?.value.trim().toLowerCase();
    const filtered = keyword && searchOnly
      ? rows.filter((row) => matchedRows?.has(String(row.featureId ?? row.id)))
      : rows;

    return filtered.map((row) => {
      const rowKey = String(row.featureId ?? row.id);
      const summary = errorSummaryById?.get(rowKey);
      const hasErrors = Boolean(summary && summary.count > 0);
      return {
        id: row.featureId ?? row.id,
        status: hasErrors ? resolvedStatusLabels.failed : resolvedStatusLabels.completed,
        rawId: row.id,
        featureId: row.featureId ?? '',
        countryName: row.countryName ?? '',
        countryCode: row.countryCode ?? '',
        adminName: row.adminName ?? '',
        adminLevel: row.adminLevel != null ? formatAdminLevelLabel(row.adminLevel) : '',
        adminCode: row.adminCode ?? '',
        dataSource: row.dataSource ?? '',
        createdAt: row.createdAt ? new Date(row.createdAt).toLocaleString() : '',
        vertexCount: normalizeCount(row.vertexCount),
        polygonCount: normalizeCount(row.polygonCount),
        bbox: formatBBox(row.bbox),
        area: formatArea(row.area),
        recycling: row.recycling ?? false,
      };
    });
  }, [errorSummaryById, matchedRows, resolvedStatusLabels.completed, resolvedStatusLabels.failed, rows, search?.value, searchOnly]);

  const resolvedMatchedRows = useMemo(() => {
    if (!matchedRows) return undefined;
    const mapped = new Set<string>();
    rows.forEach((row) => {
      const rowKey = String(row.featureId ?? row.id);
      if (matchedRows.has(rowKey)) {
        mapped.add(rowKey);
      }
    });
    return mapped;
  }, [matchedRows, rows]);

  const recyclingSelectionState = useMemo(() => {
    if (!selectedRows || selectedRows.size === 0) return 'none';
    const selected = rows.filter((row) => selectedRows.has(String(row.featureId ?? row.id)));
    if (selected.length === 0) return 'none';
    const recyclingCount = selected.filter((row) => row.recycling).length;
    if (recyclingCount === 0) return 'off';
    if (recyclingCount === selected.length) return 'on';
    return 'partial';
  }, [rows, selectedRows]);

  const resolvedCountText = useMemo(() => {
    if (countText) return countText;
    if (!countLabels) return undefined;
    const keyword = search?.value.trim();
    const count = tableRows.length;
    if (keyword && searchOnly) {
      return `${count} ${countLabels.matched}`;
    }
    return `${count} ${countLabels.rows}`;
  }, [countLabels, countText, search?.value, searchOnly, tableRows.length]);

  const resolvedTitle = useMemo(() => {
    if (!resolvedCountText) return title;
    const normalizedCountText = resolvedCountText.replace(/\bRows\b/g, 'rows');
    return `${title} (${normalizedCountText})`;
  }, [resolvedCountText, title]);

  const noGrouping = useMemo<GridGroupingState>(() => [], []);

  return {
    handlers,
    noGrouping,
    recyclingSelectionState,
    resolvedMatchedRows,
    resolvedTitle,
    tableRows,
    windowState,
    searchOnly,
  };
};
