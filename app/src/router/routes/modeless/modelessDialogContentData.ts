import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type {
  ShapeFeatureMetadata,
  ShapeGeometryErrorRecord,
} from '@hierarchidb/shape-api';
import type { RouteLineString } from '@hierarchidb/route-api';
import { RouteDB } from '@hierarchidb/route-store';
import { TabularDatabaseManager, TabularQueryService } from '@hierarchidb/tabular-store';
import type { GenericDataGridProps, GridColumn } from '@hierarchidb/ui-grid';
import type {
  MapHighlightEntry,
  MapPreviewErrorSummaryById,
  ShapePreviewFeatureRow,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  buildErrorSummaryById,
  useVectorTilePreviewMetadata,
  useVectorTilePreviewSearch,
  mapSelectedMatchesAtom,
  mapViewportFeatureIdsAtom,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { getDBName } from '@hierarchidb/util';
import { useAtomValue, useSetAtom } from 'jotai';
import type { MapFeatureIdSet, MapLayerInfo, MapNodeType } from '~/state/mapSearch.atoms';
import { mapLayerInfoAtom } from '~/state/mapSearch.atoms';

export const MAX_ROWS = 1000;

export type DataGridRow = Record<string, unknown>;
export type DataGridRowSx = NonNullable<GenericDataGridProps<DataGridRow>['rowSx']>;

export type DataGridState = {
  rows: DataGridRow[];
  columns: GridColumn[];
  loading: boolean;
  error?: string;
  truncated?: boolean;
  emptyMessage?: string;
  totalRows?: number;
};

export type DataGridPagination = {
  enabled: boolean;
  page: number;
  rowsPerPage: number;
  rowsPerPageOptions: number[];
  onPageChange: (next: number) => void;
  onRowsPerPageChange: (next: number) => void;
};

export const isMapNodeType = (value?: string): value is MapNodeType =>
  value === 'shape' || value === 'location' || value === 'route';

export const buildColumns = (names: string[]): GridColumn[] =>
  names.map((name) => ({
    id: name,
    label: name,
    sortable: true,
  }));

const resolveShapeDisplayName = (feature: ShapeFeatureMetadata): string => (
  feature.admin2Name
  ?? feature.admin1Name
  ?? feature.admin0Name
  ?? feature.countryName
  ?? ''
);

const resolveShapeAdminName = (feature: ShapeFeatureMetadata): string => {
  if (feature.adminLevel === 2) {
    return feature.admin2Name ?? feature.admin1Name ?? feature.admin0Name ?? feature.countryName ?? '';
  }
  if (feature.adminLevel === 1) {
    return feature.admin1Name ?? feature.admin0Name ?? feature.countryName ?? '';
  }
  if (feature.adminLevel === 0) {
    return feature.admin0Name ?? feature.countryName ?? '';
  }
  return feature.admin2Name ?? feature.admin1Name ?? feature.admin0Name ?? feature.countryName ?? '';
};

const resolveShapeAdminCode = (feature: ShapeFeatureMetadata): string => {
  if (feature.adminLevel === 2) {
    return feature.admin2Code ?? feature.admin1Code ?? feature.admin0Code ?? '';
  }
  if (feature.adminLevel === 1) {
    return feature.admin1Code ?? feature.admin0Code ?? '';
  }
  if (feature.adminLevel === 0) {
    return feature.admin0Code ?? '';
  }
  return feature.admin2Code ?? feature.admin1Code ?? feature.admin0Code ?? '';
};

const isVisibleShapeFeature = (
  feature: ShapeFeatureMetadata,
  visibleIdSet: Set<string | number>,
): boolean => {
  const metadataId = String(feature.id);
  if (visibleIdSet.has(metadataId)) return true;
  const featureId = String(feature.featureId ?? '');
  return featureId.length > 0 && visibleIdSet.has(featureId);
};

export const extractColumnNames = (columns: Array<unknown> | undefined | null): string[] => {
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

export const useShapeTableData = (
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

  const bridgeRef = useRef(getBuildWorkerBridge());

  useEffect(() => {
    if (!nodeId) return;
    let cancelled = false;
    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: undefined }));
      try {
        await bridgeRef.current.initialize();
        const query = await bridgeRef.current.getShapeQueryAPI();
        const collection = await query.listFeatureMetadata(nodeId);
        const filterByViewport = visibleIds !== undefined && visibleIds !== null;
        const visibleIdSet = filterByViewport ? new Set(visibleIds ?? []) : null;
        let totalRows = 0;
        let items: ShapeFeatureMetadata[] = [];
        if (filterByViewport) {
          if (!visibleIdSet || visibleIdSet.size === 0) {
            totalRows = 0;
            items = [];
          } else {
            const filtered = collection.filter((feature) => isVisibleShapeFeature(feature, visibleIdSet));
            totalRows = filtered.length;
            items = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
          }
        } else {
          totalRows = collection.length;
          items = collection.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
        }
        const rows = items.map((feature: ShapeFeatureMetadata) => ({
          id: feature.featureId ?? feature.id,
          name: resolveShapeDisplayName(feature),
          countryCode: feature.countryCode ?? '',
          adminLevel: feature.adminLevel ?? '',
          area: feature.area ?? '',
          population: '',
          geometryType: '',
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

export const useRouteTableData = (
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

export const useLocationTableData = (
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
        const tableId = String(nodeId);
        const manager = new TabularDatabaseManager(getDBName('location-metadata'));
        const metadata = await manager.get(tableId);
        if (!metadata) {
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

export const useMapHighlightSelection = (nodeId: NodeId | null) => {
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

export const useViewportIdSet = (nodeId: NodeId | null) => {
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

export type ShapeListState = {
  rows: ShapePreviewFeatureRow[];
  loading: boolean;
  loaded: boolean;
  error?: string;
  searchKeyword: string;
  setSearchKeyword: (value: string) => void;
  matchedIds: Set<string>;
  errorSummaryById: MapPreviewErrorSummaryById;
};

export const useShapeListState = (_nodeId: NodeId | null): ShapeListState => {
  const mapLayerInfo = useAtomValue(mapLayerInfoAtom);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [matchedFeatureIds, setMatchedFeatureIds] = useState<string[]>([]);
  const bridgeRef = useRef(getBuildWorkerBridge());
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
      shapeNodeIds.map((shapeNodeId) => query.listGeometryErrorRecords(shapeNodeId as NodeId))
    );
    return entries.flat() as ShapeGeometryErrorRecord[];
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
      adminName: resolveShapeAdminName(row),
      adminLevel: row.adminLevel,
      adminCode: resolveShapeAdminCode(row),
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

export const normalizeRowId = (row: DataGridRow, index: number): string | number => {
  const existing = (row as { id?: string | number }).id;
  if (existing !== undefined && existing !== null && String(existing).trim().length > 0) {
    return existing;
  }
  return `row-${index}`;
};

export const buildSearchTextFromRow = (row: DataGridRow): string => (
  Object.values(row)
    .map((value) => String(value ?? ''))
    .join(' ')
);
