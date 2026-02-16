import React, { useEffect, useMemo } from 'react';
import { IconButton, Typography } from '@mui/material';
import { Hexagon } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { Recycling as RecyclingIcon } from '@mui/icons-material';
import type { GridColumn, GridGroupingState } from '@hierarchidb/ui-grid';
import { FloatingWindow, useFloatingWindow } from '@hierarchidb/ui-floating-window';
import {
  MapPreviewFloatingTable,
  type MapPreviewErrorSummaryById,
  type MapPreviewErrorColumnLabels,
  type MapPreviewStatusLabels,
} from './MapPreviewFloatingTable.js';
import type { FeatureTableSearchConfig } from './FeatureTableToolbar.js';

type ShapePreviewRowBase = {
  recycling?: boolean;
  id: string;
  featureId?: string;
  errorCount?: number;
  repairCount?: number;
  memberFeatureIds?: string[];
  aggregationLevel?: 'feature' | 'admin' | 'country';
  countryName?: string;
  countryCode?: string;
  adminName?: string;
  adminLevel?: number;
  adminCode?: string;
  dataSource?: string;
  createdAt?: number;
  vertexCount?: number;
  polygonCount?: number;
  bbox?: [number, number, number, number];
  area?: number;
};

export type ShapePreviewFeatureRow = ShapePreviewRowBase;

export type ShapePreviewColumnLabels = {
  featureId: string;
  countryName: string;
  countryCode: string;
  adminName: string;
  adminLevel: string;
  adminCode: string;
  dataSource: string;
  createdAt: string;
  vertexCount: string;
  polygonCount: string;
  bbox: string;
  area: string;
};

export type ShapePreviewListCountLabels = {
  matched: string;
  rows: string;
};

export type ShapePreviewListProps = {
  title: string;
  rows: ShapePreviewFeatureRow[];
  columnLabels: ShapePreviewColumnLabels;
  search?: FeatureTableSearchConfig;
  matchedRows?: Set<string>;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string | number>) => void;
  loading?: boolean;
  error?: string;
  countText?: string;
  countLabels?: ShapePreviewListCountLabels;
  emptyContent?: React.ReactNode;
  errorSummaryById?: MapPreviewErrorSummaryById;
  errorColumnLabels?: MapPreviewErrorColumnLabels;
  statusLabels?: MapPreviewStatusLabels;
  maxHeight?: number;
  onClose?: () => void;
  onToggleRecycling?: () => void;
  rowFilterConfig?: {
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
};

const WINDOW_PERSIST_KEY = 'hierarchidb:ui:floating-window:shape:features';

const formatLogicalCode = (value: unknown) => {
  const text = String(value ?? '');
  if (text === 'N/A') {
    return React.createElement(Typography, { color: 'error.main' }, 'N/A');
  }
  return text;
};

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

