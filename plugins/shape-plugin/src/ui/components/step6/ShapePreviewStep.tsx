import type React from 'react';
import { useState } from 'react';
import { Box, Typography, Alert, Snackbar, CircularProgress, Paper } from '@mui/material';
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
    featureMetadataRows,
    featureMetadataLoading,
    featureMetadataError,
    featureMetadataLoaded,
    featureSearchKeyword,
    setFeatureSearchKeyword,
    matchedFeatureIdSet,
    selectedFeatureIds,
    setSelectedFeatureIds,
    featureSortColumn,
    featureSortDirection,
    handleFeatureSort,
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
    zoomSnackbarMessage,
    zoomSnackbarOpen,
    handleViewStateChange,
    handleZoomSnackbarClose,
    vectorLayers,
    highlightOverridesByType,
    geoJsonLayers,
    attributionItems,
    mapInstance,
  } = useShapePreviewStepView(data ?? {}, nodeId);
  const renderMapPreview = () => {
    const hasRemoteTiles = Boolean(tilesUrl);
    const hasErrorLines = geoJsonLayers.length > 0;
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
          highlightOverridesByType={highlightOverridesByType}
          showTileBoundaries
          showTileCoordinates
          interaction={{
            enabled: true,
            highlightLayerIds: [baseLayerId],
            search: { enabled: false },
            hover: { enabled: false },
            selection: { enabled: false },
            fitSelection: { enabled: true, padding: 24 },
            snackbar: { enabled: false },
          }}
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
      </Box>
    );
  };


  const renderFeatureDialog = () => (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: { xs: 'calc(100% - 24px)', md: 560 },
        maxWidth: 'calc(100% - 24px)',
        maxHeight: { xs: '55%', md: '70%' },
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 2,
      }}
    >
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle2">
          {t('preview.tabs.features', 'Features')}
        </Typography>
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
          <GenericDataGrid
            columns={featureColumns}
            rows={featureTableRows}
            maxHeight={420}
            tableContainerSx={{
              height: '100%',
              maxHeight: '100%',
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
            selectable
            selectionMode="multiple"
            selectedRows={new Set(selectedFeatureIds)}
            onSelectionChange={(next) => {
              setSelectedFeatureIds(Array.from(next).map(String));
            }}
            sortColumn={featureSortColumn}
            sortDirection={featureSortDirection}
            onSort={handleFeatureSort}
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
        )}
      </Box>
    </Paper>
  );

  return (
    <Box display="flex" flexDirection="column" gap={2} height="100%" minHeight={0} flex={1}>
      <Box flex={1} minHeight={0} position="relative" display="flex">
        {renderMapPreview()}
        {renderFeatureDialog()}
      </Box>
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
