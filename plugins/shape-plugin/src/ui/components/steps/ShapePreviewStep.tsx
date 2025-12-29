import React, { Suspense, useLayoutEffect, useRef, useState } from 'react';
import { Box, Typography, Alert, Tabs, Tab, Snackbar, CircularProgress } from '@mui/material';
import { loadMapWithVectorTiles } from '@hierarchidb/ui-map';
import { GenericDataGrid } from '@hierarchidb/ui-grid';
import { SearchField } from '@hierarchidb/ui-search-field';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { useShapePreviewStep } from '../../hooks/useShapePreviewStep.js';

export const ShapePreviewStep: React.FC<ShapeDialogStepProps> = ({ data }) => {
  const {
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
    matchedIdSet,
    selectedIdSet,
    hoveredIdSet,
    setSelectedIds,
    setHoveredId,
    sortColumn,
    sortDirection,
    handleSort,
    metadataColumns,
    metadataTableRows,
    hoverMessage,
    tilesUrl,
    tilesLayer,
    nodeId,
    tilesAvailable,
    tilesChecking,
    tileDbName,
    tileDataProvider,
    baseLayerId,
    baseSourceId,
    setMapInstance,
    handleMapIdentify,
    defaultView,
  } = useShapePreviewStep(data ?? {});
  const baseMapStyleUrl = theme.palette.mode === 'dark'
    ? DARK_BASEMAP_STYLE_URL
    : LIGHT_BASEMAP_STYLE_URL;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const metadataPanelRef = useRef<HTMLDivElement | null>(null);
  const metadataToolbarRef = useRef<HTMLDivElement | null>(null);
  const [metadataTableHeight, setMetadataTableHeight] = useState(0);

  useLayoutEffect(() => {
    const panel = metadataPanelRef.current;
    if (!panel) return;
    const updateHeight = () => {
      const panelHeight = panel.getBoundingClientRect().height;
      const toolbarHeight = metadataToolbarRef.current?.getBoundingClientRect().height ?? 0;
      const available = Math.max(panelHeight - toolbarHeight, 0);
      setMetadataTableHeight(available);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(panel);
    if (metadataToolbarRef.current) {
      observer.observe(metadataToolbarRef.current);
    }
    return () => observer.disconnect();
  }, [tabIndex]);

  const renderMapPreview = () => {
    const hasRemoteTiles = Boolean(tilesUrl);
    if (!hasRemoteTiles && !tilesAvailable) {
      if (tilesChecking) {
        return (
          <Alert severity="info" icon={<CircularProgress size={16} />} sx={{ alignItems: 'center' }}>
            {t('preview.waiting', 'Vector tiles are being prepared. The map will appear once tiles are ready.')}
          </Alert>
        );
      }
      return (
        <Alert severity="info">
          {t('preview.noTiles', 'No vector tiles are available yet. Run the build to generate tiles.')}
        </Alert>
      );
    }
    const tiles = hasRemoteTiles ? [tilesUrl] : undefined;
    return (
      <Box
        ref={mapContainerRef}
        flex={1}
        minHeight={420}
        borderRadius={1}
        overflow="hidden"
        border="1px solid #e0e0e0"
        sx={{ overscrollBehavior: 'contain' }}
      >
        <Suspense fallback={null}>
          <LazyMapWithVectorTiles
            tiles={tiles}
            dbName={!hasRemoteTiles ? tileDbName : undefined}
            nodeId={!hasRemoteTiles ? nodeId ?? undefined : undefined}
            tileDataProvider={!hasRemoteTiles ? tileDataProvider : undefined}
            mapOptions={{
              interactive: true,
              scrollZoom: true,
              dragPan: true,
              dragRotate: true,
              doubleClickZoom: true,
              touchZoomRotate: true,
            }}
            controls={{ navigation: true }}
            layerConfig={{
              layerId: baseLayerId,
              sourceId: baseSourceId,
              sourceLayer: tilesLayer,
              layerType: 'fill',
              paint: {
                'fill-color': theme.palette.primary.main,
                'fill-opacity': 0.35,
                'fill-outline-color': theme.palette.primary.dark,
              },
            }}
            initialViewState={defaultView}
            mapStyleUrl={baseMapStyleUrl}
            width="100%"
            height="100%"
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
    <Box display="flex" flexDirection="column" gap={2} height="100%" minHeight={520}>
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
            <Box
              ref={metadataPanelRef}
              flex={1}
              minHeight={420}
              display="flex"
              flexDirection="column"
              borderRadius={1}
              overflow="hidden"
              border="1px solid #e0e0e0"
              sx={{ overscrollBehavior: 'contain' }}
            >
              {!nodeId ? (
                <Alert severity="info" sx={{ m: 2 }}>
                  {t('preview.metadata.missingSession', 'Build the dataset to generate metadata.')}
                </Alert>
              ) : metadataRows.length === 0 && !metadataLoading ? (
                <Alert severity="info" sx={{ m: 2 }}>
                  {t('preview.metadata.empty', 'No metadata entries have been generated yet.')}
                </Alert>
              ) : (
                <>
                  <Box
                    ref={metadataToolbarRef}
                    sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}
                  >
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
                  <Box flex={1} minHeight={0}>
                    <GenericDataGrid
                      columns={metadataColumns}
                      rows={metadataTableRows}
                      maxHeight={metadataTableHeight || 360}
                      tableContainerSx={{
                        height: metadataTableHeight || 360,
                        maxHeight: metadataTableHeight || 360,
                        overflowY: 'auto',
                        overflowX: 'auto',
                        overscrollBehavior: 'contain',
                        WebkitOverflowScrolling: 'touch',
                      }}
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
                  </Box>
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
        autoHideDuration={3600}
        onClose={() => setHoveredId(null)}
      />
    </Box>
  );
};

const LazyMapWithVectorTiles = React.lazy(async () => {
  const mod = await loadMapWithVectorTiles();
  return { default: mod.MapWithVectorTiles };
});

const LIGHT_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DARK_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
