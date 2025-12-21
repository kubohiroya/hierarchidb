import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, Alert, Tabs, Tab, Snackbar } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ShapeEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../i18n.js';
import { loadMapWithVectorTiles, type MapWithVectorTilesProps } from '@hierarchidb/ui-map';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { isShapePreviewMetadataEnabled } from '../../../common/config/previewFlags.js';
import { getShapeTileMetadataDB, type ShapeFeatureMetadataRow } from '../../../services/database/ShapeTileMetadataDB.js';
import { GenericDataGrid, type GridColumn } from '@hierarchidb/ui-data-grid';
import { SearchField } from '@hierarchidb/ui-search-field';
import { useAtom } from 'jotai';
import {
  shapePreviewSearchAtom,
  shapePreviewMatchedIdsAtom,
  shapePreviewSelectedIdsAtom,
  shapePreviewHoveredIdAtom,
  shapePreviewSelectionContextAtom,
} from '../../state/shapePreviewAtoms.ts';
import type { MapLibreMapInstance } from '@hierarchidb/ui-map';
import type { MapFeatureIdentifyResult } from '@hierarchidb/ui-map';

type ShapePreviewDraft = Partial<ShapeEntity> & {
  tilesUrl?: string;
  tilesEndpoint?: string;
  tilesLayer?: string;
};

type MapLibreInteractiveMap = MapLibreMapInstance & {
  on(event: string, cb: (...args: unknown[]) => void): void;
  on(event: string, layerId: string, cb: (...args: unknown[]) => void): void;
  off(event: string, cb: (...args: unknown[]) => void): void;
  off(event: string, layerId: string, cb: (...args: unknown[]) => void): void;
  setFilter(layerId: string, filter: unknown): void;
};

const DEFAULT_VIEW: MapWithVectorTilesProps['initialViewState'] = {
  longitude: 0,
  latitude: 20,
  zoom: 1.5,
};

