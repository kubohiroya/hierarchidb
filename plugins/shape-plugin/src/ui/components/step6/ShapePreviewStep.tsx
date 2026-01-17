import type React from 'react';
import { Box, Alert, Snackbar, CircularProgress } from '@mui/material';
import { ResourceLayerMap, ShapePreviewList } from '@hierarchidb/ui-map';
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
    featureMetadataLoading,
    featureMetadataError,
    featureMetadataLoaded,
    featureMetadataRows,
    featureSearchKeyword,
    setFeatureSearchKeyword,
    errorSummaryById,
    matchedFeatureIdSet,
    selectedFeatureIds,
    setSelectedFeatureIds,
    setHoveredId,
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
    <ShapePreviewList
      title={t('preview.tabs.features', 'Features')}
      rows={featureMetadataRows}
      columnLabels={{
        featureId: t('preview.metadata.columns.featureId', 'Feature ID'),
        countryName: t('preview.metadata.columns.countryName', 'Country'),
        countryCode: t('preview.metadata.columns.countryCode', 'Country Code'),
        adminName: t('preview.metadata.columns.adminName', 'Admin Name'),
        adminLevel: t('preview.metadata.columns.adminLevel', 'Admin Level'),
        adminCode: t('preview.metadata.columns.adminCode', 'Admin Code'),
        dataSource: t('preview.metadata.columns.dataSource', 'Data Source'),
        createdAt: t('preview.metadata.columns.createdAt', 'Created At'),
        vertexCount: t('preview.metadata.columns.vertexCount', 'Vertices'),
        polygonCount: t('preview.metadata.columns.polygonCount', 'Polygons'),
        bbox: t('preview.metadata.columns.bbox', 'Bounding Box'),
        area: t('preview.metadata.columns.area', 'Area'),
      }}
      search={{
        value: featureSearchKeyword,
        onChange: setFeatureSearchKeyword,
        placeholder: t('preview.metadata.searchPlaceholder', 'Search metadata'),
        ariaLabel: t('preview.metadata.searchAriaLabel', 'Search metadata'),
      }}
      countLabels={{
        matched: t('preview.metadata.matches', 'Matched'),
        rows: t('preview.metadata.rows', 'Rows'),
      }}
      loading={featureMetadataLoading}
      error={featureMetadataError ?? undefined}
      matchedRows={matchedFeatureIdSet}
      selectedRows={new Set(selectedFeatureIds)}
      onSelectionChange={(next) => {
        setSelectedFeatureIds(Array.from(next).map(String));
      }}
      emptyContent={!nodeId ? (
        <Alert severity="info" sx={{ m: 2 }}>
          {t('preview.metadata.missingSession', 'Build the dataset to generate metadata.')}
        </Alert>
      ) : (
        <Alert severity="info" icon={!featureMetadataLoaded ? <CircularProgress size={16} /> : undefined} sx={{ m: 2, alignItems: 'center' }}>
          {featureMetadataLoaded
            ? t('preview.metadata.empty', 'No metadata entries have been generated yet.')
            : t('preview.metadata.loading', 'Loading metadata...')}
        </Alert>
      )}
      errorSummaryById={errorSummaryById}
      errorColumnLabels={{
        status: t('preview.metadata.columns.status', 'Status'),
        errorCount: t('preview.metadata.columns.errorCount', 'Errors'),
        errorMessage: t('preview.metadata.columns.errorMessage', 'Error Message'),
      }}
      statusLabels={{
        failed: t('build.taskStatus.failed', 'Failed'),
        completed: t('build.taskStatus.completed', 'Completed'),
      }}
    />
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
