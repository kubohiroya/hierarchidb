import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MapAttributionItem, ResourceGeoJsonLayer, ResourceVectorLayer } from '@hierarchidb/ui-map';
import { getDataSourceConfig } from '../../../services/utils/utils.js';
import type { ShapeEntity } from '../../../common/types/index.js';
import { useShapePreviewStep } from './useShapePreviewStep.js';

const LIGHT_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DARK_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export const useShapePreviewStepView = (data: Partial<ShapeEntity>, nodeId: string) => {
  const preview = useShapePreviewStep(data, nodeId);
  const minZoom = 0;
  const maxZoom = 11;
  const baseMapStyleUrl = preview.theme.palette.mode === 'dark'
    ? DARK_BASEMAP_STYLE_URL
    : LIGHT_BASEMAP_STYLE_URL;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const metadataPanelRef = useRef<HTMLDivElement | null>(null);
  const metadataToolbarRef = useRef<HTMLDivElement | null>(null);
  const [metadataTableHeight, setMetadataTableHeight] = useState(0);
  const lastZoomRef = useRef<number | null>(null);
  const [zoomSnackbarMessage, setZoomSnackbarMessage] = useState<string>('');
  const [zoomSnackbarOpen, setZoomSnackbarOpen] = useState(false);

  const handleViewStateChange = useCallback((viewState: { zoom: number }) => {
    const zoom = Number(viewState.zoom);
    if (!Number.isFinite(zoom)) return;
    const lastZoom = lastZoomRef.current;
    if (lastZoom !== null && Math.abs(lastZoom - zoom) < 0.01) return;
    lastZoomRef.current = zoom;
    setZoomSnackbarMessage(preview.t('preview.zoom', 'Zoom: {{zoom}}', { zoom: zoom.toFixed(2) }));
    setZoomSnackbarOpen(true);
  }, [preview.t]);

  const handleZoomSnackbarClose = useCallback(() => {
    setZoomSnackbarOpen(false);
  }, []);

  useEffect(() => {
    if (preview.tabIndex !== preview.mapTabIndex) {
      preview.setMapInstance(null);
    }
  }, [preview.setMapInstance, preview.tabIndex]);

  useLayoutEffect(() => {
    const panel = metadataPanelRef.current;
    if (!panel) return;
    const updateHeight = () => {
      const panelHeight = panel.getBoundingClientRect().height;
      const toolbarHeight = metadataToolbarRef.current?.getBoundingClientRect().height ?? 0;
      const available = Math.max(panelHeight - toolbarHeight, 0);
      setMetadataTableHeight(available);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(panel);
    if (metadataToolbarRef.current) {
      observer.observe(metadataToolbarRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const vectorLayers = useMemo<ResourceVectorLayer[]>(() => {
    if (!preview.nodeId) return [];
    const hasRemoteTiles = Boolean(preview.tilesUrl);
    const tiles = hasRemoteTiles ? [preview.tilesUrl] : undefined;
    return [
      {
        nodeId: String(preview.nodeId),
        nodeType: 'shape' as const,
        tiles,
        dbName: !hasRemoteTiles ? preview.tileDbName : undefined,
        tileDataProvider: !hasRemoteTiles ? preview.tileDataProvider : undefined,
        layerConfig: {
          layerId: preview.baseLayerId,
          sourceId: preview.baseSourceId,
          sourceLayer: preview.tilesLayer,
          layerType: 'fill' as const,
          paint: {
            'fill-color': preview.theme.palette.primary.main,
            'fill-opacity': 0.35,
            'fill-outline-color': preview.theme.palette.primary.dark,
          },
        },
      },
    ];
  }, [
    preview.baseLayerId,
    preview.baseSourceId,
    preview.nodeId,
    preview.theme.palette.primary.dark,
    preview.theme.palette.primary.main,
    preview.tileDataProvider,
    preview.tileDbName,
    preview.tilesLayer,
    preview.tilesUrl,
  ]);

  const attributionItems = useMemo<MapAttributionItem[]>(() => {
    if (!preview.selectionDataSource) return [];
    const config = getDataSourceConfig(preview.selectionDataSource);
    if (!config) return [];
    return [{
      id: `shape:${config.name}`,
      label: config.displayName ?? config.name,
      attribution: config.attribution,
      license: config.license,
      licenseUrl: config.licenseUrl,
    }];
  }, [preview.selectionDataSource]);

  const geoJsonLayers = useMemo<ResourceGeoJsonLayer[]>(() => {
    if (!preview.errorLineCollection || preview.errorLineCollection.features.length === 0) {
      return [];
    }
    const sourceId = 'shape-transform-errors';
    return [
      {
        layerId: 'shape-transform-errors-outline',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': preview.theme.palette.error.main,
          'line-width': 2,
        },
        filter: ['==', ['get', 'ringRole'], 'outline'],
      },
      {
        layerId: 'shape-transform-errors-hole',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': preview.theme.palette.warning.main,
          'line-width': 1.5,
          'line-dasharray': [2, 2],
        },
        filter: ['==', ['get', 'ringRole'], 'hole'],
      },
    ];
  }, [preview.errorLineCollection, preview.theme.palette.error.main, preview.theme.palette.warning.main]);

  return {
    ...preview,
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
  };
};