export const ShapePreviewStep: React.FC<ShapeDialogStepProps> = ({ data }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [metadataRows, setMetadataRows] = useState<ShapeFeatureMetadataRow[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const metadataEnabled = isShapePreviewMetadataEnabled();
  const [searchKeyword, setSearchKeyword] = useAtom(shapePreviewSearchAtom);
  const [matchedIds, setMatchedIds] = useAtom(shapePreviewMatchedIdsAtom);
  const [selectedIds, setSelectedIds] = useAtom(shapePreviewSelectedIdsAtom);
  const [hoveredId, setHoveredId] = useAtom(shapePreviewHoveredIdAtom);
  const [selectionContext, setSelectionContext] = useAtom(shapePreviewSelectionContextAtom);
  const [sortColumn, setSortColumn] = useState<string>('countryName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);

  const previewDraft = data as ShapePreviewDraft;
  const tilesUrl = previewDraft.tilesUrl ?? previewDraft.tilesEndpoint ?? '';
  const tilesLayer = previewDraft.tilesLayer ?? 'default';
  const sessionId = previewDraft.batchSessionId ?? previewDraft.nodeId ?? null;
  const baseLayerId = 'shape-preview';
  const baseSourceId = 'shape-preview-source';

  useEffect(() => {
    if (!metadataEnabled) {
      setMetadataRows([]);
      setMetadataLoading(false);
      setMetadataError(null);
      return;
    }
    if (!sessionId) {
      setMetadataRows([]);
      setMetadataLoading(false);
      setMetadataError(null);
      return;
    }
    let cancelled = false;
    setMetadataLoading(true);
    setMetadataError(null);
    void getShapeTileMetadataDB()
      .then(async (db) => db.featureMetadata.where('sessionId').equals(String(sessionId)).toArray())
      .then((rows) => {
        if (!cancelled) {
          setMetadataRows(rows);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMetadataError(error instanceof Error ? error.message : 'Failed to load metadata.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMetadataLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [metadataEnabled, sessionId]);

  useEffect(() => {
    if (!metadataEnabled) {
      setMatchedIds([]);
      return;
    }
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      setMatchedIds([]);
      return;
    }
    const matches = metadataRows
      .filter((row) => {
        const haystack = [
          row.countryName,
          row.countryCode,
          row.adminName,
          row.adminLevel != null ? String(row.adminLevel) : undefined,
          row.adminCode,
          row.dataSource,
          row.featureId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(keyword);
      })
      .map((row) => row.featureId);
    setMatchedIds(matches);
  }, [metadataEnabled, metadataRows, searchKeyword, setMatchedIds]);

  useEffect(() => {
    if (!selectedIds.length) {
      setSelectionContext(null);
      return;
    }
    const selectedRows = metadataRows.filter((row) => selectedIds.includes(row.featureId));
    const first = selectedRows[0];
    if (!first) {
      setSelectionContext(null);
      return;
    }
    const consistent = selectedRows.every(
      (row) => row.countryCode === first.countryCode && row.adminLevel === first.adminLevel,
    );
    setSelectionContext(
      consistent && first.countryCode != null && first.adminLevel != null
        ? { countryCode: first.countryCode, adminLevel: first.adminLevel }
        : null,
    );
  }, [metadataRows, selectedIds, setSelectionContext]);

  const metadataById = useMemo(() => {
    return new Map(metadataRows.map((row) => [row.featureId, row]));
  }, [metadataRows]);

  const matchedIdSet = useMemo<Set<string>>(() => new Set(matchedIds), [matchedIds]);
  const selectedIdSet = useMemo<Set<string>>(() => new Set(selectedIds), [selectedIds]);
  const hoveredIdSet = useMemo<Set<string>>(
    () => (hoveredId ? new Set([hoveredId]) : new Set<string>()),
    [hoveredId],
  );

  const metadataTableRows = useMemo(() => {
    const rows = metadataRows.map((row) => ({
      id: row.featureId,
      countryName: row.countryName ?? '',
      countryCode: row.countryCode ?? '',
      adminName: row.adminName ?? '',
      adminLevel: row.adminLevel ?? '',
      adminCode: row.adminCode ?? '',
      dataSource: row.dataSource ?? '',
      createdAt: row.createdAt ? new Date(row.createdAt).toLocaleString() : '',
      vertexCount: row.vertexCount,
      polygonCount: row.polygonCount,
      bbox: row.bbox ? row.bbox.map((value) => value.toFixed(4)).join(', ') : '',
      area: Number.isFinite(row.area) ? Math.round(row.area).toLocaleString() : '',
      featureId: row.featureId,
    }));
    const keyword = searchKeyword.trim().toLowerCase();
    const filtered = keyword
      ? rows.filter((row) => matchedIdSet.has(row.featureId))
      : rows;
    const sorted = [...filtered].sort((a, b) => {
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
  }, [metadataRows, matchedIdSet, searchKeyword, sortColumn, sortDirection]);

  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
  }, []);

  const metadataColumns = useMemo<GridColumn<(typeof metadataTableRows)[number]>[]>(() => ([
    { id: 'countryName', label: t('preview.metadata.columns.countryName', 'Country'), width: 160, sortable: true },
    { id: 'countryCode', label: t('preview.metadata.columns.countryCode', 'Country Code'), width: 120, sortable: true },
    { id: 'adminName', label: t('preview.metadata.columns.adminName', 'Admin Name'), width: 180, sortable: true },
    { id: 'adminLevel', label: t('preview.metadata.columns.adminLevel', 'Admin Level'), width: 120, align: 'right', sortable: true },
    { id: 'adminCode', label: t('preview.metadata.columns.adminCode', 'Admin Code'), width: 160, sortable: true },
    { id: 'dataSource', label: t('preview.metadata.columns.dataSource', 'Data Source'), width: 140, sortable: true },
    { id: 'createdAt', label: t('preview.metadata.columns.createdAt', 'Created At'), width: 180, sortable: true },
    { id: 'vertexCount', label: t('preview.metadata.columns.vertexCount', 'Vertices'), width: 120, align: 'right', sortable: true },
    { id: 'polygonCount', label: t('preview.metadata.columns.polygonCount', 'Polygons'), width: 120, align: 'right', sortable: true },
    { id: 'bbox', label: t('preview.metadata.columns.bbox', 'Bounding Box'), width: 220, sortable: true },
    { id: 'area', label: t('preview.metadata.columns.area', 'Area'), width: 140, align: 'right', sortable: true },
    { id: 'featureId', label: t('preview.metadata.columns.featureId', 'Feature ID'), width: 160, sortable: true },
  ]), [t]);

  const selectionForFeature = useCallback(
    (row: ShapeFeatureMetadataRow, current: typeof selectionContext) => {
      const adminLevel = row.adminLevel ?? 0;
      const countryCode = row.countryCode ?? '';
      if (!countryCode) {
        return { nextLevel: null, selected: [] as string[] };
      }
      const isSameCountry = current?.countryCode === countryCode;
      const currentLevel = isSameCountry ? current?.adminLevel : null;
      const nextLevel = currentLevel != null
        ? currentLevel > 0
          ? currentLevel - 1
          : null
        : adminLevel;
      if (nextLevel == null) {
        return { nextLevel: null, selected: [] as string[] };
      }
      const selected = metadataRows
        .filter((item) => item.countryCode === countryCode && item.adminLevel === nextLevel)
        .map((item) => item.featureId);
      return { nextLevel, selected };
    },
    [metadataRows],
  );

  const handleMapIdentify = useCallback(
    (result: MapFeatureIdentifyResult) => {
      const feature = result.features?.[0];
      if (!feature) {
        setSelectedIds([]);
        setSelectionContext(null);
        return;
      }
      const featureId = String(feature.id ?? feature.properties?.id ?? '');
      if (!featureId) {
        setSelectedIds([]);
        setSelectionContext(null);
        return;
      }
      const row = metadataById.get(featureId);
      if (!row) {
        setSelectedIds([]);
        setSelectionContext(null);
        return;
      }
      const { nextLevel, selected } = selectionForFeature(row, selectionContext);
      setSelectedIds(selected);
      if (nextLevel == null || !row.countryCode || selected.length === 0) {
        setSelectionContext(null);
      } else {
        setSelectionContext({ countryCode: row.countryCode, adminLevel: nextLevel });
      }
    },
    [metadataById, selectionContext, selectionForFeature, setSelectedIds, setSelectionContext],
  );

  const hoverMessage = useMemo(() => {
    if (!hoveredId) return '';
    const row = metadataById.get(hoveredId);
    if (!row) return '';
    const parts = [
      row.countryName,
      row.countryCode,
      row.adminName,
      row.adminLevel != null ? String(row.adminLevel) : undefined,
      row.adminCode,
    ].filter((part) => part && String(part).trim().length > 0);
    return parts.join(' / ');
  }, [hoveredId, metadataById]);

  useEffect(() => {
    if (!mapInstance) return;
    const map = mapInstance as MapLibreInteractiveMap;
    const baseId = baseLayerId;
    const sourceId = baseSourceId;
    const sourceLayer = tilesLayer;
    const layerType = 'fill';

    const ensureLayer = (
      id: string,
      color: string,
      opacity: number,
    ) => {
      if (!map.getLayer(baseId) || map.getLayer(id)) return;
      map.addLayer(
        {
          id,
          type: layerType,
          source: sourceId,
          paint: {
            'fill-color': color,
            'fill-opacity': opacity,
            'fill-outline-color': color,
          },
          filter: ['==', ['id'], '__none__'],
          'source-layer': sourceLayer,
        },
        undefined,
      );
    };

    const handleIdle = () => {
      if (!map.getLayer(baseId)) return;
      ensureLayer(`${baseId}-matched`, theme.palette.secondary.light, 0.45);
      ensureLayer(`${baseId}-selected`, theme.palette.primary.main, 0.5);
      ensureLayer(`${baseId}-hovered`, theme.palette.action.hover, 0.6);
    };

    map.on('idle', handleIdle);
    handleIdle();
    return () => {
      map.off('idle', handleIdle);
    };
  }, [mapInstance, baseLayerId, baseSourceId, tilesLayer, theme.palette]);

  useEffect(() => {
    if (!mapInstance) return;
    const map = mapInstance as MapLibreInteractiveMap;
    const updateFilter = (id: string, ids: string[]) => {
      if (!map.getLayer(id)) return;
      if (!ids.length) {
        map.setFilter(id, ['==', ['id'], '__none__']);
        return;
      }
      map.setFilter(id, ['in', ['id'], ...ids]);
    };
    updateFilter(`${baseLayerId}-matched`, matchedIds);
    updateFilter(`${baseLayerId}-selected`, selectedIds);
    updateFilter(`${baseLayerId}-hovered`, hoveredId ? [hoveredId] : []);
  }, [mapInstance, baseLayerId, matchedIds, selectedIds, hoveredId]);

  useEffect(() => {
    if (!mapInstance) return;
    const map = mapInstance as MapLibreInteractiveMap;
    let attached = false;
    const handleMouseMove = (...args: unknown[]) => {
      const event = args[0] as { features?: Array<{ id?: unknown; properties?: Record<string, unknown> }> };
      const feature = event?.features?.[0];
      const featureId = feature ? String(feature.id ?? feature.properties?.id ?? '') : '';
      setHoveredId(featureId || null);
    };
    const handleMouseLeave = () => {
      setHoveredId(null);
    };
    const ensureHandlers = () => {
      if (attached || !map.getLayer(baseLayerId)) return;
      map.on('mousemove', baseLayerId, handleMouseMove);
      map.on('mouseleave', baseLayerId, handleMouseLeave);
      attached = true;
    };
    map.on('idle', ensureHandlers);
    ensureHandlers();
    return () => {
      map.off('idle', ensureHandlers);
      if (attached) {
        map.off('mousemove', baseLayerId, handleMouseMove);
        map.off('mouseleave', baseLayerId, handleMouseLeave);
      }
    };
  }, [mapInstance, baseLayerId, setHoveredId]);

  const renderMapPreview = () => {
    if (!tilesUrl) {
      return (
        <Alert severity="info">
          {t('preview.noTiles', 'No vector tiles are available yet. Run the build to generate tiles.')}
        </Alert>
      );
    }
    return (
      <Box flex={1} minHeight={360} borderRadius={1} overflow="hidden" border="1px solid #e0e0e0">
        <Suspense fallback={null}>
          <LazyMapWithVectorTiles
            tiles={[tilesUrl]}
            layerConfig={{
              layerId: baseLayerId,
              sourceId: baseSourceId,
              sourceLayer: tilesLayer,
              layerType: 'fill',
              paint: {
                'fill-color': theme.palette.grey[300],
                'fill-opacity': 0.3,
                'fill-outline-color': theme.palette.grey[500],
              },
            }}
            initialViewState={DEFAULT_VIEW}
            style={{ width: '100%', height: '100%' }}
            onLoad={setMapInstance}
            identifyFeatureOnClick={{
              layerIds: [baseLayerId],
              disableDefaultSnackbar: true,
              getFeatureId: (feature) => {
                const candidate = feature.id ?? feature.properties?.id;
                return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : null;
              },
              onIdentify: handleMapIdentify,
            }}
          />
        </Suspense>
      </Box>
    );
  };

  return (
    <Box display="flex" flexDirection="column" gap={2} height={480}>
      <Typography variant="h6">{t('preview.title', 'Preview')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('preview.description', 'Visualize generated vector tiles on the map.')}
      </Typography>
      {metadataEnabled ? (
        <>
          <Tabs value={tabIndex} onChange={(_, next) => setTabIndex(next)} variant="scrollable">
            <Tab label={t('preview.tabs.map', 'Map Preview')} />
            <Tab label={t('preview.tabs.metadata', 'Metadata Table')} />
          </Tabs>
          {tabIndex === 0 ? (
            renderMapPreview()
          ) : (
            <Box flex={1} minHeight={360} borderRadius={1} overflow="hidden" border="1px solid #e0e0e0">
              {!sessionId ? (
                <Alert severity="info" sx={{ m: 2 }}>
                  {t('preview.metadata.missingSession', 'Build the dataset to generate metadata.')}
                </Alert>
              ) : metadataRows.length === 0 && !metadataLoading ? (
                <Alert severity="info" sx={{ m: 2 }}>
                  {t('preview.metadata.empty', 'No metadata entries have been generated yet.')}
                </Alert>
              ) : (
                <>
                  <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <SearchField
                      searchText={searchKeyword}
                      handleSearchTextChange={setSearchKeyword}
                      handleSearchCommit={() => undefined}
                      placeholder={t('preview.metadata.searchPlaceholder', 'Search metadata')}
                      ariaLabel="Search metadata"
                    />
                    <Typography variant="body2" color="text.secondary">
                      {searchKeyword
                        ? `${metadataTableRows.length} ${t('preview.metadata.matches', 'Matched')}`
                        : `${metadataTableRows.length} ${t('preview.metadata.rows', 'Rows')}`}
                    </Typography>
                  </Box>
                  <GenericDataGrid
                    columns={metadataColumns}
                    rows={metadataTableRows}
                    maxHeight={360}
                    rowHeight={38}
                    stickyHeader
                    dense
                    hover
                    striped
                    enableVirtualization
                    loading={metadataLoading}
                    error={metadataError ?? undefined}
                    selectable
                    selectionMode="multiple"
                    selectedRows={selectedIdSet}
                    onSelectionChange={(next) => {
                      setSelectedIds(Array.from(next).map(String));
                    }}
                    matchedRows={matchedIdSet}
                    hoveredRows={hoveredIdSet}
                    onRowHover={(_, rowId) => setHoveredId(String(rowId))}
                    onRowLeave={() => setHoveredId(null)}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    rowSx={(state) => {
                      if (state.selected) {
                        return { backgroundColor: theme.palette.primary.light };
                      }
                      if (state.matched) {
                        return {
                          backgroundColor: theme.palette.secondary.light,
                          boxShadow: `inset 3px 0 0 0 ${theme.palette.secondary.main}`,
                        };
                      }
                      if (state.hovered) {
                        return { backgroundColor: theme.palette.action.hover };
                      }
                      return undefined;
                    }}
                    toolbarComponent={<></>}
                  />
                </>
              )}
            </Box>
          )}
        </>
      ) : (
        renderMapPreview()
      )}
      <Snackbar
        open={Boolean(hoverMessage)}
        message={hoverMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        onClose={() => setHoveredId(null)}
      />
    </Box>
  );
};

const LazyMapWithVectorTiles = React.lazy(async () => {
  const mod = await loadMapWithVectorTiles();
  return { default: mod.MapWithVectorTiles };
});
