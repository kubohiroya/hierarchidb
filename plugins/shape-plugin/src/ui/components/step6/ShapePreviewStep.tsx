import type React from 'react';
import { useLayoutEffect, useState } from 'react';
import { Box, Typography, Alert, Tabs, Tab, Snackbar, CircularProgress, Button } from '@mui/material';
import { FitScreen as FitScreenIcon } from '@mui/icons-material';
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
    errorTabIndex,
    mapTabIndex,
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
    matchedIdSet,
    matchedFeatureIdSet,
    matchedErrorIdSet,
    selectedIdSet,
    hoveredIdSet,
    setSelectedIds,
    setHoveredId,
    selectedErrorIds,
    setSelectedErrorIds,
    sortColumn,
    sortDirection,
    handleSort,
    featureSortColumn,
    featureSortDirection,
    handleFeatureSort,
    errorSortColumn,
    errorSortDirection,
    handleErrorSort,
    metadataColumns,
    metadataTableRows,
    featureColumns,
    featureTableRows,
    errorColumns,
    errorTableRows,
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
    geoJsonLayers,
    attributionItems,
    canFitSelection,
    handleFitSelection,
    mapInstance,
  } = useShapePreviewStepView(data ?? {}, nodeId);
  const [fitControlPosition, setFitControlPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!mapInstance) {
      setFitControlPosition(null);
      return;
    }
    const container = mapInstance.getContainer();
    const controls = container.querySelector('.maplibregl-ctrl-top-right');
    if (!(controls instanceof HTMLElement)) {
      setFitControlPosition(null);
      return;
    }

    const updatePosition = () => {
      const containerRect = container.getBoundingClientRect();
      const controlsRect = controls.getBoundingClientRect();
      setFitControlPosition({
        top: controlsRect.bottom - containerRect.top + 16,
        left: controlsRect.right - containerRect.left,
      });
    };

    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(container);
    observer.observe(controls);
    window.addEventListener('resize', updatePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
    };
  }, [mapInstance]);

  const renderMapPreview = () => {
    const hasRemoteTiles = Boolean(tilesUrl);
    const hasErrorLines = geoJsonLayers.length > 0;
    const mapControlContainer = mapInstance?.getContainer().querySelector('.maplibregl-ctrl-top-right');
    if (!hasRemoteTiles && !tilesAvailable && !hasErrorLines) {
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
          geoJsonLayers={geoJsonLayers}
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
          <Box
            sx={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              maxWidth: 320,
            }}
          >
            <Box sx={{ width: 220 }}>
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
        {mapControlContainer instanceof HTMLElement && fitControlPosition
          ? (
            <Box
              sx={{
                position: 'absolute',
                top: fitControlPosition.top,
                left: fitControlPosition.left,
                transform: 'translateX(-100%)',
                zIndex: 1,
                pointerEvents: 'auto',
              }}
            >
              <Button
                aria-label={t('preview.fitSelection', 'Fit selection')}
                size="large"
                variant="outlined"
                onClick={handleFitSelection}
                disabled={!canFitSelection}
                sx={{
                  minWidth: 0,
                  height: 32,
                  minHeight: 32,
                  padding: 0.5,
                  m: 0.5,
                  bgcolor: 'background.paper',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <FitScreenIcon fontSize="small" />
              </Button>
            </Box>
          )
          : null}
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

  const renderTransformErrorTable = () => (
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
          {t('preview.errors.missingSession', 'Build the dataset to capture transform errors.')}
        </Alert>
      ) : transformErrorRows.length === 0 ? (
        <Alert severity="info" icon={!transformErrorLoaded ? <CircularProgress size={16} /> : undefined} sx={{ m: 2, alignItems: 'center' }}>
          {transformErrorLoaded
            ? t('preview.errors.empty', 'No transform errors have been recorded yet.')
            : t('preview.errors.loading', 'Loading transform errors...')}
        </Alert>
      ) : (
        <>
          <Box
            ref={metadataToolbarRef}
            sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}
          >
            <SearchField
              searchText={errorSearchKeyword}
              handleSearchTextChange={setErrorSearchKeyword}
              handleSearchCommit={() => undefined}
              placeholder={t('preview.errors.searchPlaceholder', 'Search errors')}
              ariaLabel={t('preview.errors.searchAriaLabel', 'Search errors')}
            />
            <Typography variant="body2" color="text.secondary">
              {errorSearchKeyword
                ? `${errorTableRows.length} ${t('preview.errors.matches', 'Matched')}`
                : `${errorTableRows.length} ${t('preview.errors.rows', 'Rows')}`}
            </Typography>
          </Box>
          <Box flex={1} minHeight={0}>
            <GenericDataGrid
              columns={errorColumns}
              rows={errorTableRows}
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
              loading={transformErrorLoading}
              error={transformErrorError ?? undefined}
              selectable
              selectionMode="multiple"
              selectedRows={new Set(selectedErrorIds)}
              onSelectionChange={(next) => {
                setSelectedErrorIds(Array.from(next).map(String));
              }}
              matchedRows={matchedErrorIdSet}
              sortColumn={errorSortColumn}
              sortDirection={errorSortDirection}
              onSort={handleErrorSort}
              rowSx={(state) => {
                if (state.selected) {
                  const selectedBg = theme.palette.primary.light;
                  const selectedText = theme.palette.primary.main;
                  return {
                    backgroundColor: selectedBg,
                    color: selectedText,
                    '& td, & td *': { color: selectedText },
                  };
                }
                if (state.matched) {
                  const matchedBg = theme.palette.warning.light;
                  const matchedText = theme.palette.getContrastText(matchedBg);
                  return {
                    backgroundColor: matchedBg,
                    boxShadow: `inset 3px 0 0 0 ${theme.palette.warning.main}`,
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
            <Tab label={t('preview.tabs.errors', 'Error List')} />
          </Tabs>
          {tabIndex === mapTabIndex
            ? renderMapPreview()
            : tabIndex === sourceTabIndex
              ? renderSourceMetadataTable()
              : tabIndex === errorTabIndex
                ? renderTransformErrorTable()
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
