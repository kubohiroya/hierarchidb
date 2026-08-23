/**
 * Map preview step for Location dialog.
 */

import { FloatingWindow } from '@hierarchidb/components';
import type { NodeId } from '@hierarchidb/core-types';
import {
  DEFAULT_MAP_CONFIG,
  LocationPreviewList,
  MapPreviewShell,
  MapToggleCard,
} from '@hierarchidb/ui-map';
import { LocationCity, LocationOn, Palette } from '@mui/icons-material';
import { Box, Button, LinearProgress } from '@mui/material';
import type React from 'react';
import type { LocationEntity } from '~/common/types/index';
import { LocationPreviewHoverSnackbar } from './LocationMapPreviewMapElements.js';
import {
  LocationAdmin0Formatter,
  LocationTypeFormatter,
} from './LocationMapPreviewStepElements.js';
import { LocationStyleConfigPanel } from './LocationStyleConfigPanel.js';
import { useLocationMapPreviewStep } from './useLocationMapPreviewStep.js';

interface LocationMapPreviewStepProps {
  draft: Partial<LocationEntity>;
  nodeId?: NodeId;
  onUpdate?: (updates: Partial<LocationEntity>) => void;
}

export const LocationMapPreviewStep: React.FC<LocationMapPreviewStepProps> = ({
  draft,
  nodeId,
  onUpdate,
}) => {
  const {
    t,
    initialViewState,
    locationVectorLayers,
    locationGeoJsonLayers,
    attributionItems,
    locationPreviewSnackbarProps,
    hoverMatches,
    handleMapLoad,
    handleMapMoveEnd,
    showIdeGsmProgress,
    ideGsmProgressValue,
    metadataWindowOpen,
    setMetadataWindowOpen,
    displayedMetadataRows,
    displayedMetadataColumns,
    typeFormatterProps,
    admin0FormatterProps,
    metadataLoading,
    metadataLoadingText,
    metadataError,
    selectedMetadataIds,
    handleMetadataSelectionChange,
    recyclingState,
    handleToggleRecycling,
    rowFilterMode,
    setRowFilterMode,
    rowSearchOnly,
    setRowSearchOnly,
    terrainToggleOptions,
    locationTypeSelection,
    handleLocationToggle,
    styleConfigWindow,
    terrainWindow,
  } = useLocationMapPreviewStep({
    draft,
    nodeId,
    onUpdate,
  });

  const admin0ColumnFormatter = (value: unknown, row: Record<string, unknown>) => (
    <LocationAdmin0Formatter {...admin0FormatterProps} value={value} row={row} />
  );

  const typeColumnFormatter = (value: unknown) => (
    <LocationTypeFormatter {...typeFormatterProps} value={value} />
  );

  const terrainToggleOptionNodes = terrainToggleOptions.map((option) => ({
    id: option.id,
    label: option.label,
    icon: <option.Icon fontSize="small" htmlColor={option.iconColor} />,
    labelColor: option.labelColor,
  }));

  return (
    <Box display="flex" flexDirection="column" height="100%" minHeight={0} flex={1}>
      <MapPreviewShell
        mapProps={{
          initialViewState: initialViewState,
          width: '100%',
          height: '100%',
          vectorLayers: locationVectorLayers,
          geoJsonLayers: locationGeoJsonLayers,
          attributionItems,
          snackbar: {
            content: locationPreviewSnackbarProps ? (
              <LocationPreviewHoverSnackbar {...locationPreviewSnackbarProps} />
            ) : undefined,
            open: hoverMatches.length > 0,
            autoHideDuration: null,
            contentSx: {
              backgroundColor: 'transparent',
              boxShadow: 'none',
              border: 'none',
              padding: 0,
            },
          },
          mapOptions: DEFAULT_MAP_CONFIG.interactionOptions,
          onLoad: handleMapLoad,
          onMoveEnd: handleMapMoveEnd,
        }}
        overlay={
          <>
            {showIdeGsmProgress ? (
              <Box position="absolute" top={0} left={0} right={0} zIndex={5}>
                <LinearProgress
                  variant={ideGsmProgressValue == null ? 'indeterminate' : 'determinate'}
                  value={ideGsmProgressValue ?? undefined}
                  sx={{ height: 4 }}
                />
              </Box>
            ) : null}
            {metadataWindowOpen ? (
              <LocationPreviewList
                title={t('mapPreview.metadataTitle', 'Location: metadata')}
                rows={displayedMetadataRows}
                columns={displayedMetadataColumns}
                columnFormatters={{ type: typeColumnFormatter, admin0: admin0ColumnFormatter }}
                loading={metadataLoading}
                loadingText={metadataLoadingText}
                errorText={metadataError}
                selectedRows={selectedMetadataIds}
                onSelectionChange={handleMetadataSelectionChange}
                recyclingState={recyclingState}
                onToggleRecycling={handleToggleRecycling}
                rowFilterConfig={{
                  mode: rowFilterMode,
                  onModeChange: setRowFilterMode,
                  searchOnly: rowSearchOnly,
                  onSearchOnlyChange: setRowSearchOnly,
                  labels: {
                    title: 'Rows',
                    allRows: 'Show all locations in this node',
                    viewportRows: 'Show locations in the current viewport',
                    searchOnly: 'Show only locations matching the search field',
                  },
                }}
                onClose={() => setMetadataWindowOpen(false)}
              />
            ) : (
              <Box position="absolute" top={8} left={8} zIndex={3}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  aria-label={String(t('mapPreview.tabs.metadata', 'Show locations'))}
                  onClick={() => setMetadataWindowOpen(true)}
                >
                  <LocationOn />
                </Button>
              </Box>
            )}
            {styleConfigWindow.windowState.isVisible ? (
              <FloatingWindow
                title="Style Config"
                titleIcon={<Palette fontSize="small" />}
                initialState={styleConfigWindow.windowState}
                onStateChange={styleConfigWindow.handlers.onStateChange}
                onClose={styleConfigWindow.handlers.onClose}
              >
                <Box sx={{ height: '100%', minHeight: 0, overflow: 'auto' }}>
                  <LocationStyleConfigPanel draft={draft} onUpdate={onUpdate} />
                </Box>
              </FloatingWindow>
            ) : null}
            {terrainWindow.windowState.isVisible ? (
              <FloatingWindow
                title="Terrain Types"
                initialState={terrainWindow.windowState}
                onStateChange={terrainWindow.handlers.onStateChange}
                onClose={terrainWindow.handlers.onClose}
              >
                <Box sx={{ height: '100%', minHeight: 0 }}>
                  <MapToggleCard
                    title=""
                    options={terrainToggleOptionNodes}
                    selection={locationTypeSelection}
                    onToggle={handleLocationToggle}
                  />
                </Box>
              </FloatingWindow>
            ) : null}
            {!terrainWindow.windowState.isVisible || !styleConfigWindow.windowState.isVisible ? (
              <Box
                position="absolute"
                top={8}
                right={8}
                zIndex={3}
                display="flex"
                flexDirection="column"
                gap={1}
              >
                {!terrainWindow.windowState.isVisible ? (
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    aria-label="Show terrain types"
                    onClick={terrainWindow.handlers.show}
                  >
                    <LocationCity />
                  </Button>
                ) : null}
                {!styleConfigWindow.windowState.isVisible ? (
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    aria-label="Show style config"
                    onClick={styleConfigWindow.handlers.show}
                  >
                    <Palette />
                  </Button>
                ) : null}
              </Box>
            ) : null}
          </>
        }
      />
    </Box>
  );
};
