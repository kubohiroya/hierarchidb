import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import type { FetchTaskPayload, ShapeEntity } from '../../../common/types/index.js';
import { normalizeDataSourceName } from '../../../common/types/index.js';
import { isShapePreviewMetadataEnabled } from '../../../common/config/previewFlags.js';
import { toNodeId, type NodeId } from '@hierarchidb/common-types';
import { useTranslation } from '../../i18n.js';
import type { ShapeFeatureMetadata, ShapeSourceMetadata, ShapeTransformErrorRecord } from '@hierarchidb/plugin-service-api';
import { useAtom } from 'jotai';
import {
  shapePreviewSearchAtom,
  shapePreviewMatchedIdsAtom,
  shapePreviewSelectedIdsAtom,
  shapePreviewHoveredIdAtom,
  shapePreviewSelectionContextAtom,
} from '../../atoms/shapePreviewAtoms.ts';
import type { MapWithVectorTilesProps } from '@hierarchidb/ui-map';
import type { MapLibreMapInstance } from '@hierarchidb/ui-map';
import {
  useVectorTilePreviewMetadata,
  useVectorTilePreviewSearch,
  useVectorTilePreviewSelection,
  useVectorTilePreviewMapLayers,
} from '@hierarchidb/ui-map';
import { getDBName } from '@hierarchidb/util';
//import { getShapeDbAPIClient } from '../../../services/batch/ShapeBuildAPIClient.ts';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import { useVectorTilePreviewTable } from './useVectorTilePreviewTable.ts';
import { useVectorTileFeatureTable } from './useVectorTileFeatureTable.ts';
import { useTransformErrorTable } from './useTransformErrorTable.ts';
import { shapeQueryAPIImpl } from '../../../services/batch/ShapeBuildAPIClient.ts';

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
  const summary = await shapeQueryAPIImpl.getVectorTileSummary(toNodeId(nodeId));
  return { tiles: summary.tiles, totalBytes: summary.totalBytes };
};

const resolveTilesAvailable = async (nodeId: string): Promise<boolean> => {
  const summary = await fetchTileSummary(nodeId);
  return summary.tiles > 0;
};

const fetchTile = async (
  nodeId: string,
  z: number,
  x: number,
  y: number,
): Promise<ArrayBuffer | null> => {
  const data = await shapeQueryAPIImpl.getVectorTile(toNodeId(nodeId), z, x, y);
  if (!data) return null;
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
};

