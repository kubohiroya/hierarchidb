import type React from 'react';
import { Box, Typography, Alert, Tabs, Tab, Snackbar, CircularProgress } from '@mui/material';
import { ResourceLayerMap } from '@hierarchidb/ui-map';
import { GenericDataGrid } from '@hierarchidb/ui-grid';
import { SearchField } from '@hierarchidb/ui-search-field';
import { useShapePreviewStepView } from './useShapePreviewStepView.js';
import type { ShapeEntity } from '../../../common/types/index.js';

export type ShapeDialogStepProps = {
  nodeId: string;
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
  disabled?: boolean;
};

export const ShapePreviewStep: React.FC<ShapeDialogStepProps> = ({ data, nodeId }) => {
  const {
    t,
    theme,
    metadataEnabled,
    tabIndex,
    setTabIndex,
    sourceTabIndex,
    mapTabIndex,
    sourceMetadataRows,
    sourceMetadataLoading,
    sourceMetadataError,
    sourceMetadataLoaded,
    featureMetadataRows,
    featureMetadataLoading,
    featureMetadataError,
    featureMetadataLoaded,
    searchKeyword,
    setSearchKeyword,
    featureSearchKeyword,
    setFeatureSearchKeyword,
    matchedIdSet,
    matchedFeatureIdSet,
    selectedIdSet,
    hoveredIdSet,
    setSelectedIds,
    setHoveredId,
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
    hoverMessage,
    tilesUrl,
    tilesAvailable,
    tilesChecking,
    baseLayerId,
    setMapInstance,
    handleMapIdentify,
    defaultView,
    minZoom,
    maxZoom,
    baseMapStyleUrl,
    mapContainerRef,
    metadataPanelRef,
    metadataToolbarRef,
    metadataTableHeight,
    zoomSnackbarMessage,
    zoomSnackbarOpen,
    handleViewStateChange,
    handleZoomSnackbarClose,
    vectorLayers,
    attributionItems,
  } = useShapePreviewStepView(data ?? {}, nodeId);

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
          {t('preview.noTiles', 'No vector tiles are available yet. Run the stage to generate tiles.')}
        </Alert>
      );
    }
    return (
      <Box
        ref={mapContainerRef}
        flex={1}
        minHeight={0}
        height="100%"
        borderRadius={1}
        overflow="hidden"
        border="1px solid #e0e0e0"
        position="relative"
        sx={{ overscrollBehavior: 'contain' }}
      >
        <ResourceLayerMap
          initialViewState={defaultView}
          width="100%"
          height="100%"
          mapStyleUrl={baseMapStyleUrl}
          basemapStyles={[]}
          vectorLayers={vectorLayers}
          geoJsonLayers={[]}
          attributionItems={attributionItems}
          showTileBoundaries
          showTileCoordinates
          mapOptions={{
            interactive: true,
            scrollZoom: true,
            dragPan: true,
            dragRotate: true,
            doubleClickZoom: true,
            touchZoomRotate: true,
            minZoom,
            maxZoom,
          }}
          controls={{
            navigation: { position: 'top-right' },
            scale: { position: 'bottom-left' },
          }}
          onLoad={setMapInstance}
          onViewStateChange={handleViewStateChange}
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
        <Box
          position="absolute"
          top={4}
          left={4}
          zIndex={1}
          sx={{ pointerEvents: 'none' }}
        >
          <Box sx={{ pointerEvents: 'auto', width: 220 }}>
            <SearchField
              searchText={searchKeyword}
              handleSearchTextChange={setSearchKeyword}
              handleSearchCommit={() => undefined}
              placeholder={t('preview.metadata.searchPlaceholder', 'Search metadata')}
              ariaLabel={t('preview.metadata.searchAriaLabel', 'Search metadata')}
            />
          </Box>
        </Box>
      </Box>
    );
  };


  const renderSourceMetadataTable = () => (
    <Box
      ref={metadataPanelRef}
      flex={1}
      minHeight={0}
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
      ) : sourceMetadataRows.length === 0 ? (
        <Alert severity="info" icon={!sourceMetadataLoaded ? <CircularProgress size={16} /> : undefined} sx={{ m: 2, alignItems: 'center' }}>
          {sourceMetadataLoaded
            ? t('preview.metadata.empty', 'No metadata entries have been generated yet.')
            : t('preview.metadata.loading', 'Loading metadata...')}
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
              ariaLabel={t('preview.metadata.searchAriaLabel', 'Search metadata')}
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
              loading={sourceMetadataLoading}
              error={sourceMetadataError ?? undefined}
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
              toolbarComponent={<></>}
            />
          </Box>
        </>
      )}
    </Box>
  );

  const renderFeatureMetadataTable = () => (
    <Box
      ref={metadataPanelRef}
      flex={1}
      minHeight={0}
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
      ) : featureMetadataRows.length === 0 ? (
        <Alert severity="info" icon={!featureMetadataLoaded ? <CircularProgress size={16} /> : undefined} sx={{ m: 2, alignItems: 'center' }}>
          {featureMetadataLoaded
            ? t('preview.metadata.empty', 'No metadata entries have been generated yet.')
            : t('preview.metadata.loading', 'Loading metadata...')}
        </Alert>
      ) : (
        <>
          <Box
            ref={metadataToolbarRef}
            sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}
          >
            <SearchField
              searchText={featureSearchKeyword}
              handleSearchTextChange={setFeatureSearchKeyword}
              handleSearchCommit={() => undefined}
              placeholder={t('preview.metadata.searchPlaceholder', 'Search metadata')}
              ariaLabel={t('preview.metadata.searchAriaLabel', 'Search metadata')}
            />
            <Typography variant="body2" color="text.secondary">
              {featureSearchKeyword
                ? `${featureTableRows.length} ${t('preview.metadata.matches', 'Matched')}`
                : `${featureTableRows.length} ${t('preview.metadata.rows', 'Rows')}`}
            </Typography>
          </Box>
          <Box flex={1} minHeight={0}>
            <GenericDataGrid
              columns={featureColumns}
              rows={featureTableRows}
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
              loading={featureMetadataLoading}
              error={featureMetadataError ?? undefined}
              matchedRows={matchedFeatureIdSet}
              sortColumn={featureSortColumn}
              sortDirection={featureSortDirection}
              onSort={handleFeatureSort}
              rowSx={(state) => {
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
                return undefined;
              }}
              toolbarComponent={<></>}
            />
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <Box display="flex" flexDirection="column" gap={2} height="100%" minHeight={0} flex={1}>
      {metadataEnabled ? (
        <>
          <Tabs value={tabIndex} onChange={(_, next) => setTabIndex(next)} variant="scrollable">
            <Tab label={t('preview.tabs.sources', 'Sources')} />
            <Tab label={t('preview.tabs.features', 'Features')} />
            <Tab label={t('preview.tabs.map', 'Map Preview')} />
          </Tabs>
          {tabIndex === mapTabIndex
            ? renderMapPreview()
            : tabIndex === sourceTabIndex
              ? renderSourceMetadataTable()
              : renderFeatureMetadataTable()}
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
      <Snackbar
        open={zoomSnackbarOpen}
        message={zoomSnackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        autoHideDuration={800}
        onClose={handleZoomSnackbarClose}
      />
    </Box>
  );
};
