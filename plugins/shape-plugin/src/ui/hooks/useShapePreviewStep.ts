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
  const tilesLayer = previewDraft.tilesLayer ?? 'default';
  const sessionId = previewDraft.batchSessionId ?? previewDraft.nodeId ?? null;
  const tilesAvailableFromDraft = (previewDraft.tileSummary?.tiles ?? 0) > 0;
  const [tilesAvailable, setTilesAvailable] = useState(tilesAvailableFromDraft);
  const baseLayerId = 'shape-preview';
  const baseSourceId = 'shape-preview-source';
  const tileDbName = 'shape-preview-tiles';

  useEffect(() => {
    setTilesAvailable(tilesAvailableFromDraft);
  }, [tilesAvailableFromDraft]);

  useEffect(() => {
    if (!sessionId || tilesAvailableFromDraft) return;
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const summary = await getTileSummary(String(sessionId));
        if (cancelled) return;
        setTilesAvailable(summary.tiles > 0);
      } catch (error) {
        console.debug('[ShapePreviewStep] tile summary load failed', error);
      }
    };
    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [sessionId, tilesAvailableFromDraft]);

  const loadMetadataRows = useCallback(
    (targetSessionId: string) =>
      getShapeTileMetadataDB()
        .then((db) => db.featureMetadata.where('sessionId').equals(String(targetSessionId)).toArray()),
    [],
  );

  const {
    metadataRows,
    metadataLoading,
    metadataError,
  } = useVectorTilePreviewMetadata(metadataEnabled, sessionId, loadMetadataRows);

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
    tileDbName,
    tileDataProvider,
    baseLayerId,
    baseSourceId,
    mapInstance,
    setMapInstance,
    handleMapIdentify,
    defaultView: DEFAULT_VIEW,
  };
};
