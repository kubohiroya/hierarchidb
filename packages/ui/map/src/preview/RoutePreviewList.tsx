import type React from 'react';
import { useTheme } from '@mui/material/styles';
import { FloatingWindow } from '@hierarchidb/ui-floating-window';
import {
  MapPreviewFloatingTable,
  type MapPreviewErrorSummaryById,
  type MapPreviewErrorColumnLabels,
  type MapPreviewSearchConfig,
  type MapPreviewStatusLabels,
} from './MapPreviewFloatingTable.js';
import { useRoutePreviewListView } from './useRoutePreviewListView.js';

type RoutePreviewSourcePoint = {
  name?: string;
  locationName?: string;
  admin0Name?: string;
  admin1Name?: string;
  admin2Name?: string;
};

type RoutePreviewSourceLine = {
  id: string | number;
  name?: string;
  routeMode?: string;
  startPoint?: RoutePreviewSourcePoint;
  endPoint?: RoutePreviewSourcePoint;
  waypoints?: [number, number][];
  distance?: number;
};

export type RoutePreviewLineRow = {
  id: string | number;
  routeMode?: string;
  routeName?: string;
  startName?: string;
  startAdmin0?: string;
  startAdmin1?: string;
  startAdmin2?: string;
  endName?: string;
  endAdmin0?: string;
  endAdmin1?: string;
  endAdmin2?: string;
  waypointCount?: number;
  distanceMeters?: number;
};

export type RoutePreviewColumnLabels = {
  lineId: string;
  routeMode: string;
  routeName: string;
  startName: string;
  startAdmin0: string;
  startAdmin1: string;
  startAdmin2: string;
  endName: string;
  endAdmin0: string;
  endAdmin1: string;
  endAdmin2: string;
  waypointCount: string;
  distanceMeters: string;
};

export type RoutePreviewListCountLabels = {
  matched: string;
  rows: string;
};

export type RoutePreviewModeMeta = {
  label: string;
  icon: React.ReactNode;
  color?: string;
};

export type RoutePreviewListProps = {
  title: string;
  rows: RoutePreviewLineRow[];
  columnLabels: RoutePreviewColumnLabels;
  toolbarActions?: React.ReactNode;
  search?: MapPreviewSearchConfig;
  matchedRows?: Set<string>;
  modeMeta?: Record<string, RoutePreviewModeMeta>;
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

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const estimateLineDistance = (waypoints?: [number, number][]): number | undefined => {
  if (!waypoints || waypoints.length < 2) return undefined;
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    if (!start || !end) continue;
    total += haversineMeters(start[1], start[0], end[1], end[0]);
  }
  return total;
};

const resolvePointName = (point?: RoutePreviewSourcePoint): string | undefined => (
  point?.name ?? point?.locationName
);

export const buildRoutePreviewRows = (lines: RoutePreviewSourceLine[]): RoutePreviewLineRow[] => (
  lines.map((line) => {
    const waypointCount = Math.max(0, (line.waypoints?.length ?? 0) - 2);
    const distanceMeters = line.distance ?? estimateLineDistance(line.waypoints);
    return {
      id: line.id,
      routeMode: line.routeMode,
      routeName: line.name,
      startName: resolvePointName(line.startPoint),
      startAdmin0: line.startPoint?.admin0Name,
      startAdmin1: line.startPoint?.admin1Name,
      startAdmin2: line.startPoint?.admin2Name,
      endName: resolvePointName(line.endPoint),
      endAdmin0: line.endPoint?.admin0Name,
      endAdmin1: line.endPoint?.admin1Name,
      endAdmin2: line.endPoint?.admin2Name,
      waypointCount,
      distanceMeters,
    };
  })
);

export const RoutePreviewList: React.FC<RoutePreviewListProps> = ({
  title,
  rows,
  columnLabels,
  toolbarActions,
  search,
  matchedRows,
  modeMeta,
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
  const { tableRows, resolvedMatchedRows, columns, resolvedTitle } = useRoutePreviewListView({
    rows,
    columnLabels,
    search,
    matchedRows,
    modeMeta,
    countText,
    countLabels,
    title,
  });

  return (
    <FloatingWindow
      title={resolvedTitle}
      initialState={{
        position: { x: 80, y: 140 },
        size: { width: 740, height: 420 },
        isVisible: true,
        isMinimized: false,
      }}
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
        toolbarActions={toolbarActions}
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
