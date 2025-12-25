import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import type { ShapeEntity } from '../../common/types/index.js';
import { useTranslation } from '../i18n.js';
import { isShapePreviewMetadataEnabled } from '../../common/config/previewFlags.js';
import { getShapeTileMetadataDB, type ShapeFeatureMetadataRow } from '../../services/database/ShapeTileMetadataDB.js';
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
import { getTile, getTileSummary } from '../../services/tiles/RuntimeTileClient.js';

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

export const useShapePreviewStep = (data: Partial<ShapeEntity>) => {
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
  const sessionId = previewDraft.batchSessionId ?? previewDraft.nodeId ?? null;
  const processingStatus = previewDraft.processingStatus;
  const minZoom = previewDraft.batchConfig?.tileConfig?.minZoom;
  const tilesAvailableFromDraft = (previewDraft.tileSummary?.tiles ?? 0) > 0;
  const [tilesAvailable, setTilesAvailable] = useState(tilesAvailableFromDraft);
  const [tilesChecking, setTilesChecking] = useState(false);
  const baseLayerId = 'shape-preview';
  const baseSourceId = 'shape-preview-source';
  const tileDbName = 'shape-preview-tiles';
  const selectionMetadata = previewDraft.urlMetadata ?? [];

  useEffect(() => {
    setTilesAvailable(tilesAvailableFromDraft);
  }, [tilesAvailableFromDraft]);

  const shouldPollTiles = Boolean(sessionId)
    && !tilesAvailableFromDraft
    && ['processing', 'paused', 'completed'].includes(processingStatus ?? '');

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
        const summary = await getTileSummary(String(sessionId));
        if (cancelled) return;
        if (summary.tiles > 0) {
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
  }, [sessionId, shouldPollTiles, tilesAvailableFromDraft]);

  const loadMetadataRows = useCallback(
    (targetSessionId: string) =>
      getShapeTileMetadataDB()
        .then((db) => db.featureMetadata.where('sessionId').equals(String(targetSessionId)).toArray()),
    [],
  );

  const {
    metadataRows: rawMetadataRows,
    metadataLoading,
    metadataError,
  } = useVectorTilePreviewMetadata(metadataEnabled, sessionId, loadMetadataRows);

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

  const metadataRows = useMemo(() => {
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

  const selectionBounds = useMemo(() => {
    let minLng = Number.POSITIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let hasBounds = false;
    metadataRows.forEach((row) => {
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
  }, [metadataRows]);

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

  const getRowId = useCallback((row: ShapeFeatureMetadataRow) => row.featureId, []);
  const buildSearchText = useCallback((row: ShapeFeatureMetadataRow) => {
    return [
      row.countryName,
      row.countryCode,
      row.adminName,
      row.adminLevel != null ? String(row.adminLevel) : undefined,
      row.adminCode,
      row.dataSource,
      row.featureId,
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
    rows: ShapeFeatureMetadataRow[],
    ids: string[],
  ) => {
    if (!ids.length) return null;
    const selectedRows = rows.filter((row) => ids.includes(row.featureId));
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
    row: ShapeFeatureMetadataRow,
    current: typeof selectionContext,
    rows: ShapeFeatureMetadataRow[],
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
      .map((item) => item.featureId);
    return {
      nextContext: selectedIds.length ? { countryCode, adminLevel: nextLevel } : null,
      selectedIds,
    };
  }, []);

  const getHoverLabel = useCallback((row: ShapeFeatureMetadataRow) => {
    const parts = [
      row.countryName,
      row.countryCode,
      row.adminName,
      row.adminLevel != null ? String(row.adminLevel) : undefined,
      row.adminCode,
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
    mapInstance,
    baseLayerId,
    baseSourceId,
    tilesLayer,
    matchedIds,
    selectedIds,
    hoveredId,
    setHoveredId,
    theme,
  });

  const tileDataProvider = useCallback<NonNullable<MapWithVectorTilesProps['tileDataProvider']>>(
    async (z: number, x: number, y: number, nodeId?: string) => {
      const resolvedSessionId = nodeId ?? (sessionId ? String(sessionId) : undefined);
      if (!resolvedSessionId) return null;
      const data = await getTile(resolvedSessionId, z, x, y);
      if (!data) return null;
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    },
    [sessionId],
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
    sessionId,
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
  };
};
