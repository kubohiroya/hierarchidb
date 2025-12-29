/**
 * @file modelessDialogContent.tsx
 * @description Content blocks for modeless map dialog windows.
 */

import type { ResourceGeoJsonLayer, ResourceVectorLayer } from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  Box,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { GenericDataGrid, type GenericDataGridProps, type GridColumn } from '@hierarchidb/ui-grid';
import type { NodeId } from '@hierarchidb/common-types';
import { shapeDB, type FeatureRecord } from '@hierarchidb/shape-store';
import { RouteDatabase, type RouteLineString } from '@hierarchidb/route-store';
import { getEphemeralLocationDB } from '@hierarchidb/location-store';
import { SimpleTableMetadataManager, TabularQueryService } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  mapHoverMatchAtom,
  mapLayerInfoAtom,
  mapSearchMatchesAtom,
  mapSelectedMatchAtom,
  mapViewportFeatureIdsAtom,
  type MapHighlightEntry,
  type MapLayerInfo,
  type MapNodeType,
} from '../../../state/mapSearch.atoms.js';

export type MapInfoSummary = {
  name?: string | null;
  description?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
  tags?: string[] | null;
  path?: string | null;
};

const formatTimestamp = (value?: number | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const formatText = (value?: string | null) => (value && value.trim().length > 0 ? value : '—');

const MAX_ROWS = 1000;

type DataGridRow = Record<string, unknown>;
type DataGridRowSx = GenericDataGridProps<DataGridRow>['rowSx'];

type DataGridState = {
  rows: DataGridRow[];
  columns: GridColumn[];
  loading: boolean;
  error?: string;
  truncated?: boolean;
  emptyMessage?: string;
  totalRows?: number;
};

type DataGridPagination = {
  enabled: boolean;
  page: number;
  rowsPerPage: number;
  rowsPerPageOptions: number[];
  onPageChange: (next: number) => void;
  onRowsPerPageChange: (next: number) => void;
};

const buildColumns = (names: string[]): GridColumn[] =>
  names.map((name) => ({
    id: name,
    label: name,
    sortable: true,
  }));

const extractColumnNames = (columns: Array<unknown> | undefined | null): string[] => {
  if (!Array.isArray(columns)) return [];
  return columns
    .map((column) => {
      if (typeof column === 'string') return column;
      if (column && typeof column === 'object') {
        const record = column as { name?: unknown; id?: unknown };
        if (typeof record.name === 'string') return record.name;
        if (record.id !== undefined && record.id !== null) return String(record.id);
      }
      return undefined;
    })
    .filter((value): value is string => typeof value === 'string');
};

const renderEmptyState = (message?: string) => (
  <Box p={3} textAlign="center">
    <Typography color="text.secondary">{message ?? 'No data available'}</Typography>
  </Box>
);

const useShapeTableData = (
  nodeId: NodeId | null,
  page: number,
  rowsPerPage: number,
  visibleIds?: Set<string | number> | null,
): DataGridState => {
  const [state, setState] = useState<DataGridState>({
    rows: [],
    columns: buildColumns(['id', 'name', 'countryCode', 'adminLevel', 'area', 'population', 'geometryType']),
    loading: false,
  });

  useEffect(() => {
    if (!nodeId) return;
    let cancelled = false;
    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: undefined }));
      try {
        const collection = shapeDB.features.where('nodeId').equals(nodeId);
        const filterByViewport = visibleIds !== undefined && visibleIds !== null;
        let totalRows = 0;
        let items: FeatureRecord[] = [];
        if (filterByViewport) {
          if (visibleIds.size === 0) {
            totalRows = 0;
            items = [];
          } else {
            const filtered = await collection
              .and((feature) => visibleIds.has(feature.id))
              .toArray();
            totalRows = filtered.length;
            items = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
          }
        } else {
          totalRows = await collection.count();
          items = await collection
            .offset(page * rowsPerPage)
            .limit(rowsPerPage)
            .toArray();
        }
        const rows = items.map((feature: FeatureRecord) => ({
          id: feature.id,
          name: feature.name ?? '',
          countryCode: feature.countryCode ?? '',
          adminLevel: feature.adminLevel ?? '',
          area: feature.area ?? '',
          population: feature.population ?? '',
          geometryType: feature.geometry?.type ?? '',
        }));
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            rows,
            loading: false,
            totalRows,
            emptyMessage: filterByViewport ? 'No visible features in the current map view.' : undefined,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            rows: [],
            loading: false,
            error: (error as { message?: string })?.message ?? String(error),
          }));
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [nodeId, page, rowsPerPage, visibleIds]);

  return state;
};

