import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from '@mui/material/styles';
import type { MapLibreMapInstance } from '~/types/maplibre-public';
import { DEFAULT_MAP_CONFIG } from '~/types/unified-map-props';
import type { ResourceLayerMapProps } from './resource-layer-map/ResourceLayerMap.types.js';
import {
  buildDefaultHighlightOverrides,
  buildHoverSnackbarContent,
  isRenderableNode,
  pickStyleOverrides,
  sortByLayerPriority,
  sortByPath,
} from './resource-layer-map/resourceLayerMapHelpers.js';
import { useGeoJsonLayerSync } from './resource-layer-map/useGeoJsonLayerSync.js';
import { useMapLayerRuntime } from './resource-layer-map/useMapLayerRuntime.js';
import { useResourceLayerMapInteractions } from './resource-layer-map/useResourceLayerMapInteractions.js';
import { DEFAULT_STATS_WINDOW_STATE } from './resource-layer-map/MapStatsPanel.js';
import { useResourceLayerMapStats } from './useResourceLayerMapStats.js';
import type { WindowState } from '@hierarchidb/components';

export function useResourceLayerMap(props: ResourceLayerMapProps) {
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
  } = props;

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
  const statsToggleButtonIcon = statsWindowConfig?.toggleButtonIcon ?? statsWindowIcon;
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

  return {
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
  };
}
