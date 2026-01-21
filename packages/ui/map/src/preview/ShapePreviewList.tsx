import React, { useCallback, useMemo, useState } from 'react';
import { Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { GridColumn } from '@hierarchidb/ui-grid';
import { FloatingWindow } from '@hierarchidb/ui-floating-window';
import {
  MapPreviewFloatingTable,
  type MapPreviewErrorSummaryById,
  type MapPreviewErrorColumnLabels,
  type MapPreviewSearchConfig,
  type MapPreviewStatusLabels,
} from './MapPreviewFloatingTable.js';

type ShapePreviewRowBase = {
  id: string;
  featureId?: string;
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
  search?: MapPreviewSearchConfig;
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
};

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
}) => {
  const theme = useTheme();
  const [sortColumn, setSortColumn] = useState<string>('featureId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const resolvedStatusLabels: MapPreviewStatusLabels = statusLabels ?? {
    completed: 'Completed',
    failed: 'Failed',
  };

  const tableRows = useMemo(() => {
    const normalizeCount = (value?: number) => (typeof value === 'number' ? value : '');
    const keyword = search?.value.trim().toLowerCase();
    const filtered = keyword
      ? rows.filter((row) => matchedRows?.has(String(row.featureId ?? row.id)))
      : rows;
    const mapped = filtered.map((row) => ({
      id: row.featureId ?? row.id,
      status: (() => {
        const summary = errorSummaryById?.get(String(row.featureId ?? row.id));
        const hasErrors = Boolean(summary && summary.count > 0);
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
    }));
    const sorted = [...mapped].sort((a, b) => {
      const av = a[sortColumn as keyof typeof a];
      const bv = b[sortColumn as keyof typeof b];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDirection === 'asc' ? av - bv : bv - av;
      }
      const astr = String(av ?? '');
      const bstr = String(bv ?? '');
      return sortDirection === 'asc' ? astr.localeCompare(bstr) : bstr.localeCompare(astr);
    });
    return sorted;
  }, [
    errorSummaryById,
    matchedRows,
    resolvedStatusLabels.completed,
    resolvedStatusLabels.failed,
    rows,
    search?.value,
    sortColumn,
    sortDirection,
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

  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
  }, []);

  const columns = useMemo<GridColumn<(typeof tableRows)[number]>[]>(() => ([
    { id: 'featureId', label: columnLabels.featureId, width: 220, sortable: true },
    { id: 'countryName', label: columnLabels.countryName, width: 180, sortable: true },
    { id: 'countryCode', label: columnLabels.countryCode, width: 120, sortable: true },
    { id: 'adminName', label: columnLabels.adminName, width: 180, sortable: true },
    { id: 'adminLevel', label: columnLabels.adminLevel, width: 120, align: 'right', sortable: true },
    { id: 'adminCode', label: columnLabels.adminCode, width: 120, sortable: true },
    { id: 'dataSource', label: columnLabels.dataSource, width: 140, sortable: true },
    { id: 'createdAt', label: columnLabels.createdAt, width: 180, sortable: true },
    { id: 'vertexCount', label: columnLabels.vertexCount, width: 120, align: 'right', sortable: true },
    { id: 'polygonCount', label: columnLabels.polygonCount, width: 120, align: 'right', sortable: true },
    { id: 'bbox', label: columnLabels.bbox, width: 220, sortable: true },
    { id: 'area', label: columnLabels.area, width: 140, align: 'right', sortable: true, format: formatLogicalCode },
  ]), [columnLabels]);

  const resolvedCountText = useMemo(() => {
    if (countText) return countText;
    if (!countLabels) return undefined;
    const keyword = search?.value.trim();
    const count = tableRows.length;
    return keyword ? `${count} ${countLabels.matched}` : `${count} ${countLabels.rows}`;
  }, [countLabels, countText, search?.value, tableRows.length]);
  const resolvedTitle = useMemo(() => {
    if (!resolvedCountText) return title;
    return `${title}(${resolvedCountText})`;
  }, [resolvedCountText, title]);

  return (
    <FloatingWindow
      title={resolvedTitle}
      initialState={{
        position: { x: 80, y: 140 },
        size: { width: 560, height: 420 },
        isVisible: true,
        isMinimized: false,
      }}
      onClose={onClose}
    >
      <MapPreviewFloatingTable
        title={resolvedTitle}
        showTitle={false}
        rows={tableRows}
        columns={columns}
        search={search}
        loading={loading}
        error={error}
        matchedRows={resolvedMatchedRows}
        selectable={Boolean(onSelectionChange)}
        selectionMode="multiple"
        selectedRows={selectedRows}
        onSelectionChange={onSelectionChange}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
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
            const matchedBg = theme.palette.secondary.light;
            const matchedText = theme.palette.getContrastText(matchedBg);
            return {
              backgroundColor: matchedBg,
              boxShadow: `inset 3px 0 0 0 ${theme.palette.secondary.main}`,
              color: matchedText,
              '& td, & td *': { color: matchedText },
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
        maxHeight={maxHeight}
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
