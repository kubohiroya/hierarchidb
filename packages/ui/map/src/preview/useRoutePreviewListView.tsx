import { useMemo } from 'react';
import type { GridColumn } from '@hierarchidb/ui-grid';
import { Box } from '@mui/material';
import type {
  RoutePreviewColumnLabels,
  RoutePreviewLineRow,
  RoutePreviewListCountLabels,
  RoutePreviewModeMeta,
} from './RoutePreviewList.js';
import type { MapPreviewSearchConfig } from './MapPreviewFloatingTable.js';

type UseRoutePreviewListViewArgs = {
  rows: RoutePreviewLineRow[];
  columnLabels: RoutePreviewColumnLabels;
  search?: MapPreviewSearchConfig;
  matchedRows?: Set<string>;
  modeMeta?: Record<string, RoutePreviewModeMeta>;
  countText?: string;
  countLabels?: RoutePreviewListCountLabels;
  title: string;
};

const formatNumber = (value?: number, digits = 4) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return value.toFixed(digits);
};

const formatInteger = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return Math.round(value).toLocaleString();
};

export const useRoutePreviewListView = ({
  rows,
  columnLabels,
  search,
  matchedRows,
  modeMeta,
  countText,
  countLabels,
  title,
}: UseRoutePreviewListViewArgs) => {
  const tableRows = useMemo(() => {
    const keyword = search?.value.trim().toLowerCase();
    const filtered = keyword
      ? rows.filter((row) => matchedRows?.has(String(row.id)))
      : rows;
    return filtered.map((row) => ({
      id: row.id,
      lineId: row.id,
      routeMode: row.routeMode ?? '',
      routeName: row.routeName ?? '',
      startName: row.startName ?? '',
      startAdmin0: row.startAdmin0 ?? '',
      startAdmin1: row.startAdmin1 ?? '',
      startAdmin2: row.startAdmin2 ?? '',
      endName: row.endName ?? '',
      endAdmin0: row.endAdmin0 ?? '',
      endAdmin1: row.endAdmin1 ?? '',
      endAdmin2: row.endAdmin2 ?? '',
      waypointCount: formatInteger(row.waypointCount),
      distanceMeters: formatNumber(row.distanceMeters, 2),
    }));
  }, [matchedRows, rows, search?.value]);

  const resolvedMatchedRows = useMemo(() => {
    if (!matchedRows) return undefined;
    return new Set(Array.from(matchedRows).map(String));
  }, [matchedRows]);

  const columns = useMemo<GridColumn<(typeof tableRows)[number]>[]>(() => ([
    { id: 'lineId', label: columnLabels.lineId, width: 120, sortable: true },
    {
      id: 'routeMode',
      label: columnLabels.routeMode,
      width: 150,
      sortable: true,
      format: (value) => {
        const key = typeof value === 'string' ? value : String(value ?? '');
        const meta = key ? modeMeta?.[key] : undefined;
        if (!meta) return key;
        return (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ display: 'inline-flex', color: meta.color }}>{meta.icon}</Box>
            <span>{meta.label}</span>
          </Box>
        );
      },
    },
    { id: 'routeName', label: columnLabels.routeName, width: 180, sortable: true },
    { id: 'startName', label: columnLabels.startName, width: 160, sortable: true },
    { id: 'startAdmin0', label: columnLabels.startAdmin0, width: 160, sortable: true },
    { id: 'startAdmin1', label: columnLabels.startAdmin1, width: 160, sortable: true },
    { id: 'startAdmin2', label: columnLabels.startAdmin2, width: 160, sortable: true },
    { id: 'endName', label: columnLabels.endName, width: 160, sortable: true },
    { id: 'endAdmin0', label: columnLabels.endAdmin0, width: 160, sortable: true },
    { id: 'endAdmin1', label: columnLabels.endAdmin1, width: 160, sortable: true },
    { id: 'endAdmin2', label: columnLabels.endAdmin2, width: 160, sortable: true },
    { id: 'waypointCount', label: columnLabels.waypointCount, width: 140, align: 'right', sortable: true },
    { id: 'distanceMeters', label: columnLabels.distanceMeters, width: 160, align: 'right', sortable: true },
  ]), [columnLabels, modeMeta, tableRows]);

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

  return {
    tableRows,
    resolvedMatchedRows,
    columns,
    resolvedTitle,
  };
};
