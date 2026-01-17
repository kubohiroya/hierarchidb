import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import type { GridColumn } from '@hierarchidb/ui-grid';
import {
  MapPreviewFloatingTable,
  type MapPreviewErrorSummaryById,
  type MapPreviewErrorColumnLabels,
  type MapPreviewSearchConfig,
  type MapPreviewStatusLabels,
} from './MapPreviewFloatingTable.js';

export type RoutePreviewLineRow = {
  id: string | number;
  startLon?: number;
  startLat?: number;
  endLon?: number;
  endLat?: number;
  distanceMeters?: number;
  vertexCount?: number;
};

export type RoutePreviewColumnLabels = {
  lineId: string;
  startLon: string;
  startLat: string;
  endLon: string;
  endLat: string;
  distanceMeters: string;
  vertexCount: string;
};

export type RoutePreviewListCountLabels = {
  matched: string;
  rows: string;
};

export type RoutePreviewListProps = {
  title: string;
  rows: RoutePreviewLineRow[];
  columnLabels: RoutePreviewColumnLabels;
  search?: MapPreviewSearchConfig;
  matchedRows?: Set<string>;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string | number>) => void;
  loading?: boolean;
  error?: string;
  countText?: string;
  countLabels?: RoutePreviewListCountLabels;
  emptyContent?: React.ReactNode;
  errorSummaryById?: MapPreviewErrorSummaryById;
  errorColumnLabels?: MapPreviewErrorColumnLabels;
  statusLabels?: MapPreviewStatusLabels;
  maxHeight?: number;
};

const formatNumber = (value?: number, digits = 4) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return value.toFixed(digits);
};

const formatInteger = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return Math.round(value).toLocaleString();
};

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const computeDistanceMeters = (coords: [number, number][]): number => {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const [lon1, lat1] = coords[i]!;
    const [lon2, lat2] = coords[i + 1]!;
    total += haversineMeters(lat1, lon1, lat2, lon2);
  }
  return total;
};

export const buildRoutePreviewRows = (lines: [number, number][][]): RoutePreviewLineRow[] => (
  lines.map((coords, index) => {
    const [startLon, startLat] = coords[0] ?? [undefined, undefined];
    const [endLon, endLat] = coords[coords.length - 1] ?? [undefined, undefined];
    return {
      id: index,
      startLon,
      startLat,
      endLon,
      endLat,
      distanceMeters: computeDistanceMeters(coords),
      vertexCount: coords.length,
    };
  })
);

export const RoutePreviewList: React.FC<RoutePreviewListProps> = ({
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
}) => {
  const theme = useTheme();
  const [sortColumn, setSortColumn] = useState<string>('lineId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const tableRows = useMemo(() => {
    const keyword = search?.value.trim().toLowerCase();
    const filtered = keyword
      ? rows.filter((row) => matchedRows?.has(String(row.id)))
      : rows;
    const mapped = filtered.map((row) => ({
      id: row.id,
      lineId: row.id,
      startLon: formatNumber(row.startLon),
      startLat: formatNumber(row.startLat),
      endLon: formatNumber(row.endLon),
      endLat: formatNumber(row.endLat),
      distanceMeters: formatInteger(row.distanceMeters),
      vertexCount: typeof row.vertexCount === 'number' ? row.vertexCount : '',
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
  }, [matchedRows, rows, search?.value, sortColumn, sortDirection]);

  const resolvedMatchedRows = useMemo(() => {
    if (!matchedRows) return undefined;
    return new Set(Array.from(matchedRows).map(String));
  }, [matchedRows]);

  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
  }, []);

  const columns = useMemo<GridColumn<(typeof tableRows)[number]>[]>(() => ([
    { id: 'lineId', label: columnLabels.lineId, width: 120, sortable: true },
    { id: 'startLon', label: columnLabels.startLon, width: 140, align: 'right', sortable: true },
    { id: 'startLat', label: columnLabels.startLat, width: 140, align: 'right', sortable: true },
    { id: 'endLon', label: columnLabels.endLon, width: 140, align: 'right', sortable: true },
    { id: 'endLat', label: columnLabels.endLat, width: 140, align: 'right', sortable: true },
    { id: 'distanceMeters', label: columnLabels.distanceMeters, width: 160, align: 'right', sortable: true },
    { id: 'vertexCount', label: columnLabels.vertexCount, width: 140, align: 'right', sortable: true },
  ]), [columnLabels]);

  const resolvedCountText = useMemo(() => {
    if (countText) return countText;
    if (!countLabels) return undefined;
    const keyword = search?.value.trim();
    const count = tableRows.length;
    return keyword ? `${count} ${countLabels.matched}` : `${count} ${countLabels.rows}`;
  }, [countLabels, countText, search?.value, tableRows.length]);

  return (
    <MapPreviewFloatingTable
      title={title}
      rows={tableRows}
      columns={columns}
      search={search}
      countText={resolvedCountText}
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
    />
  );
};
