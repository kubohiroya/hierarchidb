import { useCallback, useMemo, useRef, useState } from 'react';
import type { MapAttributionItem, ResourceGeoJsonLayer, ResourceVectorLayer } from '@hierarchidb/ui-map';
import { getDataSourceConfig } from '../../../services/utils/utils.js';
import type { ShapeEntity } from '../../../common/types/index.js';
import { useShapePreviewStep } from './useShapePreviewStep.js';

const LIGHT_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DARK_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

type ResolvedVectorTileLayer = { name: string | null; isBoundary: boolean };

const isBoundaryLayer = (name: string): boolean => name.toLowerCase().endsWith('-boundary');

const resolveVectorTileLayer = (
  layerNames: string[],
  target: string,
  options?: { allowFallback?: boolean },
): ResolvedVectorTileLayer => {
  if (!layerNames.length) return { name: null, isBoundary: false };
  const targetLower = target.toLowerCase();
  const matchesTarget = (name: string) => {
    const lower = name.toLowerCase();
    if (lower === targetLower) return true;
    if (lower.endsWith(targetLower)) return true;
    if (lower.includes(targetLower)) return true;
    return false;
  };
  const nonBoundary = layerNames.filter((name) => !isBoundaryLayer(name));
  const boundary = layerNames.filter((name) => isBoundaryLayer(name));
  const pickMatch = (names: string[]) => names.find(matchesTarget) ?? null;
  const nonBoundaryMatch = pickMatch(nonBoundary);
  if (nonBoundaryMatch) return { name: nonBoundaryMatch, isBoundary: false };
  const boundaryMatch = pickMatch(boundary);
  if (boundaryMatch) return { name: boundaryMatch, isBoundary: true };
  if (!options?.allowFallback) return { name: null, isBoundary: false };
  if (nonBoundary.length) return { name: nonBoundary[0] ?? null, isBoundary: false };
  if (boundary.length) return { name: boundary[0] ?? null, isBoundary: true };
  return { name: null, isBoundary: false };
};



