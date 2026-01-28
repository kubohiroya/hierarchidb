import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  MapAttributionItem,
  MapViewState,
  ResourceGeoJsonLayer,
  ResourceVectorLayer,
  LayerSetId,
  LayerSetVisibility,
  ResolvedLayerSetEntry,
  LayerSetListItem,
} from '@hierarchidb/ui-map';
import { DEFAULT_LAYER_SETS, buildLayerSetListItems, getLayerSetDefinition, resolveLayerSetEntries } from '@hierarchidb/ui-map';
import {
  loadTreeConsoleSettings,
  TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
  TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
} from '@hierarchidb/util';
import { getDataSourceConfig } from '../../../services/utils/utils.js';
import type { ShapeEntity } from '../../../common/types/index.js';
import { useShapePreviewStep } from './useShapePreviewStep.js';

const LIGHT_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DARK_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const resolveCommonZoomBounds = () => {
  const settings = loadTreeConsoleSettings();
  const boundaries = Array.isArray(settings.zoomBandBoundaries)
    ? settings.zoomBandBoundaries.filter((value) => typeof value === 'number' && Number.isFinite(value))
    : [];
  if (boundaries.length === 0) {
    return {
      minZoom: TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
      maxZoom: TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
    };
  }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const minZoom = sorted[0] ?? TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM;
  const maxZoom = sorted[sorted.length - 1] ?? TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM;
  return {
    minZoom,
    maxZoom: Math.max(minZoom, maxZoom),
  };
};

export const useShapePreviewStepView = (data: Partial<ShapeEntity>, nodeId: string) => {
  const preview = useShapePreviewStep(data, nodeId);
  const { minZoom, maxZoom } = useMemo(() => resolveCommonZoomBounds(), []);
  const baseMapStyleUrl = preview.theme.palette.mode === 'dark'
    ? DARK_BASEMAP_STYLE_URL
    : LIGHT_BASEMAP_STYLE_URL;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const lastZoomRef = useRef<number | null>(null);
  const [zoomSnackbarMessage, setZoomSnackbarMessage] = useState<string>('');
  const [zoomSnackbarOpen, setZoomSnackbarOpen] = useState(false);

  const [layerSetVisibility, setLayerSetVisibility] = useState<LayerSetVisibility>({
    location: false,
    route: false,
    shape: true,
  });

  const toggleLayerSetVisibility = useCallback((id: LayerSetId) => {
    setLayerSetVisibility((prev: LayerSetVisibility) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const handleViewStateChange = useCallback((viewState: MapViewState) => {
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

  const layerSetName = data.buildConfig?.vtConfig?.layerSetName ?? 'shape';
  const layerSetDefinition = useMemo(
    () => getLayerSetDefinition(layerSetName),
    [layerSetName],
  );

  const resolvedLayerSetEntries = useMemo<ResolvedLayerSetEntry[]>(() => {
    if (!layerSetDefinition) return [];
    return resolveLayerSetEntries(preview.tileLayerNames ?? [], layerSetDefinition);
  }, [layerSetDefinition, preview.tileLayerNames]);

  const layerSetItems = useMemo<LayerSetListItem[]>(
    () => buildLayerSetListItems(resolvedLayerSetEntries),
    [resolvedLayerSetEntries],
  );

  const vectorLayers = useMemo<ResourceVectorLayer[]>(() => {
    if (!preview.nodeId || !layerSetDefinition) return [];
    if (!layerSetVisibility[layerSetDefinition.id]) return [];
    const hasRemoteTiles = Boolean(preview.tilesUrl);
    const tiles = hasRemoteTiles ? [preview.tilesUrl] : undefined;
    const baseLayer = {
      nodeId: String(preview.nodeId),
      nodeType: 'shape' as const,
      tiles,
      dbName: !hasRemoteTiles ? preview.tileDbName : undefined,
      tileDataProvider: !hasRemoteTiles ? preview.tileDataProvider : undefined,
      promoteId: 'id',
      layerSetId: layerSetDefinition.id,
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
    return resolvedLayerSetEntries
      .filter((entry) => Boolean(entry.sourceLayer))
      .map((entry) => ({
        ...baseLayer,
        layerPriority: entry.priority,
        hierarchyLevel: entry.hierarchyLevel,
        layerLabel: entry.label,
        layerConfig: {
          layerId: `${preview.baseLayerId}-${entry.id}`,
          sourceId: `${preview.baseSourceId}-${entry.id}`,
          sourceLayer: entry.sourceLayer,
          layerType: entry.layerType,
          paint: entry.layerType === 'line' ? linePaint : fillPaint,
        },
      }));
  }, [
    layerSetDefinition,
    layerSetVisibility,
    preview.baseLayerId,
    preview.baseSourceId,
    preview.nodeId,
    preview.theme.palette.primary.dark,
    preview.theme.palette.primary.main,
    preview.tileDataProvider,
    preview.tileDbName,
    preview.tilesUrl,
    resolvedLayerSetEntries,
  ]);

  const vectorLayerIds = useMemo(
    () => vectorLayers.map((layer) => layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`),
    [vectorLayers],
  );

  const resolvedLayerNames = useMemo(() => {
    const tileLayerNames = preview.tileLayerNames ?? [];
    const lookup = new Map(resolvedLayerSetEntries.map((entry) => [entry.id, entry]));
    const admin0Boundary = lookup.get('shape-adm0-boundary');
    const admin0Fill = lookup.get('shape-adm0-fill');
    const admin1Boundary = lookup.get('shape-adm1-boundary');
    const admin1Fill = lookup.get('shape-adm1-fill');
    return {
      available: tileLayerNames,
      admin0: admin0Fill?.sourceLayer ?? admin0Boundary?.sourceLayer ?? null,
      admin1: admin1Fill?.sourceLayer ?? admin1Boundary?.sourceLayer ?? null,
      admin0IsBoundary: Boolean(admin0Boundary?.sourceLayer) && admin0Boundary?.sourceLayer !== admin0Fill?.sourceLayer,
      admin1IsBoundary: Boolean(admin1Boundary?.sourceLayer) && admin1Boundary?.sourceLayer !== admin1Fill?.sourceLayer,
    };
  }, [preview.tileLayerNames, resolvedLayerSetEntries]);

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
          'line-dasharray': ['literal', [2, 2]],
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
          'line-dasharray': ['literal', [2, 2]],
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
          'line-dasharray': ['literal', [2, 2]],
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
    layerSetVisibility,
    toggleLayerSetVisibility,
    layerSetItems,
    layerSetDefinition,
    availableLayerSets: DEFAULT_LAYER_SETS,
  };
};
