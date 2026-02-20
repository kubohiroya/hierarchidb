/**
 * @file ResourceLayerMap.tsx
 * @description Map component that composes basemap, vector layers, and style overrides.
 */

import { Box, Button, IconButton, Snackbar } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { Close as CloseIcon, FitScreen as FitScreenIcon, Tune as TuneIcon } from '@mui/icons-material';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { DEFAULT_MAP_CONFIG } from '~/types/unified-map-props';
import type { MapLibreMapInstance } from '~/types/maplibre-public';
import type { ResourceLayerMapProps, ResourceGeoJsonLayer, ResourceVectorLayer } from './resource-layer-map/ResourceLayerMap.types.js';
import { VectorTileLayer } from './VectorTileLayer.js';
import { MapLibreMap } from './MapLibreMap.js';
import { FloatingWindow, type WindowState } from '@hierarchidb/ui-floating-window';
import { MapPreviewSearchPanel } from '~/preview/MapPreviewSearchPanel';
import { MapPreviewSearchSettingsDialog } from '~/preview/MapPreviewSearchSettingsDialog';
import { useResourceLayerMapStats } from './useResourceLayerMapStats.js';
import { useMapLayerRuntime } from './resource-layer-map/useMapLayerRuntime.js';
import { useGeoJsonLayerSync } from './resource-layer-map/useGeoJsonLayerSync.js';
import {
  buildDefaultHighlightOverrides,
  buildHoverSnackbarContent,
  isRenderableNode,
  pickStyleOverrides,
  sortByLayerPriority,
  sortByPath,
} from './resource-layer-map/resourceLayerMapHelpers.js';
import { useResourceLayerMapInteractions } from './resource-layer-map/useResourceLayerMapInteractions.js';
import { MapStatsPanel, DEFAULT_STATS_WINDOW_STATE } from './resource-layer-map/MapStatsPanel.js';

export type { ResourceLayerMapProps, ResourceVectorLayer, ResourceGeoJsonLayer };

