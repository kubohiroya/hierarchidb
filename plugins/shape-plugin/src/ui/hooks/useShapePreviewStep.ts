import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import type { DownloadTaskPayload, ShapeEntity } from '../../common/types/index.js';
import { toNodeId } from '@hierarchidb/common-types';
import { normalizeDataSourceName } from '../../common/types/index.js';
import { useTranslation } from '../i18n.js';
import { isShapePreviewMetadataEnabled } from '../../common/config/previewFlags.js';
import { getShapeTileMetadataDB, type ShapeSourceMetadataRow } from '../../services/database/ShapeTileMetadataDB.js';
import { useAtom } from 'jotai';
import {
  shapePreviewSearchAtom,
  shapePreviewMatchedIdsAtom,
  shapePreviewSelectedIdsAtom,
  shapePreviewHoveredIdAtom,
  shapePreviewSelectionContextAtom,
} from '../state/shapePreviewAtoms.ts';
import type { MapWithVectorTilesProps } from '@hierarchidb/ui-map';
import type { MapLibreMapInstance } from '@hierarchidb/ui-map';
import {
  useVectorTilePreviewMetadata,
  useVectorTilePreviewSearch,
  useVectorTilePreviewSelection,
  useVectorTilePreviewMapLayers,
} from '@hierarchidb/ui-gis';
import { useVectorTilePreviewTable } from './preview/useVectorTilePreviewTable.js';
import { TilesDB } from '@hierarchidb/gis-sdk';
import { getDBName } from '@hierarchidb/util';
import { shapeDB } from '../../services/database/ShapeDB.js';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';

type ShapePreviewDraft = Partial<ShapeEntity> & {
  tilesUrl?: string;
  tilesEndpoint?: string;
  tilesLayer?: string;
};

const DEFAULT_VIEW: MapWithVectorTilesProps['initialViewState'] = {
  longitude: 0,
  latitude: 20,
  zoom: 1.5,
};

const DEFAULT_BOUNDS_MARGIN = 0.1;
const MIN_BOUNDS_MARGIN = 0.25;

const fetchTileSummary = async (nodeId: string) => {
  const tilesDb = await TilesDB.getSingleton();
  const byNodeId = await tilesDb.tiles.where('nodeId').equals(nodeId).toArray();
  const tiles = byNodeId.length > 0
    ? byNodeId
    : await tilesDb.tiles.where('key').startsWith(`${nodeId}-`).toArray();
  if (tiles.length === 0) return { tiles: 0, totalBytes: 0 };
  const totalBytes = tiles.reduce((sum, row) => sum + (row.size ?? 0), 0);
  return { tiles: tiles.length, totalBytes };
};

const resolveTilesAvailable = async (nodeId: string): Promise<boolean> => {
  const summary = await fetchTileSummary(nodeId);
  if (summary.tiles > 0) return true;
  const count = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).count();
  return count > 0;
};

const fetchTile = async (
  nodeId: string,
  z: number,
  x: number,
  y: number,
): Promise<ArrayBuffer | null> => {
  const tilesDb = await TilesDB.getSingleton();
  const key = `${nodeId}-${z}-${x}-${y}`;
  const row = await tilesDb.tiles.get(key);
  return row?.data ?? null;
};

