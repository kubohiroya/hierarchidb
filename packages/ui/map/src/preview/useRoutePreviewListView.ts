import { useMemo } from 'react';
import type {
  RoutePreviewLineRow,
  RoutePreviewListCountLabels,
} from './RoutePreviewList.js';
import type { MapPreviewSearchConfig } from './MapPreviewFloatingTable.js';

type UseRoutePreviewListViewArgs = {
  rows: RoutePreviewLineRow[];
  search?: MapPreviewSearchConfig;
  matchedRows?: Set<string>;
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
  search,
  matchedRows,
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
    resolvedTitle,
  };
};