export const useShapePreviewStep = (data: Partial<ShapeEntity>, nodeId?: string) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const sourceTabIndex = 0;
  const featureTabIndex = 1;
  const mapTabIndex = 2;
  const errorTabIndex = 3;
  const [tabIndex, setTabIndex] = useState(mapTabIndex);
  const metadataEnabled = isShapePreviewMetadataEnabled();
  const [searchKeyword, setSearchKeyword] = useAtom(shapePreviewSearchAtom);
  const [matchedIds, setMatchedIds] = useAtom(shapePreviewMatchedIdsAtom);
  const [selectedIds, setSelectedIds] = useAtom(shapePreviewSelectedIdsAtom);
  const [hoveredId, setHoveredId] = useAtom(shapePreviewHoveredIdAtom);
  const [selectionContext, setSelectionContext] = useAtom(shapePreviewSelectionContextAtom);
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const [featureSearchKeyword, setFeatureSearchKeyword] = useState('');
  const [matchedFeatureIds, setMatchedFeatureIds] = useState<string[]>([]);
  const [errorSearchKeyword, setErrorSearchKeyword] = useState('');
  const [matchedErrorIds, setMatchedErrorIds] = useState<string[]>([]);
  const [selectedErrorIds, setSelectedErrorIds] = useState<string[]>([]);

  const previewDraft = data as ShapePreviewDraft;
  const tilesUrl = previewDraft.tilesUrl ?? previewDraft.tilesEndpoint ?? '';
  const tilesLayer = previewDraft.tilesLayer ?? 'layer0';
  const activeNodeId = previewDraft.nodeId
    ? toNodeId(String(previewDraft.nodeId))
    : nodeId
      ? toNodeId(String(nodeId))
      : null;
  const nodeKey = activeNodeId;
  const processingStatus = data?.processingStatus ?? null;
  const [tilesAvailable, setTilesAvailable] = useState(false);
  const [tilesChecking, setTilesChecking] = useState(false);
  const baseLayerId = 'shape-preview';
  const baseSourceId = 'shape-preview-source';
  const tileDbName = getDBName('shape');
  const [selectionMetadata, setSelectionMetadata] = useState<FetchTaskPayload[]>([]);
  const workerClientHook = useMemo(() => {
    try {
      return getWorkerClientHook<WorkerClientRef | null>();
    } catch {
      return null;
    }
  }, []);
  const workerClient = workerClientHook ? workerClientHook() : null;
  const selectionMatrix = previewDraft.selectedArrayByCountries;
  const selectionDataSource = normalizeDataSourceName(previewDraft.buildConfig?.dataSourceName);

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

  const statusForPolling = processingStatus ?? 'processing';
  const shouldPollTiles = Boolean(activeNodeId)
    && !tilesAvailable
    && statusForPolling === 'processing';
  const shouldPollMetadata = Boolean(activeNodeId)
    && metadataEnabled
    && statusForPolling === 'processing';
  const metadataPollIntervalMs = shouldPollMetadata ? 2000 : undefined;

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
      if (!workerClient || !selectionDataSource || !selectionMatrix || !activeNodeId) {
        setSelectionMetadata([]);
        return;
      }
      try {
        const api = workerClient.getAPI();
        const payloads = await api.generateShapeDownloadTaskPayloadsFromSelection(
          activeNodeId,
          selectionDataSource,
          selectionMatrix,
        );
        if (!cancelled) {
          setSelectionMetadata(payloads as FetchTaskPayload[]);
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
  }, [activeNodeId, selectionDataSource, selectionMatrix, workerClient]);

  const loadSourceMetadataRows = useCallback(
    (targetNodeId: NodeId) =>
      shapeQueryAPIImpl.listSourceMetadata(targetNodeId) as Promise<ShapeSourceMetadata[]>,
    [],
  );

  const loadFeatureMetadataRows = useCallback(
    (targetNodeId: NodeId) =>
      shapeQueryAPIImpl.listFeatureMetadata(targetNodeId) as Promise<ShapeFeatureMetadata[]>,
    [],
  );

  const loadTransformErrorRows = useCallback(
    (targetNodeId: NodeId) =>
      shapeQueryAPIImpl.listTransformErrorRecords(targetNodeId) as Promise<ShapeTransformErrorRecord[]>,
    [],
  );

  const {
    metadataRows: rawSourceMetadataRows,
    metadataLoading: sourceMetadataLoading,
    metadataError: sourceMetadataError,
    metadataLoaded: sourceMetadataLoaded,
  } = useVectorTilePreviewMetadata(
    metadataEnabled,
    activeNodeId,
    loadSourceMetadataRows,
    metadataPollIntervalMs,
  );

  const {
    metadataRows: rawFeatureMetadataRows,
    metadataLoading: featureMetadataLoading,
    metadataError: featureMetadataError,
    metadataLoaded: featureMetadataLoaded,
  } = useVectorTilePreviewMetadata(
    metadataEnabled,
    activeNodeId,
    loadFeatureMetadataRows,
    metadataPollIntervalMs,
  );

  const {
    metadataRows: rawTransformErrorRows,
    metadataLoading: transformErrorLoading,
    metadataError: transformErrorError,
    metadataLoaded: transformErrorLoaded,
  } = useVectorTilePreviewMetadata(
    metadataEnabled,
    activeNodeId,
    loadTransformErrorRows,
    metadataPollIntervalMs,
  );

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
    if (!selectionFilters) return rawSourceMetadataRows;
    return rawSourceMetadataRows.filter((row) => {
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
  }, [rawSourceMetadataRows, selectionFilters]);

  const sourceMetadataRows = filteredMetadataRows;
  const featureMetadataRows = rawFeatureMetadataRows;
  const transformErrorRows = rawTransformErrorRows;
  const updateBounds = useCallback(
    (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null, lng: number, lat: number) => {
      if (!bounds) {
        return { minLng: lng, minLat: lat, maxLng: lng, maxLat: lat };
      }
      return {
        minLng: Math.min(bounds.minLng, lng),
        minLat: Math.min(bounds.minLat, lat),
        maxLng: Math.max(bounds.maxLng, lng),
        maxLat: Math.max(bounds.maxLat, lat),
      };
    },
    [],
  );

  const visitCoordinates = useCallback(
    (coords: unknown, bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null) => {
      if (!Array.isArray(coords)) return bounds;
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        return updateBounds(bounds, coords[0], coords[1]);
      }
      return coords.reduce(
        (current, entry) => visitCoordinates(entry, current),
        bounds,
      );
    },
    [updateBounds],
  );

  const finalizeBounds = useCallback(
    (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null) => {
      if (!bounds) return null;
      const lngPadding = Math.max((bounds.maxLng - bounds.minLng) * DEFAULT_BOUNDS_MARGIN, MIN_BOUNDS_MARGIN);
      const latPadding = Math.max((bounds.maxLat - bounds.minLat) * DEFAULT_BOUNDS_MARGIN, MIN_BOUNDS_MARGIN);
      const clampLng = (value: number) => Math.max(-180, Math.min(180, value));
      const clampLat = (value: number) => Math.max(-90, Math.min(90, value));
      return {
        minLng: clampLng(bounds.minLng - lngPadding),
        minLat: clampLat(bounds.minLat - latPadding),
        maxLng: clampLng(bounds.maxLng + lngPadding),
        maxLat: clampLat(bounds.maxLat + latPadding),
      };
    },
    [],
  );

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

  const selectedBounds = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const selectedSet = new Set(selectedIds.map(String));
    let minLng = Number.POSITIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let hasBounds = false;
    filteredMetadataRows.forEach((row) => {
      if (!selectedSet.has(String(row.originKey))) return;
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
    return finalizeBounds(
      hasBounds ? { minLng, minLat, maxLng, maxLat } : null,
    );
  }, [filteredMetadataRows, finalizeBounds, selectedIds]);

  const selectedErrorBounds = useMemo(() => {
    if (selectedErrorIds.length === 0) return null;
    const selectedSet = new Set(selectedErrorIds);
    let bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null = null;
    transformErrorRows.forEach((row) => {
      if (!selectedSet.has(row.id)) return;
      row.lineFeatures?.features?.forEach((feature) => {
        const geometry = (feature as { geometry?: { coordinates?: unknown } }).geometry;
        if (!geometry?.coordinates) return;
        bounds = visitCoordinates(geometry.coordinates, bounds);
      });
    });
    return finalizeBounds(bounds);
  }, [finalizeBounds, selectedErrorIds, transformErrorRows, visitCoordinates]);

  const fitSelectionBounds = useMemo(() => {
    if (!selectedBounds && !selectedErrorBounds) return null;
    if (!selectedBounds) return selectedErrorBounds;
    if (!selectedErrorBounds) return selectedBounds;
    return {
      minLng: Math.min(selectedBounds.minLng, selectedErrorBounds.minLng),
      minLat: Math.min(selectedBounds.minLat, selectedErrorBounds.minLat),
      maxLng: Math.max(selectedBounds.maxLng, selectedErrorBounds.maxLng),
      maxLat: Math.max(selectedBounds.maxLat, selectedErrorBounds.maxLat),
    };
  }, [selectedBounds, selectedErrorBounds]);

  const initialViewState = useMemo<MapWithVectorTilesProps['initialViewState']>(() => {
    if (!selectionBounds) {
      return DEFAULT_VIEW;
    }
    const centerLng = (selectionBounds.minLng + selectionBounds.maxLng) / 2;
    const centerLat = (selectionBounds.minLat + selectionBounds.maxLat) / 2;
    return {
      longitude: centerLng,
      latitude: centerLat,
      zoom: DEFAULT_VIEW.zoom,
      bearing: 0,
      pitch: 0,
    };
  }, [selectionBounds]);

  useEffect(() => {
    if (!mapInstance || !selectionBounds) return;
    const bounds: [[number, number], [number, number]] = [
      [selectionBounds.minLng, selectionBounds.minLat],
      [selectionBounds.maxLng, selectionBounds.maxLat],
    ];
    mapInstance.fitBounds(bounds, {
      padding: 24,
    });
  }, [mapInstance, selectionBounds]);

  const canFitSelection = Boolean(mapInstance && fitSelectionBounds);
  const handleFitSelection = useCallback(() => {
    if (!mapInstance || !fitSelectionBounds) return;
    const bounds: [[number, number], [number, number]] = [
      [fitSelectionBounds.minLng, fitSelectionBounds.minLat],
      [fitSelectionBounds.maxLng, fitSelectionBounds.maxLat],
    ];
    mapInstance.fitBounds(bounds, {
      padding: 24,
    });
  }, [fitSelectionBounds, mapInstance]);

  const getRowId = useCallback((row: ShapeSourceMetadata) => row.originKey, []);
  const buildSearchText = useCallback((row: ShapeSourceMetadata) => {
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
    sourceMetadataRows,
    searchKeyword,
    getRowId,
    buildSearchText,
    setMatchedIds,
  );

  const deriveSelectionContext = useCallback((
    rows: ShapeSourceMetadata[],
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
    row: ShapeSourceMetadata,
    current: typeof selectionContext,
    rows: ShapeSourceMetadata[],
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

  const getHoverLabel = useCallback((row: ShapeSourceMetadata) => {
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
    rows: sourceMetadataRows,
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
  } = useVectorTilePreviewTable(sourceMetadataRows, matchedIdSet, searchKeyword);

  const getFeatureRowId = useCallback((row: ShapeFeatureMetadata) => row.id, []);
  const buildFeatureSearchText = useCallback((row: ShapeFeatureMetadata) => (
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
  ), []);

  useVectorTilePreviewSearch(
    metadataEnabled,
    featureMetadataRows,
    featureSearchKeyword,
    getFeatureRowId,
    buildFeatureSearchText,
    setMatchedFeatureIds,
  );

  const matchedFeatureIdSet = useMemo<Set<string>>(
    () => new Set(matchedFeatureIds),
    [matchedFeatureIds],
  );

  const {
    metadataColumns: featureColumns,
    metadataTableRows: featureTableRows,
    sortColumn: featureSortColumn,
    sortDirection: featureSortDirection,
    handleSort: handleFeatureSort,
  } = useVectorTileFeatureTable(featureMetadataRows, matchedFeatureIdSet, featureSearchKeyword);

  const getErrorRowId = useCallback((row: ShapeTransformErrorRecord) => row.id, []);
  const buildErrorSearchText = useCallback((row: ShapeTransformErrorRecord) => (
    [
      row.sourceKey,
      row.countryCode,
      row.adminLevel != null ? String(row.adminLevel) : undefined,
      row.featureId,
      row.taskId,
      row.bandId != null ? String(row.bandId) : undefined,
      row.message,
    ]
      .filter(Boolean)
      .join(' ')
  ), []);

  useVectorTilePreviewSearch(
    metadataEnabled,
    transformErrorRows,
    errorSearchKeyword,
    getErrorRowId,
    buildErrorSearchText,
    setMatchedErrorIds,
  );

  const matchedErrorIdSet = useMemo<Set<string>>(
    () => new Set(matchedErrorIds),
    [matchedErrorIds],
  );

  const featureAdminNameMap = useMemo(() => {
    const map = new Map<string, { countryName?: string; adminName?: string; adminLevel?: number }>();
    featureMetadataRows.forEach((row) => {
      if (!row.featureId || map.has(row.featureId)) return;
      map.set(row.featureId, {
        countryName: row.countryName,
        adminName: row.adminName,
        adminLevel: row.adminLevel,
      });
    });
    return map;
  }, [featureMetadataRows]);

  const {
    errorColumns,
    errorTableRows,
    sortColumn: errorSortColumn,
    sortDirection: errorSortDirection,
    handleSort: handleErrorSort,
  } = useTransformErrorTable(transformErrorRows, matchedErrorIdSet, errorSearchKeyword, featureAdminNameMap);

  const errorLineCollection = useMemo<ShapeTransformErrorRecord['lineFeatures'] | null>(() => {
    if (transformErrorRows.length === 0) return null;
    const selected = selectedErrorIds.length ? new Set(selectedErrorIds) : null;
    const features = transformErrorRows.flatMap((row) => {
      const isSelected = selected ? selected.has(row.id) : false;
      return (row.lineFeatures?.features ?? []).map((feature) => ({
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          selected: isSelected,
        },
      }));
    });
    return features.length ? { type: 'FeatureCollection', features } : null;
  }, [selectedErrorIds, transformErrorRows]);

  useVectorTilePreviewMapLayers({
    mapInstance: tabIndex === mapTabIndex ? mapInstance : null,
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
    sourceTabIndex,
    featureTabIndex,
    mapTabIndex,
    errorTabIndex,
    sourceMetadataRows,
    sourceMetadataLoading,
    sourceMetadataError,
    sourceMetadataLoaded,
    featureMetadataRows,
    featureMetadataLoading,
    featureMetadataError,
    featureMetadataLoaded,
    transformErrorRows,
    transformErrorLoading,
    transformErrorError,
    transformErrorLoaded,
    searchKeyword,
    setSearchKeyword,
    featureSearchKeyword,
    setFeatureSearchKeyword,
    errorSearchKeyword,
    setErrorSearchKeyword,
    matchedIds,
    selectedIds,
    setSelectedIds,
    selectedErrorIds,
    setSelectedErrorIds,
    hoveredId,
    setHoveredId,
    selectionContext,
    setSelectionContext,
    sortColumn,
    sortDirection,
    handleSort,
    featureSortColumn,
    featureSortDirection,
    handleFeatureSort,
    metadataColumns,
    metadataTableRows,
    featureColumns,
    featureTableRows,
    matchedIdSet,
    matchedFeatureIdSet,
    matchedErrorIdSet,
    errorColumns,
    errorTableRows,
    errorSortColumn,
    errorSortDirection,
    handleErrorSort,
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
    defaultView: initialViewState,
    selectionDataSource,
    errorLineCollection,
    canFitSelection,
    handleFitSelection,
  };
};
