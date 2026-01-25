/**
 * @file modelessDialogContent.tsx
 * @description Content blocks for modeless map dialog windows.
 */

import type { NodeId } from '@hierarchidb/common-types';
import { getLocationDB } from '@hierarchidb/location-store';
import type {
  ShapeFeatureMetadata,
  ShapeFeatureRecord,
  ShapeTransformErrorRecord,
} from '@hierarchidb/plugin-service-api';
import { RouteDB, type RouteLineString } from '@hierarchidb/route-store';
import { TabularDatabaseManager, TabularQueryService } from '@hierarchidb/tabular-store';
import { GenericDataGrid, type GenericDataGridProps, type GridColumn } from '@hierarchidb/ui-grid';
import type {
  LayerSetDefinition,
  LayerSetId,
  LayerSetListItem,
  LayerSetVisibility,
  ResourceGeoJsonLayer,
  ResourceVectorLayer,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  LayerSetVisibilityPanel,
  MapPreviewFloatingTable,
  buildErrorSummaryById,
  useVectorTilePreviewMetadata,
  useVectorTilePreviewSearch,
  type MapHighlightEntry,
  type MapPreviewErrorSummaryById,
  type ShapePreviewFeatureRow,
  mapHoverMatchesAtom,
  mapSearchMatchesAtom,
  mapSelectedMatchesAtom,
  mapViewportFeatureIdsAtom,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { getDBName } from '@hierarchidb/util';
import {
  Alert,
  Box,
  Checkbox,
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
import { useAtomValue, useSetAtom } from 'jotai';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapFeatureIdSet, MapLayerInfo, MapNodeType } from '../../../state/mapSearch.atoms.js';
import { mapLayerInfoAtom } from '../../../state/mapSearch.atoms.js';
import type { MapStylerSummary } from '../map/types.js';

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
type DataGridRowSx = NonNullable<GenericDataGridProps<DataGridRow>['rowSx']>;

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

const isMapNodeType = (value?: string): value is MapNodeType =>
  value === 'shape' || value === 'location' || value === 'route';

const buildColumns = (names: string[]): GridColumn[] =>
  names.map((name) => ({
    id: name,
    label: name,
    sortable: true,
  }));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const resolveGeometryType = (geometry: unknown): string => {
  if (!isRecord(geometry)) return '';
  const type = geometry.type;
  return typeof type === 'string' ? type : '';
};

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

const FLOATING_TABLE_CONTAINER_SX: Record<string, unknown> = {
  position: 'static',
  width: '100%',
  maxWidth: '100%',
  height: '100%',
  maxHeight: '100%',
  top: 'auto',
  right: 'auto',
  boxShadow: 'none',
};

const formatLogicalCode = (value: unknown) => {
  const text = String(value ?? '');
  if (text === 'N/A') {
    return <Typography color="error.main">N/A</Typography>;
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

const useShapeTableData = (
  nodeId: NodeId | null,
  page: number,
  rowsPerPage: number,
  visibleIds?: Set<string | number> | null
): DataGridState => {
  const [state, setState] = useState<DataGridState>({
    rows: [],
    columns: buildColumns([
      'id',
      'name',
      'countryCode',
      'adminLevel',
      'area',
      'population',
      'geometryType',
    ]),
    loading: false,
  });

  const bridgeRef = useRef(getWorkerBridge());

  useEffect(() => {
    if (!nodeId) return;
    let cancelled = false;
    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: undefined }));
      try {
        await bridgeRef.current.initialize();
        const query = await bridgeRef.current.getShapeQueryAPI();
        const collection = await query.listFeatures(nodeId);
        const filterByViewport = visibleIds !== undefined && visibleIds !== null;
        const visibleIdSet = filterByViewport ? new Set(visibleIds ?? []) : null;
        let totalRows = 0;
        let items: ShapeFeatureRecord[] = [];
        if (filterByViewport) {
          if (!visibleIdSet || visibleIdSet.size === 0) {
            totalRows = 0;
            items = [];
          } else {
            const filtered = collection.filter((feature) => visibleIdSet.has(feature.id));
            totalRows = filtered.length;
            items = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
          }
        } else {
          totalRows = collection.length;
          items = collection.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
        }
        const rows = items.map((feature: ShapeFeatureRecord) => ({
          id: feature.id,
          name: feature.name ?? '',
          countryCode: feature.countryCode ?? '',
          adminLevel: feature.adminLevel ?? '',
          area: feature.area ?? '',
          population: feature.population ?? '',
          geometryType: resolveGeometryType(feature.geometry),
        }));
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            rows,
            loading: false,
            totalRows,
            emptyMessage: filterByViewport
              ? 'No visible features in the current map view.'
              : undefined,
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
  visibleIds?: Set<string | number> | null
): DataGridState => {
  const routeDb = useMemo(() => new RouteDB(), []);
  const [state, setState] = useState<DataGridState>({
    rows: [],
    columns: buildColumns([
      'id',
      'name',
      'routeMode',
      'startName',
      'endName',
      'distance',
      'speed',
      'featureId',
    ]),
    loading: false,
  });

  useEffect(() => {
    if (!nodeId) return;
    let cancelled = false;
    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: undefined }));
      try {
        const collection = routeDb.features.where('nodeId').equals(nodeId);
        const filterByViewport = visibleIds !== undefined && visibleIds !== null;
        const visibleIdSet = filterByViewport ? new Set(visibleIds ?? []) : null;
        let totalRows = 0;
        let items: RouteLineString[] = [];
        if (filterByViewport) {
          if (!visibleIdSet || visibleIdSet.size === 0) {
            totalRows = 0;
            items = [];
          } else {
            const filtered = await collection.and((line) => visibleIdSet.has(line.id)).toArray();
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
            emptyMessage: filterByViewport
              ? 'No visible features in the current map view.'
              : undefined,
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
  visibleIds?: Set<string | number> | null
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
        const db = getLocationDB();
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
        const manager = new TabularDatabaseManager(getDBName('location-metadata'));
        const metadata = await manager.get(tableId);
        const columnNames = extractColumnNames(metadata?.columns);
        const svc = new TabularQueryService('location');
        const rows = await svc.query(tableId, [], MAX_ROWS + 1);
        const filterByViewport = visibleIds !== undefined && visibleIds !== null;
        const visibleIdSet = filterByViewport ? new Set(visibleIds ?? []) : null;
        const filteredRows = filterByViewport
          ? rows.filter((row) => visibleIdSet?.has((row as { id?: string | number }).id ?? ''))
          : rows;
        const truncated = filteredRows.length > MAX_ROWS;
        const trimmedRows = filteredRows.slice(0, MAX_ROWS) as DataGridRow[];
        const derivedColumns =
          columnNames.length > 0 ? columnNames : Object.keys(trimmedRows[0] ?? {});
        if (!cancelled) {
          setState({
            rows: trimmedRows,
            columns: buildColumns(derivedColumns),
            loading: false,
            truncated,
            totalRows: filterByViewport ? filteredRows.length : metadata?.totalRows,
            emptyMessage: filterByViewport
              ? 'No visible features in the current map view.'
              : undefined,
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

const useMapHighlightSelection = (nodeId: NodeId | null) => {
  const mapLayerInfo = useAtomValue(mapLayerInfoAtom);
  const selectedMatches = useAtomValue(mapSelectedMatchesAtom);
  const setSelectedMatches = useSetAtom(mapSelectedMatchesAtom);
  const nodeKey = nodeId ? String(nodeId) : null;

  const layerInfoByType = useMemo(() => {
    const infoByType: Partial<Record<MapNodeType, MapLayerInfo>> = {};
    if (!nodeKey) return infoByType;
    mapLayerInfo.forEach((info) => {
      if (info.nodeId === nodeKey) {
        infoByType[info.nodeType] = info;
      }
    });
    return infoByType;
  }, [mapLayerInfo, nodeKey]);

  const layerInfoById = useMemo(() => {
    const map = new Map<string, MapLayerInfo>();
    mapLayerInfo.forEach((info) => {
      map.set(info.layerId, info);
    });
    return map;
  }, [mapLayerInfo]);

  const layerInfoBySource = useMemo(() => {
    const map = new Map<string, MapLayerInfo>();
    mapLayerInfo.forEach((info) => {
      map.set(info.sourceId, info);
    });
    return map;
  }, [mapLayerInfo]);

  const resolveEntryLayerInfo = useCallback(
    (entry: MapHighlightEntry) => {
      if (entry.nodeId && isMapNodeType(entry.nodeType)) {
        return { nodeId: entry.nodeId, nodeType: entry.nodeType };
      }
      if (entry.layerId && layerInfoById.has(entry.layerId)) {
        const info = layerInfoById.get(entry.layerId);
        if (info) return { nodeId: info.nodeId, nodeType: info.nodeType };
      }
      if (layerInfoBySource.has(entry.source)) {
        const info = layerInfoBySource.get(entry.source);
        if (info) return { nodeId: info.nodeId, nodeType: info.nodeType };
      }
      return null;
    },
    [layerInfoById, layerInfoBySource]
  );

  const entriesToIdSet = useCallback(
    (entries: MapHighlightEntry[]): MapFeatureIdSet => {
      const next: MapFeatureIdSet = {};
      entries.forEach((entry) => {
        const info = resolveEntryLayerInfo(entry);
        if (!info) return;
        if (!next[info.nodeId]) next[info.nodeId] = {};
        const current = next[info.nodeId]?.[info.nodeType] ?? new Set<string | number>();
        current.add(entry.id);
        if (next[info.nodeId]) {
          next[info.nodeId] = {};
        }
        next[info.nodeId] = {
          ...next[info.nodeId],
          [info.nodeType]: current,
        };
      });
      return next;
    },
    [resolveEntryLayerInfo]
  );

  const selectedMatchIdSet = useMemo(
    () => entriesToIdSet(selectedMatches),
    [entriesToIdSet, selectedMatches]
  );

  const getSelectedRows = useCallback(
    (nodeType: MapNodeType) => {
      if (!nodeKey) return new Set<string | number>();
      const entry = selectedMatchIdSet[nodeKey];
      if (!entry) return new Set<string | number>();
      const ids = entry[nodeType];
      return ids ? new Set(ids) : new Set<string | number>();
    },
    [nodeKey, selectedMatchIdSet]
  );

  const buildEntryForRow = useCallback(
    (nodeType: MapNodeType, rowId?: string | number): MapHighlightEntry | null => {
      if (!rowId) return null;
      const info = layerInfoByType[nodeType];
      if (!info) return null;
      return {
        source: info.sourceId,
        id: rowId,
        layerId: info.layerId,
        nodeId: info.nodeId,
        nodeType: info.nodeType,
      };
    },
    [layerInfoByType]
  );

  const setSelectedRows = useCallback(
    (nodeType: MapNodeType, next: Set<string | number>) => {
      const entries = Array.from(next)
        .map((rowId) => buildEntryForRow(nodeType, rowId))
        .filter((entry): entry is MapHighlightEntry => Boolean(entry));
      setSelectedMatches(entries);
    },
    [buildEntryForRow, setSelectedMatches]
  );

  return { getSelectedRows, setSelectedRows };
};

const areSetsEqual = <T,>(left?: Set<T> | null, right?: Set<T> | null) => {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
};

const useViewportIdSet = (nodeId: NodeId | null) => {
  const mapLayerInfo = useAtomValue(mapLayerInfoAtom);
  const viewportFeatureIds = useAtomValue(mapViewportFeatureIdsAtom);
  const nodeKey = nodeId ? String(nodeId) : null;
  const stableViewportIdSetRef = useRef<MapFeatureIdSet | null>(null);
  const emptySetRef = useRef(new Set<string | number>());

  const layerInfoById = useMemo(() => {
    const map = new Map<string, MapLayerInfo>();
    mapLayerInfo.forEach((info) => {
      map.set(info.layerId, info);
    });
    return map;
  }, [mapLayerInfo]);

  const layerTypesForNode = useMemo(() => {
    const types: Partial<Record<MapNodeType, boolean>> = {};
    if (!nodeKey) return types;
    mapLayerInfo.forEach((info) => {
      if (info.nodeId === nodeKey) {
        types[info.nodeType] = true;
      }
    });
    return types;
  }, [mapLayerInfo, nodeKey]);

  const viewportIdSet = useMemo<MapFeatureIdSet | null>(() => {
    if (!viewportFeatureIds || !nodeKey) return null;
    const prev = stableViewportIdSetRef.current;
    const next: MapFeatureIdSet = {};
    viewportFeatureIds.forEach((ids, layerId) => {
      const info = layerInfoById.get(layerId);
      if (!info || info.nodeId !== nodeKey) return;
      if (!next[info.nodeId]) {
        next[info.nodeId] = {};
      }
      const prevSet = prev?.[info.nodeId]?.[info.nodeType];
      const stableSet = prevSet && areSetsEqual(prevSet, ids) ? prevSet : new Set(ids);
      next[info.nodeId] = {
        ...next[info.nodeId],
        [info.nodeType]: stableSet,
      };
    });
    stableViewportIdSetRef.current = next;
    return next;
  }, [layerInfoById, nodeKey, viewportFeatureIds]);

  const getViewportIds = useCallback(
    (nodeType: MapNodeType) => {
      if (!nodeKey) return null;
      if (!viewportIdSet) {
        return layerTypesForNode[nodeType] ? emptySetRef.current : null;
      }
      const entry = viewportIdSet[nodeKey];
      if (!entry) return emptySetRef.current;
      const ids = entry[nodeType];
      return ids ?? emptySetRef.current;
    },
    [layerTypesForNode, nodeKey, viewportIdSet]
  );

  return { getViewportIds };
};

export const MapInfoContent: React.FC<{ formattedZxy: string; info: MapInfoSummary }> = ({
  formattedZxy,
  info,
}) => (
  <Stack spacing={1}>
    <Box>
      <Typography variant="overline" color="text.secondary">
        Name
      </Typography>
      <Typography variant="body2">{formatText(info.name)}</Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">
        Description
      </Typography>
      <Typography variant="body2">{formatText(info.description)}</Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">
        Created At
      </Typography>
      <Typography variant="body2">{formatTimestamp(info.createdAt)}</Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">
        Updated At
      </Typography>
      <Typography variant="body2">{formatTimestamp(info.updatedAt)}</Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">
        Tags
      </Typography>
      <Typography variant="body2">
        {info.tags && info.tags.length > 0 ? info.tags.join(', ') : '—'}
      </Typography>
    </Box>
    <Box>
      <Typography variant="overline" color="text.secondary">
        Path
      </Typography>
      <Typography variant="body2">{formatText(info.path)}</Typography>
    </Box>
    <Divider />
    <Stack spacing={0.5}>
      <Typography variant="body2">
        URL Format: <code>?zxy=zoom,lng,lat</code>
      </Typography>
      <Typography variant="body2">
        Current: <code>?zxy={formattedZxy}</code>
      </Typography>
    </Stack>
  </Stack>
);

export const MapLayerContent: React.FC<{
  basemapStyles: Array<{ nodeId: string; absolutePath?: string }>;
  vectorLayers: ResourceVectorLayer[];
  geoJsonLayers: ResourceGeoJsonLayer[];
  layerSets: LayerSetDefinition[];
  layerSetVisibility: LayerSetVisibility;
  onToggleLayerSet: (id: LayerSetId) => void;
}> = ({ basemapStyles, vectorLayers, geoJsonLayers, layerSets, layerSetVisibility, onToggleLayerSet }) => (
  <Stack spacing={2}>
    <Box>
      <LayerSetVisibilityPanel
        title="Layer Sets"
        layerSets={layerSets}
        visibility={layerSetVisibility}
        onToggle={onToggleLayerSet}
        items={buildLayerSetItemsFromLayers(vectorLayers, geoJsonLayers)}
      />
    </Box>
    <Divider />
    <Box>
      <Typography variant="subtitle2">Basemaps</Typography>
      {basemapStyles.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No basemap styles.
        </Typography>
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
        <Typography variant="body2" color="text.secondary">
          No vector layers.
        </Typography>
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
        <Typography variant="body2" color="text.secondary">
          No GeoJSON layers.
        </Typography>
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

type StylerRow = {
  id: string;
  enabled: boolean;
  path: string;
  description: string;
  dataSource: string;
  filter: string;
  featureIdProperty: string;
  valueType: string;
  colorChart: string;
  scalarChart: string;
};

const formatStops = (items: Array<{ key: string; value: string }>, max = 4) => {
  if (items.length === 0) return '—';
  const trimmed = items.slice(0, max).map((item) => `${item.key}:${item.value}`);
  return items.length > max ? `${trimmed.join(', ')} ...` : trimmed.join(', ');
};

const formatHierarchyLabel = (value?: number): string | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return `ADM${value}`;
};

const buildLayerSetItemsFromLayers = (
  vectorLayers: ResourceVectorLayer[],
  geoJsonLayers: ResourceGeoJsonLayer[],
): LayerSetListItem[] => {
  const items: LayerSetListItem[] = [];
  vectorLayers.forEach((layer) => {
    if (!layer.layerSetId) return;
    const label = layer.layerLabel ?? layer.absolutePath ?? layer.nodeId;
    const detail = layer.layerConfig?.sourceLayer ?? layer.layerConfig?.layerType ?? layer.nodeType;
    items.push({
      id: `vector-${layer.nodeId}-${layer.layerConfig?.layerId ?? ''}`,
      label,
      layerSetId: layer.layerSetId as LayerSetId,
      hierarchyLabel: formatHierarchyLabel(layer.hierarchyLevel),
      detail: typeof detail === 'string' ? detail : undefined,
    });
  });
  geoJsonLayers.forEach((layer) => {
    if (!layer.layerSetId) return;
    const label = layer.layerLabel ?? layer.absolutePath ?? layer.layerId;
    items.push({
      id: `geojson-${layer.layerId}`,
      label,
      layerSetId: layer.layerSetId as LayerSetId,
      hierarchyLabel: formatHierarchyLabel(layer.hierarchyLevel),
      detail: layer.layerType,
    });
  });
  return items;
};

const styleTypeToDataSource = (styleType?: MapStylerSummary['styleType']) => {
  if (styleType === 'points') return 'location';
  if (styleType === 'lines') return 'route';
  if (styleType === 'choropleth') return 'shape';
  return '—';
};

export const MapStylerContent: React.FC<{
  stylerSummaries: MapStylerSummary[];
  stylerToggles: Record<string, boolean>;
  onToggleStyler: (stylerId: string, enabled: boolean) => void;
}> = ({ stylerSummaries, stylerToggles, onToggleStyler }) => {
  const rows: StylerRow[] = stylerSummaries.map((entry) => {
    const enabled = stylerToggles[entry.nodeId] ?? entry.enabled;
    const colorChart = formatStops(
      (entry.colorStops ?? []).map((item) => ({ key: item.key, value: item.color }))
    );
    const scalarChart = formatStops(
      (entry.scalarStops ?? []).map((item) => ({ key: item.key, value: String(item.scalarValue) }))
    );
    return {
      id: entry.nodeId,
      enabled,
      path: entry.absolutePath ?? entry.nodeId,
      description: entry.description ?? '—',
      dataSource: styleTypeToDataSource(entry.styleType),
      filter: entry.targetProperty ?? '—',
      featureIdProperty: entry.featureIdProperty ?? '—',
      valueType: entry.valueType ?? '—',
      colorChart,
      scalarChart,
    };
  });

  const columns: GridColumn<StylerRow>[] = [
    {
      id: 'enabled',
      label: 'On',
      width: 70,
      align: 'center',
      sortable: false,
      format: (_value, row) => (
        <Checkbox
          checked={row.enabled}
          size="small"
          inputProps={{ 'aria-label': `Toggle style ${row.id}` }}
        />
      ),
    },
    { id: 'path', label: 'Path', width: 220, sortable: true },
    { id: 'description', label: 'Description', width: 200, sortable: false },
    { id: 'dataSource', label: 'Data Source', width: 140, sortable: false },
    { id: 'filter', label: 'Filter', width: 160, sortable: false },
    { id: 'featureIdProperty', label: 'Feature ID', width: 160, sortable: false },
    { id: 'valueType', label: 'Value Type', width: 120, sortable: false },
    { id: 'colorChart', label: 'Color Chart', width: 220, sortable: false },
    { id: 'scalarChart', label: 'Scalar Chart', width: 220, sortable: false },
  ];

  if (rows.length === 0) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="text.secondary">
          No styler entries.
        </Typography>
      </Box>
    );
  }

  return (
    <GenericDataGrid
      columns={columns}
      rows={rows}
      maxHeight={360}
      enableVirtualization
      onCellClick={({ row, columnId }) => {
        if (columnId !== 'enabled') return;
        const next = !row.enabled;
        onToggleStyler(row.id, next);
      }}
      getRowId={(row) => row.id}
    />
  );
};

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
  const shouldPaginate = Boolean(pagination?.enabled && totalCount > pagination.rowsPerPage);
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
        page={shouldPaginate ? (pagination?.page ?? 0) : 0}
        rowsPerPage={pagination?.rowsPerPage ?? 100}
        rowsPerPageOptions={pagination?.rowsPerPageOptions ?? [100]}
        onPageChange={shouldPaginate ? pagination?.onPageChange : undefined}
        onRowsPerPageChange={shouldPaginate ? pagination?.onRowsPerPageChange : undefined}
        matchedRows={matchedRows}
        selectedRows={selectedRows}
        hoveredRows={hoveredRows}
        onRowHover={onRowHover}
        onRowLeave={onRowLeave}
        onRowClick={
          onRowClick
            ? (row) => onRowClick(row, (row as { id?: string | number }).id ?? '')
            : undefined
        }
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
  const hoverMatches = useAtomValue(mapHoverMatchesAtom);
  const selectedMatches = useAtomValue(mapSelectedMatchesAtom);
  const setHoverMatches = useSetAtom(mapHoverMatchesAtom);
  const setSelectedMatches = useSetAtom(mapSelectedMatchesAtom);

  const layerInfoByType = useMemo(() => {
    const infoByType: Partial<Record<MapNodeType, MapLayerInfo>> = {};
    mapLayerInfo.forEach((info) => {
      if (info.nodeId === nodeKey) {
        infoByType[info.nodeType] = info;
      }
    });
    return infoByType;
  }, [mapLayerInfo, nodeKey]);

  const layerInfoById = useMemo(() => {
    const map = new Map<string, MapLayerInfo>();
    mapLayerInfo.forEach((info) => {
      map.set(info.layerId, info);
    });
    return map;
  }, [mapLayerInfo]);

  const layerInfoBySource = useMemo(() => {
    const map = new Map<string, MapLayerInfo>();
    mapLayerInfo.forEach((info) => {
      map.set(info.sourceId, info);
    });
    return map;
  }, [mapLayerInfo]);

  const resolveEntryLayerInfo = useCallback(
    (entry: MapHighlightEntry) => {
      if (entry.nodeId && isMapNodeType(entry.nodeType)) {
        return { nodeId: entry.nodeId, nodeType: entry.nodeType };
      }
      if (entry.layerId && layerInfoById.has(entry.layerId)) {
        const info = layerInfoById.get(entry.layerId);
        if (info) return { nodeId: info.nodeId, nodeType: info.nodeType };
      }
      if (layerInfoBySource.has(entry.source)) {
        const info = layerInfoBySource.get(entry.source);
        if (info) return { nodeId: info.nodeId, nodeType: info.nodeType };
      }
      return null;
    },
    [layerInfoById, layerInfoBySource]
  );

  const entriesToIdSet = useCallback(
    (entries: MapHighlightEntry[]): MapFeatureIdSet => {
      const next: MapFeatureIdSet = {};
      entries.forEach((entry) => {
        const info = resolveEntryLayerInfo(entry);
        if (!info) return;
        if (!next[info.nodeId]) next[info.nodeId] = {};
        const current = next[info.nodeId]?.[info.nodeType] ?? new Set<string | number>();
        current.add(entry.id);
        if (next[info.nodeId]) {
          next[info.nodeId] = {};
        }
        next[info.nodeId] = {
          ...next[info.nodeId],
          [info.nodeType]: current,
        };
      });
      return next;
    },
    [resolveEntryLayerInfo]
  );

  const searchMatchIdSet = useMemo(
    () => entriesToIdSet(searchMatches),
    [entriesToIdSet, searchMatches]
  );
  const hoverMatchIdSet = useMemo(
    () => entriesToIdSet(hoverMatches),
    [entriesToIdSet, hoverMatches]
  );
  const selectedMatchIdSet = useMemo(
    () => entriesToIdSet(selectedMatches),
    [entriesToIdSet, selectedMatches]
  );

  const viewportIdSet = useMemo<MapFeatureIdSet | null>(() => {
    if (!viewportFeatureIds) return null;
    const next: MapFeatureIdSet = {};
    viewportFeatureIds.forEach((ids, layerId) => {
      const info = layerInfoById.get(layerId);
      if (!info) return;
      if (!next[info.nodeId]) {
        next[info.nodeId] = {};
      }
      next[info.nodeId] = {
        ...next[info.nodeId],
        [info.nodeType]: new Set(ids),
      };
    });
    return next;
  }, [layerInfoById, viewportFeatureIds]);

  const getViewportIds = useCallback(
    (nodeType: MapNodeType) => {
      if (!viewportIdSet) return null;
      if (!layerInfoByType[nodeType]) return null;
      const entry = viewportIdSet[nodeKey];
      if (!entry) return new Set<string | number>();
      const ids = entry[nodeType];
      return ids ? new Set(ids) : new Set<string | number>();
    },
    [layerInfoByType, nodeKey, viewportIdSet]
  );

  const shapeVisibleIds = useMemo(() => getViewportIds('shape'), [getViewportIds]);
  const locationVisibleIds = useMemo(() => getViewportIds('location'), [getViewportIds]);
  const routeVisibleIds = useMemo(() => getViewportIds('route'), [getViewportIds]);

  const getMatchedRows = useCallback(
    (nodeType: MapNodeType) => {
      const entry = searchMatchIdSet[nodeKey];
      if (!entry) return new Set<string | number>();
      const ids = entry[nodeType];
      return ids ? new Set(ids) : new Set<string | number>();
    },
    [nodeKey, searchMatchIdSet]
  );

  const getHoveredRows = useCallback(
    (nodeType: MapNodeType) => {
      const entry = hoverMatchIdSet[nodeKey];
      if (!entry) return new Set<string | number>();
      const ids = entry[nodeType];
      return ids ? new Set(ids) : new Set<string | number>();
    },
    [hoverMatchIdSet, nodeKey]
  );

  const getSelectedRows = useCallback(
    (nodeType: MapNodeType) => {
      const entry = selectedMatchIdSet[nodeKey];
      if (!entry) return new Set<string | number>();
      const ids = entry[nodeType];
      return ids ? new Set(ids) : new Set<string | number>();
    },
    [nodeKey, selectedMatchIdSet]
  );

  const buildEntryForRow = useCallback(
    (nodeType: MapNodeType, rowId?: string | number): MapHighlightEntry | null => {
      if (!rowId) return null;
      const info = layerInfoByType[nodeType];
      if (!info) return null;
      return {
        source: info.sourceId,
        id: rowId,
        layerId: info.layerId,
        nodeId: info.nodeId,
        nodeType: info.nodeType,
      };
    },
    [layerInfoByType]
  );

  const updateEntrySelection = useCallback(
    (
      prev: MapHighlightEntry[],
      mode: 'replace' | 'toggle' | 'clear',
      entry: MapHighlightEntry | null
    ): MapHighlightEntry[] => {
      if (mode === 'clear') return [];
      if (!entry) return prev;
      const next = new Map(prev.map((item) => [`${item.source}:${item.id}`, item]));
      const key = `${entry.source}:${entry.id}`;
      if (mode === 'replace') {
        return [entry];
      }
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, entry);
      }
      return Array.from(next.values());
    },
    []
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
    [theme.palette.primary.main]
  );

  const stableShapeVisibleIds = useMemo(
    () => (shapeVisibleIds ? new Set(shapeVisibleIds) : shapeVisibleIds),
    [shapeVisibleIds]
  );
  const shapeState = useShapeTableData(nodeId, shapePage, shapeRowsPerPage, stableShapeVisibleIds);
  const stableLocationVisibleIds = useMemo(
    () => (locationVisibleIds ? new Set(locationVisibleIds) : locationVisibleIds),
    [locationVisibleIds]
  );
  const locationState = useLocationTableData(nodeId, stableLocationVisibleIds);
  const stableRouteVisibleIds = useMemo(
    () => (routeVisibleIds ? new Set(routeVisibleIds) : routeVisibleIds),
    [routeVisibleIds]
  );
  const routeState = useRouteTableData(nodeId, routePage, routeRowsPerPage, stableRouteVisibleIds);

  useEffect(() => {
    setShapePage(0);
    setRoutePage(0);
  }, []);

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
            setHoverMatches(entry ? [entry] : []);
          }}
          onRowLeave={(_, _rowId) => {
            setHoverMatches([]);
          }}
          onRowClick={(_, rowId) => {
            const entry = buildEntryForRow('shape', rowId);
            setSelectedMatches((prev) => updateEntrySelection(prev, 'toggle', entry));
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
            setHoverMatches(entry ? [entry] : []);
          }}
          onRowLeave={(_, _rowId) => {
            setHoverMatches([]);
          }}
          onRowClick={(_, rowId) => {
            const entry = buildEntryForRow('location', rowId);
            setSelectedMatches((prev) => updateEntrySelection(prev, 'toggle', entry));
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
            setHoverMatches(entry ? [entry] : []);
          }}
          onRowLeave={(_, _rowId) => {
            setHoverMatches([]);
          }}
          onRowClick={(_, rowId) => {
            const entry = buildEntryForRow('route', rowId);
            setSelectedMatches((prev) => updateEntrySelection(prev, 'toggle', entry));
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

type ShapeListState = {
  rows: ShapePreviewFeatureRow[];
  loading: boolean;
  loaded: boolean;
  error?: string;
  searchKeyword: string;
  setSearchKeyword: (value: string) => void;
  matchedIds: Set<string>;
  errorSummaryById: MapPreviewErrorSummaryById;
};

const useShapeListState = (nodeId: NodeId | null): ShapeListState => {
  const mapLayerInfo = useAtomValue(mapLayerInfoAtom);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [matchedFeatureIds, setMatchedFeatureIds] = useState<string[]>([]);
  const bridgeRef = useRef(getWorkerBridge());
  const shapeNodeIds = useMemo(
    () => Array.from(new Set(
      mapLayerInfo
        .filter((info) => info.nodeType === 'shape')
        .map((info) => String(info.nodeId))
    )),
    [mapLayerInfo],
  );
  const metadataEnabled = shapeNodeIds.length > 0;
  const metadataKey = metadataEnabled ? shapeNodeIds.join('|') : null;

  const loadFeatureMetadataRows = useCallback(async (_targetNodeId: NodeId) => {
    await bridgeRef.current.initialize();
    const query = await bridgeRef.current.getShapeQueryAPI();
    const entries = await Promise.all(
      shapeNodeIds.map((shapeNodeId) => query.listFeatureMetadata(shapeNodeId as NodeId))
    );
    return entries.flat() as ShapeFeatureMetadata[];
  }, [shapeNodeIds]);

  const loadTransformErrorRows = useCallback(async (_targetNodeId: NodeId) => {
    await bridgeRef.current.initialize();
    const query = await bridgeRef.current.getShapeQueryAPI();
    const entries = await Promise.all(
      shapeNodeIds.map((shapeNodeId) => query.listTransformErrorRecords(shapeNodeId as NodeId))
    );
    return entries.flat() as ShapeTransformErrorRecord[];
  }, [shapeNodeIds]);

  const {
    metadataRows: featureMetadataRows,
    metadataLoading: featureMetadataLoading,
    metadataError: featureMetadataError,
    metadataLoaded: featureMetadataLoaded,
  } = useVectorTilePreviewMetadata(
    metadataEnabled,
    metadataKey ? (metadataKey as NodeId) : null,
    loadFeatureMetadataRows,
  );

  const {
    metadataRows: transformErrorRows,
    metadataLoading: transformErrorLoading,
    metadataError: transformErrorError,
    metadataLoaded: transformErrorLoaded,
  } = useVectorTilePreviewMetadata(
    metadataEnabled,
    metadataKey ? (metadataKey as NodeId) : null,
    loadTransformErrorRows,
  );

  const featureListRows = useMemo<ShapePreviewFeatureRow[]>(() => (
    featureMetadataRows.map((row) => ({
      id: row.id,
      featureId: row.featureId,
      countryName: row.countryName,
      countryCode: row.countryCode,
      adminName: row.adminName,
      adminLevel: row.adminLevel,
      adminCode: row.adminCode,
      dataSource: row.dataSource,
      createdAt: row.createdAt,
      vertexCount: row.vertexCount,
      polygonCount: row.polygonCount,
      bbox: row.bbox,
      area: row.area,
    }))
  ), [featureMetadataRows]);

  const getFeatureRowId = useCallback(
    (row: ShapePreviewFeatureRow) => String(row.featureId ?? row.id ?? ''),
    []
  );

  const buildFeatureSearchText = useCallback(
    (row: ShapePreviewFeatureRow) => (
      [
        row.featureId,
        row.countryName,
        row.countryCode,
        row.adminName,
        row.adminCode,
        row.adminLevel != null ? String(row.adminLevel) : undefined,
        row.dataSource,
      ]
        .filter(Boolean)
        .join(' ')
    ),
    []
  );

  useVectorTilePreviewSearch(
    metadataEnabled,
    featureListRows,
    searchKeyword,
    getFeatureRowId,
    buildFeatureSearchText,
    setMatchedFeatureIds
  );

  const matchedIds = useMemo(
    () => new Set(matchedFeatureIds),
    [matchedFeatureIds]
  );

  const errorSummaryById = useMemo<MapPreviewErrorSummaryById>(() => (
    buildErrorSummaryById(transformErrorRows, {
      getId: (row) => row.featureId ?? undefined,
      getMessage: (row) => row.message ?? undefined,
    })
  ), [transformErrorRows]);

  return {
    rows: featureListRows,
    loading: featureMetadataLoading || transformErrorLoading,
    loaded: featureMetadataLoaded && transformErrorLoaded,
    error: featureMetadataError ?? transformErrorError ?? undefined,
    searchKeyword,
    setSearchKeyword,
    matchedIds,
    errorSummaryById,
  };
};

const normalizeRowId = (row: DataGridRow, index: number): string | number => {
  const existing = (row as { id?: string | number }).id;
  if (existing !== undefined && existing !== null && String(existing).trim().length > 0) {
    return existing;
  }
  return `row-${index}`;
};

const buildSearchTextFromRow = (row: DataGridRow): string => (
  Object.values(row)
    .map((value) => String(value ?? ''))
    .join(' ')
);

export const MapShapeListContent: React.FC<{ nodeId: NodeId }> = ({ nodeId }) => {
  const theme = useTheme();
  const {
    rows,
    loading,
    loaded,
    error,
    searchKeyword,
    setSearchKeyword,
    matchedIds,
    errorSummaryById,
  } = useShapeListState(nodeId);
  const { getSelectedRows, setSelectedRows } = useMapHighlightSelection(nodeId);
  const [sortColumn, setSortColumn] = useState<string>('featureId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const tableRows = useMemo(() => {
    const normalizeCount = (value?: number) => (typeof value === 'number' ? value : '');
    const keyword = searchKeyword.trim().toLowerCase();
    const filtered = keyword
      ? rows.filter((row) => matchedIds.has(String(row.featureId ?? row.id)))
      : rows;
    const mapped = filtered.map((row) => ({
      id: row.featureId ?? row.id,
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
  }, [matchedIds, rows, searchKeyword, sortColumn, sortDirection]);

  const columns = useMemo<GridColumn<(typeof tableRows)[number]>[]>(() => ([
    { id: 'featureId', label: 'Feature ID', width: 220, sortable: true },
    { id: 'countryName', label: 'Country', width: 180, sortable: true },
    { id: 'countryCode', label: 'Country Code', width: 120, sortable: true },
    { id: 'adminName', label: 'Admin Name', width: 180, sortable: true },
    { id: 'adminLevel', label: 'Admin Level', width: 120, align: 'right', sortable: true },
    { id: 'adminCode', label: 'Admin Code', width: 120, sortable: true },
    { id: 'dataSource', label: 'Data Source', width: 140, sortable: true },
    { id: 'createdAt', label: 'Created At', width: 180, sortable: true },
    { id: 'vertexCount', label: 'Vertices', width: 120, align: 'right', sortable: true },
    { id: 'polygonCount', label: 'Polygons', width: 120, align: 'right', sortable: true },
    { id: 'bbox', label: 'Bounding Box', width: 220, sortable: true },
    { id: 'area', label: 'Area', width: 140, align: 'right', sortable: true, format: formatLogicalCode },
  ]), []);

  const resolvedCountText = useMemo(() => {
    const keyword = searchKeyword.trim();
    const count = tableRows.length;
    return keyword ? `${count} matched` : `${count} rows`;
  }, [searchKeyword, tableRows.length]);

  const emptyContent = !nodeId ? (
    <Alert severity="info" sx={{ m: 2 }}>
      Build the dataset to generate metadata.
    </Alert>
  ) : (
    <Alert
      severity="info"
      icon={!loaded ? <CircularProgress size={16} /> : undefined}
      sx={{ m: 2, alignItems: 'center' }}
    >
      {loaded ? 'No metadata entries have been generated yet.' : 'Loading metadata...'}
    </Alert>
  );

  return (
    <MapPreviewFloatingTable
      title={`shape一覧 (${resolvedCountText})`}
      showTitle
      rows={tableRows}
      columns={columns}
      search={{
        value: searchKeyword,
        onChange: setSearchKeyword,
        placeholder: 'Search metadata',
        ariaLabel: 'Search metadata',
      }}
      loading={loading}
      error={error}
      matchedRows={matchedIds}
      selectable
      selectionMode="multiple"
      selectedRows={new Set(Array.from(getSelectedRows('shape')).map(String))}
      onSelectionChange={(next) => setSelectedRows('shape', next)}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      onSort={(column, direction) => {
        setSortColumn(column);
        setSortDirection(direction);
      }}
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
      errorColumnLabels={{
        status: 'Status',
        errorCount: 'Errors',
        errorMessage: 'Error Message',
      }}
      statusLabels={{
        failed: 'Failed',
        completed: 'Completed',
      }}
      containerSx={FLOATING_TABLE_CONTAINER_SX}
    />
  );
};

export const MapLocationListContent: React.FC<{ nodeId: NodeId }> = ({ nodeId }) => {
  const { getSelectedRows, setSelectedRows } = useMapHighlightSelection(nodeId);
  const { getViewportIds } = useViewportIdSet(nodeId);
  const locationVisibleIds = useMemo(() => getViewportIds('location'), [getViewportIds]);
  const stableLocationVisibleIds = useMemo(
    () => (locationVisibleIds ? new Set(locationVisibleIds) : locationVisibleIds),
    [locationVisibleIds]
  );
  const locationState = useLocationTableData(nodeId, stableLocationVisibleIds);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [matchedRowIds, setMatchedRowIds] = useState<string[]>([]);

  const rowsWithId = useMemo(() => (
    locationState.rows.map((row, index) => ({
      id: normalizeRowId(row, index),
      ...row,
    }))
  ), [locationState.rows]);

  const getRowId = useCallback(
    (row: DataGridRow & { id: string | number }) => String(row.id),
    []
  );

  useVectorTilePreviewSearch(
    Boolean(nodeId),
    rowsWithId,
    searchKeyword,
    getRowId,
    buildSearchTextFromRow,
    setMatchedRowIds
  );

  const matchedIds = useMemo(
    () => new Set(matchedRowIds),
    [matchedRowIds]
  );

  const selectedRows = useMemo(
    () => new Set(Array.from(getSelectedRows('location')).map(String)),
    [getSelectedRows]
  );

  return (
    <MapPreviewFloatingTable
      title="location一覧"
      showTitle
      rows={rowsWithId}
      columns={locationState.columns as GridColumn<DataGridRow & { id: string | number }>[]}
      search={{
        value: searchKeyword,
        onChange: setSearchKeyword,
        placeholder: 'Search locations',
        ariaLabel: 'Search locations',
      }}
      countText={rowsWithId.length > 0 ? `${rowsWithId.length} rows` : undefined}
      loading={locationState.loading}
      error={locationState.error}
      matchedRows={matchedIds}
      selectable
      selectionMode="multiple"
      selectedRows={selectedRows}
      onSelectionChange={(next) => setSelectedRows('location', next)}
      emptyContent={renderEmptyState(locationState.emptyMessage)}
      containerSx={FLOATING_TABLE_CONTAINER_SX}
    />
  );
};

export const MapRouteListContent: React.FC<{ nodeId: NodeId }> = ({ nodeId }) => {
  const { getSelectedRows, setSelectedRows } = useMapHighlightSelection(nodeId);
  const { getViewportIds } = useViewportIdSet(nodeId);
  const routeVisibleIds = useMemo(() => getViewportIds('route'), [getViewportIds]);
  const stableRouteVisibleIds = useMemo(
    () => (routeVisibleIds ? new Set(routeVisibleIds) : routeVisibleIds),
    [routeVisibleIds]
  );
  const [page] = useState(0);
  const [rowsPerPage] = useState(1000);
  const routeState = useRouteTableData(nodeId, page, rowsPerPage, stableRouteVisibleIds);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [matchedRowIds, setMatchedRowIds] = useState<string[]>([]);

  const rowsWithId = useMemo(() => (
    routeState.rows.map((row, index) => ({
      id: normalizeRowId(row, index),
      ...row,
    }))
  ), [routeState.rows]);

  const getRowId = useCallback(
    (row: DataGridRow & { id: string | number }) => String(row.id),
    []
  );

  useVectorTilePreviewSearch(
    Boolean(nodeId),
    rowsWithId,
    searchKeyword,
    getRowId,
    buildSearchTextFromRow,
    setMatchedRowIds
  );

  const matchedIds = useMemo(
    () => new Set(matchedRowIds),
    [matchedRowIds]
  );

  const selectedRows = useMemo(
    () => new Set(Array.from(getSelectedRows('route')).map(String)),
    [getSelectedRows]
  );

  return (
    <MapPreviewFloatingTable
      title="route一覧"
      showTitle
      rows={rowsWithId}
      columns={routeState.columns as GridColumn<DataGridRow & { id: string | number }>[]}
      search={{
        value: searchKeyword,
        onChange: setSearchKeyword,
        placeholder: 'Search routes',
        ariaLabel: 'Search routes',
      }}
      countText={rowsWithId.length > 0 ? `${rowsWithId.length} rows` : undefined}
      loading={routeState.loading}
      error={routeState.error}
      matchedRows={matchedIds}
      selectable
      selectionMode="multiple"
      selectedRows={selectedRows}
      onSelectionChange={(next) => setSelectedRows('route', next)}
      emptyContent={renderEmptyState(routeState.emptyMessage)}
      containerSx={FLOATING_TABLE_CONTAINER_SX}
    />
  );
};
