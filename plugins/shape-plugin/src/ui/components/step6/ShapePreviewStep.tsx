import React from 'react';
import { Box, Alert, Button, CircularProgress, Typography, Paper } from '@mui/material';
import { TableRows as TableRowsIcon } from '@mui/icons-material';
import type { MapViewState } from '@hierarchidb/ui-map';
import { LayerSetVisibilityPanel, ResourceLayerMap, ScreenCenterSnackbar, ShapePreviewList } from '@hierarchidb/ui-map';
import { useShapePreviewStepView } from './useShapePreviewStepView.js';
import type { ShapeEntity, ShapePreviewMapView } from '../../../common/types/index.js';

export type ShapeDialogStepProps = {
  nodeId: string;
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
  disabled?: boolean;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const arePreviewViewsClose = (a?: ShapePreviewMapView | null, b?: ShapePreviewMapView | null): boolean => {
  if (!a || !b) return false;
  const eps = 1e-6;
  return (
    Math.abs(a.longitude - b.longitude) < eps &&
    Math.abs(a.latitude - b.latitude) < eps &&
    Math.abs(a.zoom - b.zoom) < eps
  );
};

const toPreviewMapView = (viewState: MapViewState): ShapePreviewMapView | null => {
  const { longitude, latitude, zoom } = viewState;
  if (!isFiniteNumber(longitude) || !isFiniteNumber(latitude) || !isFiniteNumber(zoom)) {
    return null;
  }
  return { longitude, latitude, zoom };
};

export const ShapePreviewStep: React.FC<ShapeDialogStepProps> = ({ data, nodeId, onChange }) => {
  const [featureWindowOpen, setFeatureWindowOpen] = React.useState(true);
  const lastPersistedViewRef = React.useRef<ShapePreviewMapView | null>(data.previewMapView ?? null);
  const {
    t,
    featureMetadataLoading,
    featureMetadataError,
    featureMetadataLoaded,
    featureListRows,
    featureSearchKeyword,
    setFeatureSearchKeyword,
    errorSummaryById,
    matchedFeatureIdSet,
    selectedFeatureIds,
    setSelectedFeatureIds,
    vectorLayerIds,
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
    tileLayerNames,
    resolvedLayerNames,
    layerSetVisibility,
    toggleLayerSetVisibility,
    layerSetItems,
    availableLayerSets,
  } = useShapePreviewStepView(data ?? {}, nodeId);
  React.useEffect(() => {
    setFeatureWindowOpen(true);
  }, [nodeId]);
  React.useEffect(() => {
    lastPersistedViewRef.current = data.previewMapView ?? null;
  }, [data.previewMapView?.latitude, data.previewMapView?.longitude, data.previewMapView?.zoom]);

  const handleViewStateCommit = React.useCallback(
    (viewState: MapViewState) => {
      const next = toPreviewMapView(viewState);
      if (!next) return;
      if (arePreviewViewsClose(lastPersistedViewRef.current, next)) return;
      lastPersistedViewRef.current = next;
      onChange({ previewMapView: next });
    },
    [onChange],
  );
  const renderMapPreview = () => {
    return (
      <Box
        ref={mapContainerRef}
        flex={1}
        minHeight={0}
        height="100%"
        borderRadius={1}
        overflow="hidden"
        position="relative"
        sx={{ overscrollBehavior: 'contain', p: 0 }}
      >
        <Box position="absolute" top={12} right={12} zIndex={3} sx={{ pointerEvents: 'auto' }}>
          <Paper
            elevation={3}
            sx={{
              px: 1.5,
              py: 1,
              minWidth: 220,
              bgcolor: 'background.paper',
              color: 'text.primary',
              opacity: 0.92,
            }}
          >
            <LayerSetVisibilityPanel
              title={t('preview.layerSets.title', 'Layer Sets')}
              layerSets={availableLayerSets}
              visibility={layerSetVisibility}
              onToggle={toggleLayerSetVisibility}
              items={layerSetItems}
            />
          </Paper>
        </Box>
        <ResourceLayerMap
          initialViewState={defaultView}
          width="100%"
          height="100%"
          mapStyleUrl={baseMapStyleUrl}
          basemapStyles={[]}
          style={{ padding: 0 }}
          vectorLayers={vectorLayers}
          geoJsonLayers={geoJsonLayers}
          attributionItems={attributionItems}
          highlightOverridesByType={highlightOverridesByType}
          stats={{
            enabled: true,
            position: 'top-left',
            renderExtra: () => (
              <>
                <Typography variant="caption" fontWeight={700} display="block">
                  Vector Tile Layers
                </Typography>
                <Typography variant="caption" display="block">
                  Available: {tileLayerNames.length ? tileLayerNames.join(', ') : '(none detected)'}
                </Typography>
                <Typography variant="caption" display="block">
                  admin0: {resolvedLayerNames.admin0 ? `${resolvedLayerNames.admin0}${resolvedLayerNames.admin0IsBoundary ? ' (boundary)' : ''}` : 'n/a'}
                </Typography>
                {resolvedLayerNames.admin1 && (
                  <Typography variant="caption" display="block">
                    admin1: {`${resolvedLayerNames.admin1}${resolvedLayerNames.admin1IsBoundary ? ' (boundary)' : ''}`}
                  </Typography>
                )}
              </>
            ),
          }}
          showTileBoundaries
          showTileCoordinates
          interaction={{
            enabled: true,
            highlightLayerIds: vectorLayerIds,
            search: { enabled: false },
            hover: { enabled: true },
            selection: { enabled: false },
            fitSelection: { enabled: true, padding: 24 },
            snackbar: { enabled: true, position: 'bottom-center' },
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
          onMoveEnd={handleViewStateCommit}
          identifyFeatureOnClick={{
            layerIds: vectorLayerIds,
            disableDefaultSnackbar: true,
            getFeatureId: (feature) => {
              const candidate = feature.id ?? feature.properties?.id;
              return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : null;
            },
            onIdentify: handleMapIdentify,
          }}
        />
        <ScreenCenterSnackbar
          open={zoomSnackbarOpen}
          message={zoomSnackbarMessage}
          onClose={handleZoomSnackbarClose}
          containerSx={{ zIndex: 4 }}
        />
        {!featureWindowOpen && (
          <Box position="absolute" top={8} left={8} zIndex={3}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              aria-label={t('preview.metadata.reopenList', 'Show list')}
              onClick={() => setFeatureWindowOpen(true)}
            >
              <TableRowsIcon />
            </Button>
          </Box>
        )}
      </Box>
    );
  };


  const renderFeatureDialog = () => {
    if (!featureWindowOpen) return null;
    return (
      <ShapePreviewList
        title={t('preview.tabs.features', 'Features')}
        rows={featureListRows}
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
        loading={featureMetadataLoading && !featureMetadataLoaded}
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
        onClose={() => setFeatureWindowOpen(false)}
      />
    );
  };

  return (
    <Box display="flex" flexDirection="column" gap={2} height="100%" minHeight={0} flex={1}>
      <Box flex={1} minHeight={0} position="relative" display="flex">
        {renderMapPreview()}
        {renderFeatureDialog()}
      </Box>
    </Box>
  );
};