export const ShapePreviewList: React.FC<ShapePreviewListProps> = ({
  title,
  rows,
  columnLabels,
  search,
  matchedRows,
  selectedRows,
  onSelectionChange,
  loading,
  error,
  countText,
  countLabels,
  emptyContent,
  errorSummaryById,
  errorColumnLabels,
  statusLabels,
  maxHeight,
  onClose,
  onToggleRecycling,
  rowFilterConfig,
}) => {
  const theme = useTheme();
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
  const normalizedRef = React.useRef(false);
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
      windowState.position.x > width - 48 ||
      windowState.position.y > height - 48 ||
      windowState.position.x + windowState.size.width < 48 ||
      windowState.position.y + windowState.size.height < 48;
    if (offscreen) {
      handlers.setPosition(initialPosition);
    }
    normalizedRef.current = true;
  }, [handlers, initialPosition, initialSize, show, windowState.isVisible, windowState.position.x, windowState.position.y, windowState.size.height, windowState.size.width]);
  const resolvedStatusLabels: MapPreviewStatusLabels = statusLabels ?? {
    completed: 'Completed',
    failed: 'Failed',
  };
  const noGrouping = useMemo<GridGroupingState>(() => [], []);

  const searchOnly = rowFilterConfig?.searchOnly ?? true;
  const tableRows = useMemo(() => {
    const normalizeCount = (value?: number) => (typeof value === 'number' ? value : '');
    const keyword = search?.value.trim().toLowerCase();
    const filtered = keyword && searchOnly
      ? rows.filter((row) => matchedRows?.has(String(row.featureId ?? row.id)))
      : rows;
    const mapped = filtered.map((row) => ({
      id: row.featureId ?? row.id,
      status: (() => {
        const summary = errorSummaryById?.get(String(row.featureId ?? row.id));
        const errorCount = summary ? (summary.errorCount ?? summary.count ?? 0) : 0;
        const hasErrors = errorCount > 0;
        return hasErrors ? resolvedStatusLabels.failed : resolvedStatusLabels.completed;
      })(),
      rawId: row.id,
      featureId: row.featureId ?? '',
      countryName: row.countryName ?? '',
      countryCode: row.countryCode ?? '',
      adminName: row.adminName ?? '',
      adminLevel: row.adminLevel != null ? `ADM${row.adminLevel}` : '',
      adminCode: row.adminCode ?? '',
      dataSource: row.dataSource ?? '',
      createdAt: row.createdAt ? new Date(row.createdAt).toLocaleString() : '',
      vertexCount: normalizeCount(row.vertexCount),
      polygonCount: normalizeCount(row.polygonCount),
      bbox: formatBBox(row.bbox),
      area: formatArea(row.area),
      recycling: row.recycling ?? false,
    }));
    return mapped;
  }, [
    errorSummaryById,
    matchedRows,
    resolvedStatusLabels.completed,
    resolvedStatusLabels.failed,
    rows,
    search?.value,
    searchOnly,
  ]);

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

  const columns = useMemo<GridColumn<(typeof tableRows)[number]>[]>(() => ([
    { id: 'featureId', label: columnLabels.featureId, width: 220, sortable: true },
    { id: 'countryName', label: columnLabels.countryName, width: 180, sortable: true },
    { id: 'countryCode', label: columnLabels.countryCode, width: 120, sortable: true },
    { id: 'adminName', label: columnLabels.adminName, width: 180, sortable: true },
    {
      id: 'adminLevel',
      label: columnLabels.adminLevel,
      width: 120,
      align: 'right',
      sortable: true,
    },
    { id: 'adminCode', label: columnLabels.adminCode, width: 120, sortable: true },
    { id: 'dataSource', label: columnLabels.dataSource, width: 140, sortable: true },
    { id: 'createdAt', label: columnLabels.createdAt, width: 180, sortable: true },
    { id: 'vertexCount', label: columnLabels.vertexCount, width: 120, align: 'right', sortable: true },
    { id: 'polygonCount', label: columnLabels.polygonCount, width: 120, align: 'right', sortable: true },
    { id: 'bbox', label: columnLabels.bbox, width: 220, sortable: true },
    { id: 'area', label: columnLabels.area, width: 140, align: 'right', sortable: true, format: formatLogicalCode },
  ]), [columnLabels]);

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

  return (
    <FloatingWindow
      title={resolvedTitle}
      titleIcon={<Hexagon sx={{ fontSize: '1rem', ml: 1 }} />}
      initialState={windowState}
      onStateChange={handlers.onStateChange}
      onClose={onClose}
    >
      <MapPreviewFloatingTable
        title={resolvedTitle}
        showTitle={false}
        rows={tableRows}
        columns={columns}
        persistKeyBase="hierarchidb:grid:shape:step6:features"
        defaultSorting={[{ id: 'featureId', desc: false }]}
        search={search}
        loading={loading}
        error={error}
        matchedRows={resolvedMatchedRows}
        selectable={Boolean(onSelectionChange)}
        selectionMode="multiple"
        selectedRows={selectedRows}
        onSelectionChange={onSelectionChange}
        rowSx={(state) => {
          if (state.selected) {
            const selectedBg = theme.palette.primary.light;
            const selectedText = theme.palette.getContrastText(selectedBg);
            return {
              backgroundColor: selectedBg,
              color: selectedText,
              '& td, & td *': { color: selectedText },
            };
          }
          if (state.matched) {
            const matchedBg = alpha(theme.palette.secondary.main, 0.08);
            const matchedBorder = alpha(theme.palette.secondary.main, 0.4);
            return {
              backgroundColor: matchedBg,
              boxShadow: `inset 3px 0 0 0 ${matchedBorder}`,
            };
          }
          if (state.hovered) {
            return { backgroundColor: theme.palette.action.hover };
          }
          return undefined;
        }}
        emptyContent={emptyContent}
        errorSummaryById={errorSummaryById}
        errorColumnLabels={errorColumnLabels}
        statusLabels={statusLabels}
        showRepairCountColumn
        statusAdornment={(row) => (row.recycling ? <RecyclingIcon fontSize="small" color="success" /> : null)}
        toolbarActions={onToggleRecycling ? (
          <IconButton
            aria-label="Toggle recycling"
            size="small"
            onClick={onToggleRecycling}
            disabled={recyclingSelectionState === 'none'}
          >
            <RecyclingIcon
              fontSize="small"
              color={recyclingSelectionState === 'on' ? 'success' : recyclingSelectionState === 'partial' ? 'warning' : 'inherit'}
            />
          </IconButton>
          ) : null}
        maxHeight={maxHeight}
        rowFilterConfig={rowFilterConfig}
        grouping={noGrouping}
        containerSx={{
          position: 'static',
          width: '100%',
          maxWidth: '100%',
          height: '100%',
          maxHeight: '100%',
          top: 'auto',
          right: 'auto',
          boxShadow: 'none',
        }}
      />
    </FloatingWindow>
  );
};