const useRouteTableData = (
  nodeId: NodeId | null,
  page: number,
  rowsPerPage: number,
  visibleIds?: Set<string | number> | null,
): DataGridState => {
  const routeDb = useMemo(() => new RouteDatabase(), []);
  const [state, setState] = useState<DataGridState>({
    rows: [],
    columns: buildColumns(['id', 'name', 'routeMode', 'startName', 'endName', 'distance', 'speed', 'featureId']),
    loading: false,
  });

  useEffect(() => {
    if (!nodeId) return;
    let cancelled = false;
    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: undefined }));
      try {
        const collection = routeDb.lineStrings.where('nodeId').equals(nodeId);
        const filterByViewport = visibleIds !== undefined && visibleIds !== null;
        let totalRows = 0;
        let items: RouteLineString[] = [];
        if (filterByViewport) {
          if (visibleIds.size === 0) {
            totalRows = 0;
            items = [];
          } else {
            const filtered = await collection
              .and((line) => visibleIds.has(line.id))
              .toArray();
            totalRows = filtered.length;
            items = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
          }
        } else {
          totalRows = await collection.count();
          items = await collection
            .offset(page * rowsPerPage)
            .limit(rowsPerPage)
            .toArray();
        }
        const rows = items.map((line: RouteLineString) => ({
          id: line.id,
          name: line.name ?? '',
          routeMode: line.routeMode ?? '',
          startName: line.startPoint?.name ?? '',
          endName: line.endPoint?.name ?? '',
          distance: line.distance ?? '',
          speed: line.speed ?? '',
          featureId: line.featureId ?? '',
        }));
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            rows,
            loading: false,
            totalRows,
            emptyMessage: filterByViewport ? 'No visible features in the current map view.' : undefined,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            rows: [],
            loading: false,
            error: (error as { message?: string })?.message ?? String(error),
          }));
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [nodeId, page, rowsPerPage, routeDb, visibleIds]);

  return state;
};

const useLocationTableData = (
  nodeId: NodeId | null,
  visibleIds?: Set<string | number> | null,
): DataGridState => {
  const [state, setState] = useState<DataGridState>({
    rows: [],
    columns: [],
    loading: false,
    emptyMessage: 'Location table is not available yet.',
  });

  useEffect(() => {
    if (!nodeId) return;
    let cancelled = false;
    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: undefined }));
      try {
        const db = getEphemeralLocationDB();
        const sessions = await db.sessions.where('nodeId').equals(nodeId).toArray();
        const latest = sessions.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
        const tableId = latest?.tableId;
        if (!tableId) {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              rows: [],
              columns: [],
              loading: false,
              emptyMessage: 'Location table is not available yet.',
            }));
          }
          return;
        }
        const manager = new SimpleTableMetadataManager(getDBName('location-metadata-db'));
        const metadata = await manager.get(tableId);
        const columnNames = extractColumnNames(metadata?.columns);
        const svc = new TabularQueryService('location');
        const rows = await svc.query(tableId, [], MAX_ROWS + 1);
        const filterByViewport = visibleIds !== undefined && visibleIds !== null;
        const filteredRows = filterByViewport
          ? rows.filter((row) => visibleIds.has((row as { id?: string | number }).id ?? ''))
          : rows;
        const truncated = filteredRows.length > MAX_ROWS;
        const trimmedRows = filteredRows.slice(0, MAX_ROWS) as DataGridRow[];
        const derivedColumns = columnNames.length > 0
          ? columnNames
          : Object.keys(trimmedRows[0] ?? {});
        if (!cancelled) {
          setState({
            rows: trimmedRows,
            columns: buildColumns(derivedColumns),
            loading: false,
            truncated,
            totalRows: filterByViewport ? filteredRows.length : metadata?.totalRows,
            emptyMessage: filterByViewport ? 'No visible features in the current map view.' : undefined,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            rows: [],
            columns: [],
            loading: false,
            error: (error as { message?: string })?.message ?? String(error),
          }));
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [nodeId, visibleIds]);

  return state;
};