export const useShapePreviewStep = (data: Partial<ShapeEntity>, nodeId?: string) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const metadataEnabled = isShapePreviewMetadataEnabled();
  const [searchKeyword, setSearchKeyword] = useAtom(shapePreviewSearchAtom);
  const [matchedIds, setMatchedIds] = useAtom(shapePreviewMatchedIdsAtom);
  const [selectedIds, setSelectedIds] = useAtom(shapePreviewSelectedIdsAtom);
  const [hoveredId, setHoveredId] = useAtom(shapePreviewHoveredIdAtom);
  const [selectionContext, setSelectionContext] = useAtom(shapePreviewSelectionContextAtom);
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);

  const previewDraft = data as ShapePreviewDraft;
  const tilesUrl = previewDraft.tilesUrl ?? previewDraft.tilesEndpoint ?? '';
  const tilesLayer = previewDraft.tilesLayer ?? 'layer0';
  const activeNodeId = previewDraft.nodeId
    ? toNodeId(String(previewDraft.nodeId))
    : nodeId
      ? toNodeId(String(nodeId))
      : null;
  const nodeKey = activeNodeId;
  const [persistedStatus, setPersistedStatus] = useState<string | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const processingStatus = persistedStatus === 'running'
    ? 'processing'
    : persistedStatus;
  const minZoom = previewDraft.batchConfig?.tileConfig?.minZoom;
  const maxZoom = previewDraft.batchConfig?.tileConfig?.maxZoom;
  const [tilesAvailable, setTilesAvailable] = useState(false);
  const [tilesChecking, setTilesChecking] = useState(false);
  const baseLayerId = 'shape-preview';
  const baseSourceId = 'shape-preview-source';
  const tileDbName = getDBName('vectortile');
  const [selectionMetadata, setSelectionMetadata] = useState<DownloadTaskPayload[]>([]);
  const workerClientHook = useMemo(() => {
    try {
      return getWorkerClientHook<WorkerClientRef | null>();
    } catch {
      return null;
    }
  }, []);
  const workerClient = workerClientHook ? workerClientHook() : null;
  const selectionMatrix = previewDraft.selectedArrayByCountries;
  const selectionDataSource = normalizeDataSourceName(
    previewDraft.batchConfig?.dataSource ?? previewDraft.dataSourceName,
  );

  useEffect(() => {
    let cancelled = false;
    if (!activeNodeId) {
      setPersistedStatus(null);
      setStatusLoaded(true);
      return () => {
        cancelled = true;
      };
    }
    setStatusLoaded(false);
    shapeDB.batchSessions.get(activeNodeId).then((session) => {
      if (cancelled) return;
      setPersistedStatus(session?.status ?? null);
      setStatusLoaded(true);
    }).catch(() => {
      if (cancelled) return;
      setPersistedStatus(null);
      setStatusLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [activeNodeId]);

  useEffect(() => {
    let cancelled = false;
    const key = nodeKey ? String(nodeKey) : null;
    if (!key) {
      setTilesAvailable(false);
      setTilesChecking(false);
      return () => {
        cancelled = true;
      };
    }
    setTilesChecking(true);
    resolveTilesAvailable(key).then((available) => {
      if (cancelled) return;
      setTilesAvailable(available);
      setTilesChecking(false);
    }).catch(() => {
      if (cancelled) return;
      setTilesAvailable(false);
      setTilesChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [nodeKey]);

  useEffect(() => {
    if (!nodeKey || tilesAvailable) return;
    if (!processingStatus || processingStatus === 'processing') return;
    let cancelled = false;
    setTilesChecking(true);
    resolveTilesAvailable(String(nodeKey)).then((available) => {
      if (cancelled) return;
      setTilesAvailable(available);
      setTilesChecking(false);
    }).catch(() => {
      if (cancelled) return;
      setTilesChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [nodeKey, processingStatus, tilesAvailable]);

  const statusForPolling = statusLoaded ? processingStatus : 'processing';
  const shouldPollTiles = Boolean(activeNodeId)
    && !tilesAvailable
    && ['processing', 'paused'].includes(statusForPolling ?? '');

  useEffect(() => {
    if (!shouldPollTiles) {
      setTilesChecking(false);
      return;
    }
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const pollSummary = async () => {
      setTilesChecking(true);
      try {
        const available = await resolveTilesAvailable(String(activeNodeId));
        if (cancelled) return;
        if (available) {
          setTilesAvailable(true);
          setTilesChecking(false);
          return;
        }
      } catch (error) {
        console.debug('[ShapePreviewStep] tile summary load failed', error);
      }
      if (!cancelled) {
        timeoutId = setTimeout(pollSummary, 2000);
      }
    };
    void pollSummary();
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeNodeId, shouldPollTiles]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!workerClient || !selectionDataSource || !selectionMatrix) {
        setSelectionMetadata([]);
        return;
      }
      try {
        const api = workerClient.getAPI();
        const payloads = await api.generateShapeDownloadTaskPayloadsFromSelection(
          selectionDataSource,
          selectionMatrix,
        );
        if (!cancelled) {
          setSelectionMetadata(payloads as DownloadTaskPayload[]);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[ShapePreviewStep] failed to generate download task payloads', error);
          setSelectionMetadata([]);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [selectionDataSource, selectionMatrix, workerClient]);

  const loadMetadataRows = useCallback(
    (targetNodeId: string) =>
      getShapeTileMetadataDB()
        .then((db) => db.sourceMetadata.where('nodeId').equals(String(targetNodeId)).toArray()),
    [],
  );

  const {
    metadataRows: rawMetadataRows,
    metadataLoading,
    metadataError,
  } = useVectorTilePreviewMetadata(metadataEnabled, activeNodeId, loadMetadataRows);

  const selectionFilters = useMemo(() => {
    if (selectionMetadata.length === 0) return null;
    const byCode = new Map<string, Set<number>>();
    const byName = new Map<string, Set<number>>();
    selectionMetadata.forEach((entry) => {
      const code = entry.countryCode?.trim().toUpperCase();
      const name = entry.countryName?.trim().toLowerCase();
      const level = entry.adminLevel;
      if (code) {
        const levels = byCode.get(code) ?? new Set<number>();
        if (typeof level === 'number') {
          levels.add(level);
        }
        byCode.set(code, levels);
      }
      if (name) {
        const levels = byName.get(name) ?? new Set<number>();
        if (typeof level === 'number') {
          levels.add(level);
        }
        byName.set(name, levels);
      }
    });
    if (byCode.size === 0 && byName.size === 0) return null;
    return { byCode, byName };
  }, [selectionMetadata]);

  const filteredMetadataRows = useMemo(() => {
    if (!selectionFilters) return rawMetadataRows;
    return rawMetadataRows.filter((row) => {
      const rowLevel = row.adminLevel;
      const rowCode = row.countryCode?.trim().toUpperCase();
      const rowName = row.countryName?.trim().toLowerCase();
      const matchesFilter = (key: string | undefined, source: Map<string, Set<number>>) => {
        if (!key) return false;
        const levels = source.get(key);
        if (!levels || levels.size === 0) return false;
        if (rowLevel == null) return true;
        return levels.has(rowLevel);
      };
      if (matchesFilter(rowCode, selectionFilters.byCode)) return true;
      return matchesFilter(rowName, selectionFilters.byName);
    });
  }, [rawMetadataRows, selectionFilters]);

  const metadataRows = filteredMetadataRows;

  const selectionBounds = useMemo(() => {
    let minLng = Number.POSITIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let hasBounds = false;
    filteredMetadataRows.forEach((row) => {
      const bbox = row.bbox;
      if (!bbox || bbox.length !== 4) return;
      const [minX, minY, maxX, maxY] = bbox;
      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return;
      }
      hasBounds = true;
      minLng = Math.min(minLng, minX);
      minLat = Math.min(minLat, minY);
      maxLng = Math.max(maxLng, maxX);
      maxLat = Math.max(maxLat, maxY);
    });
    if (!hasBounds) return null;
    const lngPadding = Math.max((maxLng - minLng) * DEFAULT_BOUNDS_MARGIN, MIN_BOUNDS_MARGIN);
    const latPadding = Math.max((maxLat - minLat) * DEFAULT_BOUNDS_MARGIN, MIN_BOUNDS_MARGIN);
    const clampLng = (value: number) => Math.max(-180, Math.min(180, value));
    const clampLat = (value: number) => Math.max(-90, Math.min(90, value));
    return {
      minLng: clampLng(minLng - lngPadding),
      minLat: clampLat(minLat - latPadding),
      maxLng: clampLng(maxLng + lngPadding),
      maxLat: clampLat(maxLat + latPadding),
    };
  }, [filteredMetadataRows]);

  const initialViewState = useMemo<MapWithVectorTilesProps['initialViewState']>(() => {
    const zoom = typeof minZoom === 'number' ? minZoom : DEFAULT_VIEW.zoom;
    if (!selectionBounds) {
      return { ...DEFAULT_VIEW, zoom };
    }
    const centerLng = (selectionBounds.minLng + selectionBounds.maxLng) / 2;
    const centerLat = (selectionBounds.minLat + selectionBounds.maxLat) / 2;
    return {
      longitude: centerLng,
      latitude: centerLat,
      zoom,
      bearing: 0,
      pitch: 0,
    };
  }, [minZoom, selectionBounds]);

  useEffect(() => {
    if (!mapInstance || !selectionBounds) return;
    const bounds: [[number, number], [number, number]] = [
      [selectionBounds.minLng, selectionBounds.minLat],
      [selectionBounds.maxLng, selectionBounds.maxLat],
    ];
    mapInstance.fitBounds(bounds, {
      padding: 24,
    });
  }, [mapInstance, minZoom, selectionBounds]);

  const getRowId = useCallback((row: ShapeSourceMetadataRow) => row.originKey, []);
  const buildSearchText = useCallback((row: ShapeSourceMetadataRow) => {
    return [
      row.originLabel,
      row.countryName,
      row.countryCode,
      row.adminLevel != null ? String(row.adminLevel) : undefined,
      row.featureLabel,
      row.featureGroupId,
      row.dataSource,
      row.originKey,
    ]
      .filter(Boolean)
      .join(' ');
  }, []);

  useVectorTilePreviewSearch(
    metadataEnabled,
    metadataRows,
    searchKeyword,
    getRowId,
    buildSearchText,
    setMatchedIds,
  );

  const deriveSelectionContext = useCallback((
    rows: ShapeSourceMetadataRow[],
    ids: string[],
  ) => {
    if (!ids.length) return null;
    const selectedRows = rows.filter((row) => ids.includes(row.originKey));
    const first = selectedRows[0];
    if (!first) return null;
    const consistent = selectedRows.every(
      (row) => row.countryCode === first.countryCode && row.adminLevel === first.adminLevel,
    );
    return consistent && first.countryCode != null && first.adminLevel != null
      ? { countryCode: first.countryCode, adminLevel: first.adminLevel }
      : null;
  }, []);

  const resolveSelection = useCallback((
    row: ShapeSourceMetadataRow,
    current: typeof selectionContext,
    rows: ShapeSourceMetadataRow[],
  ) => {
    const adminLevel = row.adminLevel ?? 0;
    const countryCode = row.countryCode ?? '';
    if (!countryCode) {
      return { nextContext: null, selectedIds: [] as string[] };
    }
    const isSameCountry = current?.countryCode === countryCode;
    const currentLevel = isSameCountry ? current?.adminLevel : null;
    const nextLevel = currentLevel != null
      ? currentLevel > 0
        ? currentLevel - 1
        : null
      : adminLevel;
    if (nextLevel == null) {
      return { nextContext: null, selectedIds: [] as string[] };
    }
    const selectedIds = rows
      .filter((item) => item.countryCode === countryCode && item.adminLevel === nextLevel)
      .map((item) => item.originKey);
    return {
      nextContext: selectedIds.length ? { countryCode, adminLevel: nextLevel } : null,
      selectedIds,
    };
  }, []);

  const getHoverLabel = useCallback((row: ShapeSourceMetadataRow) => {
    const parts = [
      row.originLabel,
      row.countryName,
      row.countryCode,
      row.adminLevel != null ? String(row.adminLevel) : undefined,
    ].filter((part) => part && String(part).trim().length > 0);
    return parts.join(' / ');
  }, []);

  const {
    selectedIdSet,
    hoveredIdSet,
    hoverMessage,
    handleMapIdentify,
  } = useVectorTilePreviewSelection({
    rows: metadataRows,
    selectedIds,
    setSelectedIds,
    hoveredId,
    selectionContext,
    setSelectionContext,
    getRowId,
    resolveSelection,
    deriveSelectionContext,
    getHoverLabel,
    resolveFeatureId: (feature) =>
      String(feature.properties?.__hdbOriginKey ?? feature.properties?.id ?? feature.id ?? ''),
  });

  const matchedIdSet = useMemo<Set<string>>(() => new Set(matchedIds), [matchedIds]);
  const {
    metadataColumns,
    metadataTableRows,
    sortColumn,
    sortDirection,
    handleSort,
  } = useVectorTilePreviewTable(metadataRows, matchedIdSet, searchKeyword);

  useVectorTilePreviewMapLayers({
    mapInstance: tabIndex === 0 ? mapInstance : null,
    baseLayerId,
    baseSourceId,
    tilesLayer,
    matchedIds,
    selectedIds,
    hoveredId,
    setHoveredId,
    theme,
    featureIdProperty: '__hdbOriginKey',
    invalidFeatureIds: [],
  });

  useEffect(() => {
    if (!mapInstance) return;
    const interactiveMap = mapInstance as MapLibreMapInstance & {
      scrollZoom?: { enable?: () => void };
      dragPan?: { enable?: () => void };
      dragRotate?: { enable?: () => void };
      doubleClickZoom?: { enable?: () => void };
      touchZoomRotate?: { enable?: () => void };
    };
    interactiveMap.scrollZoom?.enable?.();
    interactiveMap.dragPan?.enable?.();
    interactiveMap.dragRotate?.enable?.();
    interactiveMap.doubleClickZoom?.enable?.();
    interactiveMap.touchZoomRotate?.enable?.();
  }, [mapInstance]);

  const tileDataProvider = useCallback<NonNullable<MapWithVectorTilesProps['tileDataProvider']>>(
    async (z: number, x: number, y: number, nodeId?: string) => {
      const resolvedNodeId = nodeId ?? (activeNodeId ? String(activeNodeId) : undefined);
      if (!resolvedNodeId) return null;
      const data = await fetchTile(resolvedNodeId, z, x, y);
      if (!data) return null;
      return data;
    },
    [activeNodeId],
  );

  return {
    t,
    theme,
    metadataEnabled,
    tabIndex,
    setTabIndex,
    metadataRows,
    metadataLoading,
    metadataError,
    searchKeyword,
    setSearchKeyword,
    matchedIds,
    selectedIds,
    setSelectedIds,
    hoveredId,
    setHoveredId,
    selectionContext,
    setSelectionContext,
    sortColumn,
    sortDirection,
    handleSort,
    metadataColumns,
    metadataTableRows,
    matchedIdSet,
    selectedIdSet,
    hoveredIdSet,
    hoverMessage,
    tilesUrl,
    tilesLayer,
    nodeId: activeNodeId,
    tilesAvailable,
    tilesChecking,
    processingStatus,
    tileDbName,
    tileDataProvider,
    baseLayerId,
    baseSourceId,
    mapInstance,
    setMapInstance,
    handleMapIdentify,
    minZoom,
    maxZoom,
    defaultView: initialViewState,
  };
};
