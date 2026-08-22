/**
 * @file ResourceLayerMap.tsx
 * @description Map component that composes basemap, vector layers, and style overrides.
 */

import { FloatingWindow } from '@hierarchidb/components';
import {
  Close as CloseIcon,
  FitScreen as FitScreenIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { Box, Button, IconButton, Snackbar } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { createPortal } from 'react-dom';
import { MapPreviewSearchPanel } from '~/preview/MapPreviewSearchPanel';
import { MapPreviewSearchSettingsDialog } from '~/preview/MapPreviewSearchSettingsDialog';
import { MapLibreMap } from './MapLibreMap.js';
import { MapStatsPanel } from './resource-layer-map/MapStatsPanel.js';
import type {
  ResourceGeoJsonLayer,
  ResourceLayerMapProps,
  ResourceVectorLayer,
} from './resource-layer-map/ResourceLayerMap.types.js';
import { useResourceLayerMap } from './useResourceLayerMap.js';
import { VectorTileLayer } from './VectorTileLayer.js';

export type { ResourceLayerMapProps, ResourceVectorLayer, ResourceGeoJsonLayer };

export const ResourceLayerMap: React.FC<ResourceLayerMapProps> = (props) => {
  const {
    baseMapProps,
    mapStyleProps,
    resolvedControls,
    handleMapLoad,
    mapInstance,
    renderLayerEntries,
    statsActive,
    handleTileRequest,
    statsDisplay,
    statsContainer,
    statsPositionStyle,
    statsStore,
    stats,
    statsWindowOpen,
    statsWindowTitle,
    resolvedStatsWindowIcon,
    statsWindowState,
    setStatsWindowState,
    statsWindowProps,
    statsToggleButtonVisible,
    resolvedStatsToggleButtonIcon,
    resolvedStatsToggleButtonPosition,
    searchEnabled,
    searchConfig,
    searchText,
    setSearchText,
    runSearch,
    handleSearchClear,
    setSearchSettingsOpen,
    searchSettingsOpen,
    searchTargets,
    handleSearchTargetToggle,
    fitSelectionEnabled,
    fitControlContainer,
    handleFitSelection,
    selectedMatches,
    effectiveSnackbar,
    snackbarOpen,
    snackbarContent,
    snackbarContentSx,
    anchorOrigin,
    snackbarPositionStyle,
    vectorLayerEntries,
  } = useResourceLayerMap(props);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapLibreMap
        {...baseMapProps}
        {...mapStyleProps}
        onLoad={handleMapLoad}
        controls={resolvedControls}
      >
        {mapInstance &&
          renderLayerEntries.map((entry) => (
            <VectorTileLayer
              key={entry.layerId}
              map={mapInstance}
              dbName={entry.layer.dbName}
              nodeId={entry.layer.nodeId}
              tiles={entry.layer.tiles}
              tileDataProvider={entry.layer.tileDataProvider}
              onTileRequest={statsActive ? handleTileRequest : undefined}
              layerId={entry.layerId}
              sourceId={entry.sourceId}
              promoteId={entry.layer.promoteId}
              featureState={entry.layer.featureState}
              paint={entry.layerPaint}
              layout={entry.layerConfig.layout}
              filter={entry.layerConfig.filter}
              minzoom={entry.layerConfig.minzoom}
              maxzoom={entry.layerConfig.maxzoom}
              layerType={entry.layerType}
              sourceLayer={entry.layerConfig.sourceLayer}
              visible={entry.layerConfig.visible}
            />
          ))}
      </MapLibreMap>
      {statsActive && statsDisplay === 'overlay' && statsContainer
        ? createPortal(
            <Box
              sx={{
                position: 'absolute',
                zIndex: 2,
                pointerEvents: 'none',
                ...statsPositionStyle,
              }}
            >
              <MapStatsPanel
                store={statsStore}
                vectorLayerEntries={vectorLayerEntries}
                renderExtra={stats?.renderExtra}
              />
            </Box>,
            statsContainer
          )
        : null}
      {statsActive && statsDisplay === 'floating' && statsWindowOpen ? (
        <FloatingWindow
          title={statsWindowTitle}
          titleIcon={resolvedStatsWindowIcon ?? undefined}
          initialState={statsWindowState}
          onStateChange={setStatsWindowState}
          onClose={() => setStatsWindowState((prev) => ({ ...prev, isVisible: false }))}
          resizable={statsWindowProps.resizable}
          draggable={statsWindowProps.draggable}
          minWidth={statsWindowProps.minWidth}
          minHeight={statsWindowProps.minHeight}
          maxWidth={statsWindowProps.maxWidth}
          maxHeight={statsWindowProps.maxHeight}
        >
          <MapStatsPanel
            store={statsStore}
            vectorLayerEntries={vectorLayerEntries}
            renderExtra={stats?.renderExtra}
            showTitle={false}
          />
        </FloatingWindow>
      ) : null}
      {statsActive &&
      statsDisplay === 'floating' &&
      statsToggleButtonVisible &&
      !statsWindowOpen ? (
        <Box sx={{ position: 'absolute', zIndex: 3, ...resolvedStatsToggleButtonPosition }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            aria-label="Show data tiles stats"
            onClick={() => setStatsWindowState((prev) => ({ ...prev, isVisible: true }))}
          >
            {resolvedStatsToggleButtonIcon ?? <TuneIcon fontSize="small" />}
          </Button>
        </Box>
      ) : null}
      {searchEnabled && searchConfig?.targetDefinitions ? (
        <>
          <MapPreviewSearchPanel
            searchText={searchText}
            onSearchTextChange={setSearchText}
            onSearch={runSearch}
            onClear={handleSearchClear}
            onOpenSettings={() => setSearchSettingsOpen(true)}
            clearIcon={<CloseIcon fontSize="small" />}
            settingsIcon={<TuneIcon fontSize="small" />}
            showSettingsButton={
              searchConfig.showSettings ?? Boolean(searchConfig.targetGroups?.length)
            }
            placeholder={searchConfig.placeholder}
            showFitScreenButton={false}
          />
          {searchConfig.targetGroups ? (
            <MapPreviewSearchSettingsDialog
              open={searchSettingsOpen}
              searchTargets={searchTargets as Record<string, boolean>}
              targetGroups={searchConfig.targetGroups}
              targetDefinitions={searchConfig.targetDefinitions}
              onClose={() => setSearchSettingsOpen(false)}
              onToggleTarget={(targetId) => handleSearchTargetToggle(targetId)}
            />
          ) : null}
        </>
      ) : null}
      {fitSelectionEnabled && fitControlContainer
        ? createPortal(
            <IconButton
              aria-label="Fit selection"
              onClick={handleFitSelection}
              disabled={selectedMatches.length === 0}
              data-variant="compound"
              sx={{
                width: 29,
                height: 48,
                minWidth: 29,
                minHeight: 48,
                p: 0,
                pr: 0.5,
                m: 0,
                borderRadius: 0,
                bgcolor: 'background.paper',
                color: (theme) =>
                  theme.palette.mode === 'dark'
                    ? theme.palette.grey[300]
                    : theme.palette.text.primary,
                '& .MuiSvgIcon-root': { color: 'inherit' },
                '&.Mui-disabled': {
                  color: (theme) =>
                    theme.palette.mode === 'dark'
                      ? theme.palette.grey[600]
                      : theme.palette.action.disabled,
                },
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <FitScreenIcon fontSize="small" />
            </IconButton>,
            fitControlContainer
          )
        : null}
      {effectiveSnackbar && (
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={effectiveSnackbar.autoHideDuration ?? null}
          message={snackbarContent}
          anchorOrigin={anchorOrigin}
          ContentProps={snackbarContentSx ? { sx: snackbarContentSx as SxProps<Theme> } : undefined}
          sx={snackbarPositionStyle}
        />
      )}
    </Box>
  );
};