export const MapInfoContent: React.FC<{ formattedZxy: string; info: MapInfoSummary }> = ({ formattedZxy, info }) => (
  <Stack spacing={1}>
    <Box>
      <Typography variant="overline" color="text.secondary">Name</Typography>
      <Typography variant="body2">{formatText(info.name)}</Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">Description</Typography>
      <Typography variant="body2">{formatText(info.description)}</Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">Created At</Typography>
      <Typography variant="body2">{formatTimestamp(info.createdAt)}</Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">Updated At</Typography>
      <Typography variant="body2">{formatTimestamp(info.updatedAt)}</Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">Tags</Typography>
      <Typography variant="body2">
        {(info.tags && info.tags.length > 0) ? info.tags.join(', ') : '—'}
      </Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">Path</Typography>
      <Typography variant="body2">{formatText(info.path)}</Typography>
    </Box>
    <Divider />
    <Stack spacing={0.5}>
      <Typography variant="body2">URL Format: <code>?zxy=zoom,lng,lat</code></Typography>
      <Typography variant="body2">Current: <code>?zxy={formattedZxy}</code></Typography>
    </Stack>
  </Stack>
);

export const MapLayerContent: React.FC<{
  basemapStyles: Array<{ nodeId: string; absolutePath?: string }>;
  vectorLayers: ResourceVectorLayer[];
  geoJsonLayers: ResourceGeoJsonLayer[];
}> = ({ basemapStyles, vectorLayers, geoJsonLayers }) => (
  <Stack spacing={2}>
    <Box>
      <Typography variant="subtitle2">Basemaps</Typography>
      {basemapStyles.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No basemap styles.</Typography>
      ) : (
        <List dense>
          {basemapStyles.map((style) => (
            <ListItem key={style.nodeId} disablePadding>
              <ListItemText primary={style.absolutePath ?? style.nodeId} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
    <Divider />
    <Box>
      <Typography variant="subtitle2">Vector Layers</Typography>
      {vectorLayers.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No vector layers.</Typography>
      ) : (
        <List dense>
          {vectorLayers.map((layer) => (
            <ListItem key={layer.nodeId} disablePadding>
              <ListItemText primary={layer.absolutePath ?? layer.nodeId} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
    <Divider />
    <Box>
      <Typography variant="subtitle2">GeoJSON Layers</Typography>
      {geoJsonLayers.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No GeoJSON layers.</Typography>
      ) : (
        <List dense>
          {geoJsonLayers.map((layer) => (
            <ListItem key={layer.layerId} disablePadding>
              <ListItemText primary={layer.absolutePath ?? layer.layerId} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  </Stack>
);

const DataGridPanel: React.FC<{
  state: DataGridState;
  pagination?: DataGridPagination;
  matchedRows?: Set<string | number>;
  selectedRows?: Set<string | number>;
  hoveredRows?: Set<string | number>;
  onRowHover?: GenericDataGridProps<DataGridRow>['onRowHover'];
  onRowLeave?: GenericDataGridProps<DataGridRow>['onRowLeave'];
  onRowClick?: (row: DataGridRow, rowId: string | number) => void;
  rowSx?: DataGridRowSx;
}> = ({
  state,
  pagination,
  matchedRows,
  selectedRows,
  hoveredRows,
  onRowHover,
  onRowLeave,
  onRowClick,
  rowSx,
}) => {
  const totalCount = state.totalRows ?? state.rows.length;
  const shouldPaginate = Boolean(
    pagination?.enabled && totalCount > pagination.rowsPerPage,
  );
  if (state.loading) {
    return (
      <Box p={3} display="flex" justifyContent="center">
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Stack spacing={1}>
      {state.truncated ? (
        <Typography variant="caption" color="text.secondary">
          Showing first {MAX_ROWS} rows.
        </Typography>
      ) : null}
      <GenericDataGrid
        columns={state.columns}
        rows={state.rows}
        totalRows={state.totalRows}
        enableVirtualization={!shouldPaginate}
        maxHeight={360}
        error={state.error}
        emptyComponent={renderEmptyState(state.emptyMessage)}
        page={shouldPaginate ? pagination?.page ?? 0 : 0}
        rowsPerPage={pagination?.rowsPerPage ?? 100}
        rowsPerPageOptions={pagination?.rowsPerPageOptions ?? [100]}
        onPageChange={shouldPaginate ? pagination?.onPageChange : undefined}
        onRowsPerPageChange={shouldPaginate ? pagination?.onRowsPerPageChange : undefined}
        matchedRows={matchedRows}
        selectedRows={selectedRows}
        hoveredRows={hoveredRows}
        onRowHover={onRowHover}
        onRowLeave={onRowLeave}
        onRowClick={onRowClick ? (row) => onRowClick(row, (row as { id?: string | number }).id ?? '') : undefined}
        rowSx={rowSx}
      />
    </Stack>
  );
};

export const MapGeneratedDataContent: React.FC<{ nodeId: NodeId }> = ({ nodeId }) => {
  const theme = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [shapePage, setShapePage] = useState(0);
  const [routePage, setRoutePage] = useState(0);
  const [shapeRowsPerPage, setShapeRowsPerPage] = useState(1000);
  const [routeRowsPerPage, setRouteRowsPerPage] = useState(1000);
  const nodeKey = String(nodeId);
  const viewportFeatureIds = useAtomValue(mapViewportFeatureIdsAtom);
  const mapLayerInfo = useAtomValue(mapLayerInfoAtom);
  const searchMatches = useAtomValue(mapSearchMatchesAtom);
  const hoverMatch = useAtomValue(mapHoverMatchAtom);
  const selectedMatch = useAtomValue(mapSelectedMatchAtom);
  const setHoverMatch = useSetAtom(mapHoverMatchAtom);
  const setSelectedMatch = useSetAtom(mapSelectedMatchAtom);

  const layerInfoByType = useMemo(() => {
    const infoByType: Partial<Record<MapNodeType, MapLayerInfo>> = {};
    mapLayerInfo.forEach((info) => {
      if (info.nodeId === nodeKey) {
        infoByType[info.nodeType] = info;
      }
    });
    return infoByType;
  }, [mapLayerInfo, nodeKey]);

  const getViewportIds = useCallback(
    (nodeType: MapNodeType) => {
      if (!viewportFeatureIds) return null;
      if (!layerInfoByType[nodeType]) return null;
      const entry = viewportFeatureIds[nodeKey];
      if (!entry) return new Set<string | number>();
      return new Set(entry[nodeType] ?? []);
    },
    [layerInfoByType, nodeKey, viewportFeatureIds],
  );

  const shapeVisibleIds = useMemo(() => getViewportIds('shape'), [getViewportIds]);
  const locationVisibleIds = useMemo(() => getViewportIds('location'), [getViewportIds]);
  const routeVisibleIds = useMemo(() => getViewportIds('route'), [getViewportIds]);

  const buildEntryForRow = useCallback(
    (nodeType: MapNodeType, rowId: string | number): MapHighlightEntry | null => {
      const info = layerInfoByType[nodeType];
      if (!info) return null;
      return {
        source: info.sourceId,
        id: rowId,
        nodeId: info.nodeId,
        nodeType: info.nodeType,
        layerId: info.layerId,
      };
    },
    [layerInfoByType],
  );

  const getMatchedRows = useCallback(
    (nodeType: MapNodeType) => {
      const matches = searchMatches.filter(
        (entry) => entry.nodeId === nodeKey && entry.nodeType === nodeType,
      );
      return new Set(matches.map((entry) => entry.id));
    },
    [nodeKey, searchMatches],
  );

  const getHoveredRows = useCallback(
    (nodeType: MapNodeType) => {
      if (hoverMatch?.nodeId === nodeKey && hoverMatch?.nodeType === nodeType) {
        return new Set([hoverMatch.id]);
      }
      return new Set<string | number>();
    },
    [hoverMatch, nodeKey],
  );

  const getSelectedRows = useCallback(
    (nodeType: MapNodeType) => {
      if (selectedMatch?.nodeId === nodeKey && selectedMatch?.nodeType === nodeType) {
        return new Set([selectedMatch.id]);
      }
      return new Set<string | number>();
    },
    [nodeKey, selectedMatch],
  );

  const rowSx = useCallback<DataGridRowSx>(
    (state) => {
      const sx: Record<string, unknown> = {};
      if (state.matched) {
        sx.backgroundColor = 'rgba(255, 213, 79, 0.35)';
        sx['&:hover'] = { backgroundColor: 'rgba(255, 213, 79, 0.45)' };
      }
      const shadows: string[] = [];
      if (state.selected) {
        shadows.push(`inset 0 0 0 2px ${theme.palette.primary.main}`);
      }
      if (state.hovered) {
        shadows.push('0 0 0 2px rgba(255, 236, 179, 0.9), 0 0 12px rgba(255, 236, 179, 0.6)');
      }
      if (shadows.length > 0) {
        sx.boxShadow = shadows.join(', ');
      }
      return Object.keys(sx).length > 0 ? sx : undefined;
    },
    [theme.palette.primary.main],
  );

  const shapeState = useShapeTableData(nodeId, shapePage, shapeRowsPerPage, shapeVisibleIds);
  const locationState = useLocationTableData(nodeId, locationVisibleIds);
  const routeState = useRouteTableData(nodeId, routePage, routeRowsPerPage, routeVisibleIds);

  useEffect(() => {
    setShapePage(0);
    setRoutePage(0);
  }, [nodeId, shapeVisibleIds, routeVisibleIds]);

  return (
    <Stack spacing={2}>
      <Tabs value={tabIndex} onChange={(_, next) => setTabIndex(next)} variant="scrollable">
        <Tab label="Shape" />
        <Tab label="Location" />
        <Tab label="Route" />
      </Tabs>
      {tabIndex === 0 && (
        <DataGridPanel
          state={shapeState}
          matchedRows={getMatchedRows('shape')}
          selectedRows={getSelectedRows('shape')}
          hoveredRows={getHoveredRows('shape')}
          onRowHover={(_, rowId) => {
            const entry = buildEntryForRow('shape', rowId);
            if (entry) setHoverMatch(entry);
          }}
          onRowLeave={(_, rowId) => {
            if (hoverMatch?.nodeId === nodeKey && hoverMatch?.nodeType === 'shape' && hoverMatch.id === rowId) {
              setHoverMatch(null);
            }
          }}
          onRowClick={(_, rowId) => {
            const entry = buildEntryForRow('shape', rowId);
            if (!entry) return;
            if (selectedMatch?.nodeId === nodeKey && selectedMatch?.nodeType === 'shape' && selectedMatch.id === rowId) {
              setSelectedMatch(null);
              return;
            }
            setSelectedMatch(entry);
          }}
          rowSx={rowSx}
          pagination={{
            enabled: true,
            page: shapePage,
            rowsPerPage: shapeRowsPerPage,
            rowsPerPageOptions: [1000],
            onPageChange: (next) => setShapePage(next),
            onRowsPerPageChange: (next) => {
              setShapeRowsPerPage(next);
              setShapePage(0);
            },
          }}
        />
      )}
      {tabIndex === 1 && (
        <DataGridPanel
          state={locationState}
          matchedRows={getMatchedRows('location')}
          selectedRows={getSelectedRows('location')}
          hoveredRows={getHoveredRows('location')}
          onRowHover={(_, rowId) => {
            const entry = buildEntryForRow('location', rowId);
            if (entry) setHoverMatch(entry);
          }}
          onRowLeave={(_, rowId) => {
            if (hoverMatch?.nodeId === nodeKey && hoverMatch?.nodeType === 'location' && hoverMatch.id === rowId) {
              setHoverMatch(null);
            }
          }}
          onRowClick={(_, rowId) => {
            const entry = buildEntryForRow('location', rowId);
            if (!entry) return;
            if (selectedMatch?.nodeId === nodeKey && selectedMatch?.nodeType === 'location' && selectedMatch.id === rowId) {
              setSelectedMatch(null);
              return;
            }
            setSelectedMatch(entry);
          }}
          rowSx={rowSx}
        />
      )}
      {tabIndex === 2 && (
        <DataGridPanel
          state={routeState}
          matchedRows={getMatchedRows('route')}
          selectedRows={getSelectedRows('route')}
          hoveredRows={getHoveredRows('route')}
          onRowHover={(_, rowId) => {
            const entry = buildEntryForRow('route', rowId);
            if (entry) setHoverMatch(entry);
          }}
          onRowLeave={(_, rowId) => {
            if (hoverMatch?.nodeId === nodeKey && hoverMatch?.nodeType === 'route' && hoverMatch.id === rowId) {
              setHoverMatch(null);
            }
          }}
          onRowClick={(_, rowId) => {
            const entry = buildEntryForRow('route', rowId);
            if (!entry) return;
            if (selectedMatch?.nodeId === nodeKey && selectedMatch?.nodeType === 'route' && selectedMatch.id === rowId) {
              setSelectedMatch(null);
              return;
            }
            setSelectedMatch(entry);
          }}
          rowSx={rowSx}
          pagination={{
            enabled: true,
            page: routePage,
            rowsPerPage: routeRowsPerPage,
            rowsPerPageOptions: [1000],
            onPageChange: (next) => setRoutePage(next),
            onRowsPerPageChange: (next) => {
              setRouteRowsPerPage(next);
              setRoutePage(0);
            },
          }}
        />
      )}
    </Stack>
  );
};
