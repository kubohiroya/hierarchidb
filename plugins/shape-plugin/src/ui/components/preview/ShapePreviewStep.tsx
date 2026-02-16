import React from 'react';
import { Box, Alert, Button, CircularProgress, FormControlLabel, LinearProgress, Stack, Switch } from '@mui/material';
import { Hexagon as HexagonIcon, Layers as LayersIcon } from '@mui/icons-material';
import type { MapViewState } from '@hierarchidb/ui-map';
import { MapPreviewShell, ScreenCenterSnackbar, ShapePreviewList } from '@hierarchidb/ui-map';
import { FloatingWindow, useFloatingWindow } from '@hierarchidb/ui-floating-window';
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

const isShapeLayerParentToggle = (toggleId: string): boolean => (
  toggleId === 'adm0' || toggleId === 'adm1' || toggleId === 'adm2'
);

export const ShapePreviewStep: React.FC<ShapeDialogStepProps> = ({ data, nodeId, onChange }) => {
  const [featureWindowOpen, setFeatureWindowOpen] = React.useState(true);
  const lastPersistedViewRef = React.useRef<ShapePreviewMapView | null>(data.previewMapView ?? null);
  const {
    t,
    featureMetadataLoading,
    featureMetadataError,
    featureMetadataLoaded,
    featureListRows,
    displayedFeatureRows,
    featureSearchKeyword,
    setFeatureSearchKeyword,
    errorSummaryById,
    matchedFeatureIdSet,
    selectedFeatureIds,
    setSelectedFeatureIds,
    toggleRecyclingForSelection,
    featureRowFilterMode,
    setFeatureRowFilterMode,
    featureRowSearchOnly,
    setFeatureRowSearchOnly,
    vectorLayerIds,
    setMapInstance,
    handleMapIdentify,
    defaultView,
    minZoom,
    maxZoom,
    mapContainerRef,
    zoomSnackbarMessage,
    zoomSnackbarOpen,
    handleViewStateChange,
    handleZoomSnackbarClose,
    hoverSnackbarContent,
    showMapLoading,
    vectorLayers,
    highlightOverridesByType,
    geoJsonLayers,
    attributionItems,
    shapePreviewLayerVisibility,
    shapePreviewLayerFeatureCounts,
    toggleShapePreviewLayerVisibility,
    shapePreviewLayerToggleItems,
  } = useShapePreviewStepView(data ?? {}, nodeId);
  React.useEffect(() => {
    setFeatureWindowOpen(true);
  }, []);
  React.useEffect(() => {
    lastPersistedViewRef.current = data.previewMapView ?? null;
  }, [data.previewMapView, data.previewMapView?.latitude, data.previewMapView?.longitude, data.previewMapView?.zoom]);

  const layerSetsWindow = useFloatingWindow({
    persistKey: 'hierarchidb:ui:floating-window:shape:layer-sets',
    initialPosition: { x: 320, y: 96 },
    initialSize: { width: 260, height: 420 },
  });

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
  const renderLayerToggleLabel = React.useCallback((item: { id: string; label: string }) => {
    const count = shapePreviewLayerFeatureCounts[item.id as keyof typeof shapePreviewLayerFeatureCounts];
    const countLabel = typeof count === 'number'
      ? count.toLocaleString()
      : t('preview.layerSets.counts.unavailable', '—');
    return (
      <Box display="flex" alignItems="center" justifyContent="space-between" width="100%" gap={1}>
        <Box component="span">{item.label}</Box>
        <Box component="span" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {countLabel}
        </Box>
      </Box>
    );
  }, [shapePreviewLayerFeatureCounts, t]);
  const showLayerSetsReopenButton = !layerSetsWindow.windowState.isVisible;
  const showMetadataReopenButton = !featureWindowOpen;
  const reserveMetadataReopenSlot = showLayerSetsReopenButton && !showMetadataReopenButton;
  const renderMapPreview = () => {
    return (
      <MapPreviewShell
        containerRef={mapContainerRef}
        overlay={(
          <>
            {showMapLoading ? (
              <Box position="absolute" top={0} left={0} right={0} zIndex={5}>
                <LinearProgress sx={{ height: 4 }} />
              </Box>
            ) : null}
            {layerSetsWindow.windowState.isVisible ? (
              <FloatingWindow
                title={t('preview.layerSets.title', 'Layer Sets')}
                titleIcon={<LayersIcon sx={{ fontSize: '1rem', ml: 1 }} />}
                initialState={layerSetsWindow.windowState}
                onStateChange={layerSetsWindow.handlers.onStateChange}
                onClose={layerSetsWindow.handlers.onClose}
                resizable
                minWidth={220}
                minHeight={180}
              >
                <Stack spacing={0.25}>
                  {shapePreviewLayerToggleItems.map((item) => (
                    <FormControlLabel
                      key={item.id}
                      sx={{ ml: 0, mr: 0 }}
                      control={(
                        <Switch
                          size="small"
                          sx={{ ml: isShapeLayerParentToggle(item.id) ? 0 : '16px' }}
                          checked={shapePreviewLayerVisibility[item.id]}
                          onChange={() => toggleShapePreviewLayerVisibility(item.id)}
                        />
                      )}
                      label={renderLayerToggleLabel(item)}
                    />
                  ))}
                </Stack>
              </FloatingWindow>
            ) : null}
            {(showMetadataReopenButton || showLayerSetsReopenButton) ? (
              <Stack position="absolute" top={8} left={8} zIndex={3} spacing={1}>
                {showMetadataReopenButton ? (
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    aria-label={t('preview.metadata.reopenList', 'Show list')}
                    onClick={() => setFeatureWindowOpen(true)}
                  >
                    <HexagonIcon />
                  </Button>
                ) : null}
                {reserveMetadataReopenSlot ? (
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    aria-hidden
                    sx={{ visibility: 'hidden', pointerEvents: 'none' }}
                  >
                    <HexagonIcon />
                  </Button>
                ) : null}
                {showLayerSetsReopenButton ? (
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    aria-label={t('preview.layerSets.reopen', 'Show layer sets')}
                    onClick={layerSetsWindow.handlers.show}
                  >
                    <LayersIcon />
                  </Button>
                ) : null}
              </Stack>
            ) : null}
            <ScreenCenterSnackbar
              open={zoomSnackbarOpen}
              message={zoomSnackbarMessage}
              onClose={handleZoomSnackbarClose}
              containerSx={{ zIndex: 4 }}
            />
          </>
        )}
        mapProps={{
          initialViewState: defaultView,
          width: '100%',
          height: '100%',
          style: { padding: 0 },
          vectorLayers,
          geoJsonLayers,
          attributionItems,
          highlightOverridesByType,
          showTileBoundaries: true,
          showTileCoordinates: true,
          identifyFeatureOnClick: {
            layerIds: vectorLayerIds,
            radius: 12,
            disableDefaultSnackbar: true,
            getFeatureId: (feature) => {
              const candidate = feature.id ?? feature.properties?.id;
              return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : null;
            },
            onIdentify: handleMapIdentify,
          },
          interaction: {
            enabled: true,
            highlightLayerIds: vectorLayerIds,
            search: { enabled: false },
            hover: { enabled: true },
            selection: { enabled: false },
            fitSelection: { enabled: true, padding: 24 },
            snackbar: { enabled: true, position: 'bottom-center', renderContent: hoverSnackbarContent },
          },
          mapOptions: {
            interactive: true,
            scrollZoom: true,
            dragPan: true,
            dragRotate: true,
            doubleClickZoom: true,
            touchZoomRotate: true,
            minZoom,
            maxZoom,
          },
          controls: {
            navigation: { position: 'top-right' },
            scale: { position: 'bottom-left' },
          },
          onViewStateChange: handleViewStateChange,
          onMoveEnd: handleViewStateCommit,
          onLoad: setMapInstance,
        }}
      />
    );
  };


  const renderFeatureDialog = () => {
    if (!featureWindowOpen) return null;
    return (
      <ShapePreviewList
        title={t('preview.metadata.title', 'Shape: metadata')}
        onClose={() => setFeatureWindowOpen(false)}
        rows={displayedFeatureRows}
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
        countText={(() => {
          if (featureRowFilterMode === 'viewport') {
            return `${displayedFeatureRows.length} ${t('preview.metadata.rows', 'Rows')}`;
          }
          const keyword = featureSearchKeyword.trim();
          if (keyword && featureRowSearchOnly) {
            return `${matchedFeatureIdSet.size} ${t('preview.metadata.matches', 'Matched')}`;
          }
          return `${featureListRows.length} ${t('preview.metadata.rows', 'Rows')}`;
        })()}
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
          repairCount: t('preview.metadata.columns.repairCount', 'Repairs'),
          errorMessage: t('preview.metadata.columns.errorMessage', 'Error Message'),
        }}
        statusLabels={{
          failed: t('build.taskStatus.failed', 'Failed'),
          completed: t('build.taskStatus.completed', 'Completed'),
        }}
        onToggleRecycling={toggleRecyclingForSelection}
        rowFilterConfig={{
          mode: featureRowFilterMode,
          onModeChange: setFeatureRowFilterMode,
          searchOnly: featureRowSearchOnly,
          onSearchOnlyChange: setFeatureRowSearchOnly,
          labels: {
            title: 'Rows',
            allRows: 'Show all shapes in this node',
            viewportRows: 'Show shapes in the current viewport',
            searchOnly: 'Show only shapes matching the search field',
          },
        }}
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