export const useShapePreviewStepView = (data: Partial<ShapeEntity>, nodeId: string) => {
  const preview = useShapePreviewStep(data, nodeId);
  const minZoom = 0;
  const maxZoom = 11;
  const baseMapStyleUrl = preview.theme.palette.mode === 'dark'
    ? DARK_BASEMAP_STYLE_URL
    : LIGHT_BASEMAP_STYLE_URL;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
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

  const vectorLayers = useMemo<ResourceVectorLayer[]>(() => {
    if (!preview.nodeId) return [];
    const hasRemoteTiles = Boolean(preview.tilesUrl);
    const tiles = hasRemoteTiles ? [preview.tilesUrl] : undefined;
    const tileLayerNames = preview.tileLayerNames ?? [];
    const fallbackLayerName = preview.tilesLayer ?? 'admin0';
    const resolvedAdmin0 = tileLayerNames.length
      ? resolveVectorTileLayer(tileLayerNames, 'admin0', { allowFallback: true })
      : { name: fallbackLayerName, isBoundary: false };
    const resolvedAdmin1 = tileLayerNames.length
      ? resolveVectorTileLayer(tileLayerNames, 'admin1', { allowFallback: false })
      : { name: 'admin1', isBoundary: false };
    const baseLayer = {
      nodeId: String(preview.nodeId),
      nodeType: 'shape' as const,
      tiles,
      dbName: !hasRemoteTiles ? preview.tileDbName : undefined,
      tileDataProvider: !hasRemoteTiles ? preview.tileDataProvider : undefined,
      promoteId: 'id',
    };
    const fillPaint = {
      'fill-color': preview.theme.palette.primary.main,
      'fill-opacity': 0.35,
      'fill-outline-color': preview.theme.palette.primary.dark,
    };
    const linePaint = {
      'line-color': preview.theme.palette.primary.dark,
      'line-opacity': 0.7,
      'line-width': 1.5,
    };
    const layers: ResourceVectorLayer[] = [];
    if (resolvedAdmin0.name) {
      layers.push({
        ...baseLayer,
        layerConfig: {
          layerId: preview.baseLayerId,
          sourceId: preview.baseSourceId,
          sourceLayer: resolvedAdmin0.name,
          layerType: resolvedAdmin0.isBoundary ? 'line' : 'fill',
          paint: resolvedAdmin0.isBoundary ? linePaint : fillPaint,
        },
      });
    }
    if (resolvedAdmin1.name && resolvedAdmin1.name !== resolvedAdmin0.name) {
      layers.push({
        ...baseLayer,
        layerConfig: {
          layerId: `${preview.baseLayerId}-admin1`,
          sourceId: `${preview.baseSourceId}-admin1`,
          sourceLayer: resolvedAdmin1.name,
          layerType: resolvedAdmin1.isBoundary ? 'line' : 'fill',
          paint: resolvedAdmin1.isBoundary ? linePaint : fillPaint,
        },
      });
    }
    return layers;
  }, [
    preview.baseLayerId,
    preview.baseSourceId,
    preview.nodeId,
    preview.theme.palette.primary.dark,
    preview.theme.palette.primary.main,
    preview.tileDataProvider,
    preview.tileDbName,
    preview.tilesLayer,
    preview.tileLayerNames,
    preview.tilesUrl,
  ]);

  const vectorLayerIds = useMemo(
    () => vectorLayers.map((layer) => layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`),
    [vectorLayers],
  );

  const resolvedLayerNames = useMemo(() => {
    const tileLayerNames = preview.tileLayerNames ?? [];
    const fallbackLayerName = preview.tilesLayer ?? 'admin0';
    const resolvedAdmin0 = tileLayerNames.length
      ? resolveVectorTileLayer(tileLayerNames, 'admin0', { allowFallback: true })
      : { name: fallbackLayerName, isBoundary: false };
    const resolvedAdmin1 = tileLayerNames.length
      ? resolveVectorTileLayer(tileLayerNames, 'admin1', { allowFallback: false })
      : { name: 'admin1', isBoundary: false };
    return {
      available: tileLayerNames,
      admin0: resolvedAdmin0.name,
      admin1: resolvedAdmin1.name,
      admin0IsBoundary: resolvedAdmin0.isBoundary,
      admin1IsBoundary: resolvedAdmin1.isBoundary,
    };
  }, [preview.tileLayerNames, preview.tilesLayer]);

  const highlightOverridesByType = useMemo(() => {
    const hasSearch = ['boolean', ['feature-state', 'hdbSearch'], false];
    const hasHover = ['boolean', ['feature-state', 'hdbHover'], false];
    const hasSelected = ['boolean', ['feature-state', 'hdbSelected'], false];
    const baseFill = preview.theme.palette.primary.main;
    const baseOutline = preview.theme.palette.primary.dark;
    return {
      fill: {
        'fill-color': ['case', hasSelected, preview.theme.palette.primary.main, hasHover, preview.theme.palette.primary.light, hasSearch, preview.theme.palette.secondary.light, baseFill],
        'fill-outline-color': ['case', hasSelected, preview.theme.palette.primary.dark, hasHover, preview.theme.palette.primary.main, hasSearch, preview.theme.palette.secondary.main, baseOutline],
        'fill-opacity': [
          'case',
          hasSelected,
          0.6,
          hasHover,
          0.5,
          hasSearch,
          0.45,
          0.35,
        ],
      },
      line: {
        'line-color': ['case', hasSelected, preview.theme.palette.primary.main, hasHover, preview.theme.palette.primary.light, hasSearch, preview.theme.palette.secondary.light, baseOutline],
        'line-opacity': [
          'case',
          hasSelected,
          0.9,
          hasHover,
          0.8,
          hasSearch,
          0.7,
          0.6,
        ],
        'line-width': [
          'case',
          hasSelected,
          3,
          hasHover,
          2.5,
          hasSearch,
          2,
          1.5,
        ],
      },
    };
  }, [
    preview.theme.palette.primary.dark,
    preview.theme.palette.primary.light,
    preview.theme.palette.primary.main,
    preview.theme.palette.secondary.light,
    preview.theme.palette.secondary.main,
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
    const selectedFilter = ['==', ['get', 'selected'], true] as const;
    const unselectedFilter = ['!=', ['get', 'selected'], true] as const;
    const issueKindColor = [
      'case',
      ['has', 'issueKind'],
      [
        'match',
        ['get', 'issueKind'],
        'nonFinite',
        preview.theme.palette.error.dark,
        'invalidGeometry',
        preview.theme.palette.error.main,
        'invalidRing',
        preview.theme.palette.error.main,
        'openRing',
        preview.theme.palette.warning.main,
        'degenerateRing',
        preview.theme.palette.warning.dark,
        'duplicateVertex',
        preview.theme.palette.info.main,
        'smallPolygon',
        preview.theme.palette.secondary.main,
        'droppedPolygon',
        preview.theme.palette.secondary.dark,
        preview.theme.palette.error.main,
      ],
      preview.theme.palette.error.main,
    ] as const;
    return [
      {
        layerId: 'shape-transform-errors-selected-outline-glow',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': preview.theme.palette.primary.light,
          'line-width': 6,
          'line-blur': 2,
          'line-opacity': 0.6,
        },
        filter: ['all', ['==', ['get', 'ringRole'], 'outline'], selectedFilter],
      },
      {
        layerId: 'shape-transform-errors-selected-outline',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': preview.theme.palette.primary.main,
          'line-width': 3,
        },
        filter: ['all', ['==', ['get', 'ringRole'], 'outline'], selectedFilter],
      },
      {
        layerId: 'shape-transform-errors-selected-hole-glow',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': preview.theme.palette.primary.light,
          'line-width': 4,
          'line-blur': 2,
          'line-opacity': 0.5,
          'line-dasharray': [2, 2],
        },
        filter: ['all', ['==', ['get', 'ringRole'], 'hole'], selectedFilter],
      },
      {
        layerId: 'shape-transform-errors-selected-hole',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': preview.theme.palette.primary.main,
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
        filter: ['all', ['==', ['get', 'ringRole'], 'hole'], selectedFilter],
      },
      {
        layerId: 'shape-transform-errors-outline',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': issueKindColor,
          'line-width': 2,
        },
        filter: ['all', ['==', ['get', 'ringRole'], 'outline'], unselectedFilter],
      },
      {
        layerId: 'shape-transform-errors-hole',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': issueKindColor,
          'line-width': 1.5,
          'line-dasharray': [2, 2],
        },
        filter: ['all', ['==', ['get', 'ringRole'], 'hole'], unselectedFilter],
      },
    ];
  }, [
    preview.errorLineCollection,
    preview.theme.palette.error.main,
    preview.theme.palette.error.dark,
    preview.theme.palette.info.main,
    preview.theme.palette.primary.light,
    preview.theme.palette.primary.main,
    preview.theme.palette.secondary.dark,
    preview.theme.palette.secondary.main,
    preview.theme.palette.warning.main,
    preview.theme.palette.warning.dark,
  ]);

  return {
    ...preview,
    minZoom,
    maxZoom,
    baseMapStyleUrl,
    mapContainerRef,
    zoomSnackbarMessage,
    zoomSnackbarOpen,
    handleViewStateChange,
    handleZoomSnackbarClose,
    vectorLayers,
    vectorLayerIds,
    tileLayerNames: resolvedLayerNames.available,
    resolvedLayerNames,
    highlightOverridesByType,
    geoJsonLayers,
    attributionItems,
  };
};