export const ResourceLayerMap: React.FC<ResourceLayerMapProps> = (props) => {
  const theme = useTheme();
  const {
    basemapStyles,
    vectorLayers,
    geoJsonLayers,
    styleOverrides,
    styleOverridesByType,
    highlightOverridesByType,
    hoveredFeatures,
    snackbar,
    interaction,
    mapStyleUrl,
    mapStyleObject,
    onLoad,
    attributionItems,
    controls,
    stats,
    ...baseMapProps
  } = props as ResourceLayerMapProps & {
    mapStyleUrl?: string;
    mapStyleObject?: import('~/types/maplibre-public').MapLibreStyle;
  };

  const resolvedControls = useMemo(() => {
    if (!attributionItems || attributionItems.length === 0) return controls;
    if (controls?.attribution === false) return controls;
    const existing = typeof controls?.attribution === 'object' ? controls.attribution : {};
    return {
      ...controls,
      attribution: {
        ...existing,
        items: attributionItems,
      },
    };
  }, [attributionItems, controls]);

  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const mapInstanceRef = useRef<MapLibreMapInstance | null>(null);

  const orderedBasemaps = useMemo(() => (basemapStyles ? sortByPath(basemapStyles) : []), [basemapStyles]);
  const orderedLayers = useMemo(() => sortByLayerPriority(vectorLayers), [vectorLayers]);
  const orderedGeoJsonLayers = useMemo(
    () => (geoJsonLayers ? sortByLayerPriority(geoJsonLayers) : []),
    [geoJsonLayers],
  );

  const fitSelectionEnabled =
    (interaction ? (interaction.enabled ?? true) : false) && (interaction?.fitSelection?.enabled ?? true);
  const searchConfig = interaction?.search;

  useGeoJsonLayerSync({ mapInstance, orderedGeoJsonLayers });
  const { mapControlContainer, fitControlContainer } = useMapLayerRuntime({
    mapInstance,
    fitSelectionEnabled,
    mapInstanceRef,
  });

  const renderLayerEntries = useMemo(
    () => orderedLayers.map((layer) => {
      const layerConfig = { ...DEFAULT_MAP_CONFIG.vectorTileLayer, ...layer.layerConfig };
      const layerType = layerConfig.layerType ?? 'fill';
      const paintOverrides = pickStyleOverrides(layerType, styleOverrides, styleOverridesByType);
      const baseLayerPaint = { ...(layerConfig.paint ?? {}), ...paintOverrides };
      const highlightOverrides =
        highlightOverridesByType?.[layerType]
        ?? buildDefaultHighlightOverrides(layerType, baseLayerPaint, theme);
      const layerPaint = { ...baseLayerPaint, ...highlightOverrides };
      const layerId = layerConfig.layerId ?? `resource-layer-${layer.nodeId}`;
      const sourceId = layerConfig.sourceId ?? `resource-source-${layer.nodeId}`;
      return {
        layer,
        layerConfig,
        layerType,
        layerPaint,
        layerId,
        sourceId,
      };
    }),
    [orderedLayers, styleOverrides, styleOverridesByType, highlightOverridesByType, theme],
  );

  const statsEnabled = Boolean(stats?.enabled);
  const statsPosition = stats?.position ?? 'top-left';
  const statsDisplay = stats?.display ?? 'overlay';
  const statsWindowConfig = stats?.floatingWindow;
  const statsWindowTitle = statsWindowConfig?.title ?? 'Dexie Tile Stats';
  const statsWindowIcon = statsWindowConfig?.titleIcon;
  const statsWindowInitialState = statsWindowConfig?.initialState ?? DEFAULT_STATS_WINDOW_STATE;
  const [statsWindowState, setStatsWindowState] = useState<WindowState>(() => ({
    position: statsWindowInitialState.position,
    size: statsWindowInitialState.size,
    isMinimized: statsWindowInitialState.isMinimized ?? false,
    isFullscreen: statsWindowInitialState.isFullscreen ?? false,
    isVisible: statsWindowInitialState.isVisible !== false,
    zIndex: statsWindowInitialState.zIndex ?? 1000,
  }));
  const statsWindowProps = {
    resizable: statsWindowConfig?.resizable ?? false,
    draggable: statsWindowConfig?.draggable ?? true,
    minWidth: statsWindowConfig?.minWidth ?? 220,
    minHeight: statsWindowConfig?.minHeight ?? 140,
    maxWidth: statsWindowConfig?.maxWidth,
    maxHeight: statsWindowConfig?.maxHeight,
  };
  const statsToggleButtonVisible = statsWindowConfig?.showToggleButton ?? false;
  const statsToggleButtonIcon = statsWindowConfig?.toggleButtonIcon ?? statsWindowIcon ?? <TuneIcon fontSize="small" />;
  const resolvedStatsWindowIcon = isRenderableNode(statsWindowIcon) ? statsWindowIcon : null;
  const resolvedStatsToggleButtonIcon = isRenderableNode(statsToggleButtonIcon) ? statsToggleButtonIcon : null;
  const statsWindowOpen = statsWindowState.isVisible !== false;
  const statsToggleButtonPosition = useMemo(
    () => statsWindowConfig?.toggleButtonPosition ?? { top: 12, left: 12 },
    [statsWindowConfig?.toggleButtonPosition],
  );
  const resolvedStatsToggleButtonPosition = useMemo(() => {
    if (!mapControlContainer || statsToggleButtonPosition.top == null || statsToggleButtonPosition.right == null) {
      return statsToggleButtonPosition;
    }
    const rect = mapControlContainer.getBoundingClientRect();
    const offset = Number.isFinite(rect.height) ? rect.height : 0;
    if (offset <= 0) return statsToggleButtonPosition;
    const adjustedTop = Math.max(statsToggleButtonPosition.top, offset + 8);
    if (adjustedTop === statsToggleButtonPosition.top) return statsToggleButtonPosition;
    return { ...statsToggleButtonPosition, top: adjustedTop };
  }, [mapControlContainer, statsToggleButtonPosition]);

  const resolvedBaseStyle = useMemo(() => {
    if (orderedBasemaps.length) return orderedBasemaps[0]?.style;
    if (mapStyleObject) return mapStyleObject;
    return mapStyleUrl ?? DEFAULT_MAP_CONFIG.mapStyleUrl;
  }, [mapStyleObject, mapStyleUrl, orderedBasemaps]);
  const mapStyleProps =
    typeof resolvedBaseStyle === 'string'
      ? { mapStyleUrl: resolvedBaseStyle }
      : { mapStyleObject: resolvedBaseStyle };

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    setMapInstance(map);
    onLoad?.(map);
  }, [onLoad]);

  const {
    searchEnabled,
    searchText,
    setSearchText,
    searchTargets,
    vectorLayerEntries,
    selectedMatches,
    snackbarFeatures,
    effectiveSnackbar,
    runSearch,
    handleSearchClear,
    handleSearchTargetToggle,
    handleFitSelection,
    snackbarEnabled,
  } = useResourceLayerMapInteractions({
    mapInstance,
    interaction,
    orderedLayers,
    orderedGeoJsonLayers,
    hoveredFeatures,
    snackbar,
  });

  const {
    statsActive,
    statsContainer,
    statsPositionStyle,
    statsStore,
    handleTileRequest,
  } = useResourceLayerMapStats({
    mapInstance,
    orderedLayers,
    vectorLayerEntries,
    statsEnabled,
    statsPosition,
  });

  const snackbarPosition = effectiveSnackbar?.position ?? 'bottom-center';
  const anchorOrigin = (() => {
    switch (snackbarPosition) {
      case 'top':
        return { vertical: 'top', horizontal: 'center' } as const;
      case 'bottom':
        return { vertical: 'bottom', horizontal: 'center' } as const;
      case 'bottom-center':
        return { vertical: 'bottom', horizontal: 'center' } as const;
      case 'top-left':
        return { vertical: 'top', horizontal: 'left' } as const;
      case 'top-right':
        return { vertical: 'top', horizontal: 'right' } as const;
      case 'bottom-left':
        return { vertical: 'bottom', horizontal: 'left' } as const;
      case 'bottom-right':
        return { vertical: 'bottom', horizontal: 'right' } as const;
      default:
        return { vertical: 'bottom', horizontal: 'center' } as const;
    }
  })();

  const snackbarContentSx = effectiveSnackbar?.contentSx;
  const snackbarPositionStyle = (() => {
    const base = { position: 'absolute' as const, zIndex: 4 } as const;
    switch (snackbarPosition) {
      case 'top':
        return { ...base, top: 16, left: '50%', transform: 'translateX(-50%)' };
      case 'top-left':
        return { ...base, top: 16, left: 16 };
      case 'top-right':
        return { ...base, top: 16, right: 16 };
      case 'bottom-left':
        return { ...base, bottom: 16, left: 16 };
      case 'bottom-right':
        return { ...base, bottom: 16, right: 16 };
      case 'bottom':
      case 'bottom-center':
        return { ...base, bottom: 16, left: '50%', transform: 'translateX(-50%)' };
      default:
        return { ...base, bottom: 16, left: '50%', transform: 'translateX(-50%)' };
    }
  })();

  const rawSnackbarContent =
    effectiveSnackbar?.content
    ?? effectiveSnackbar?.renderContent?.(snackbarFeatures)
    ?? buildHoverSnackbarContent(snackbarFeatures);
  const snackbarContent: ReactNode = isRenderableNode(rawSnackbarContent) ? rawSnackbarContent : '';
  const snackbarOpen = effectiveSnackbar?.open ?? (snackbarEnabled && snackbarFeatures.length > 0);

  const [searchSettingsOpen, setSearchSettingsOpen] = useState(false);

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
      {statsActive && statsDisplay === 'overlay' && statsContainer ? (
        createPortal(
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
          statsContainer,
        )
      ) : null}
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
      {statsActive && statsDisplay === 'floating' && statsToggleButtonVisible && !statsWindowOpen ? (
        <Box sx={{ position: 'absolute', zIndex: 3, ...resolvedStatsToggleButtonPosition }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            aria-label="Show data tiles stats"
            onClick={() => setStatsWindowState((prev) => ({ ...prev, isVisible: true }))}
          >
            {resolvedStatsToggleButtonIcon}
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
            showSettingsButton={searchConfig.showSettings ?? Boolean(searchConfig.targetGroups?.length)}
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
      {fitSelectionEnabled && fitControlContainer ? (
        createPortal(
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
                theme.palette.mode === 'dark' ? theme.palette.grey[300] : theme.palette.text.primary,
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
          fitControlContainer,
        )
      ) : null}
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
