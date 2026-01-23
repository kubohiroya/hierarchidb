/**
 * @file ResourceLayerMap.tsx
 * @description Map component that composes basemap, vector layers, and style overrides.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Box, IconButton, Paper, Snackbar, Typography } from '@mui/material';
import { Close as CloseIcon, FitScreen as FitScreenIcon, Tune as TuneIcon } from '@mui/icons-material';
import { createPortal } from 'react-dom';
import type { MapLibreGeoJSONFeature, MapLibreMapInstance, MapLibreStyle } from '../types/maplibre-public.js';
import type { MapAttributionItem } from '../types/attribution.js';
import type { LayerSetId } from '../preview/layerSetDefinitions.js';
import type { FeatureCollection } from 'geojson';
import { VectorTileLayer } from './VectorTileLayer.js';
import { normalizePaintLiteralArrays } from '../utils/maplibre-style-utils.js';
import {
  DEFAULT_MAP_CONFIG,
  type BaseMapProps,
  type VectorTileDataSource,
  type VectorTileLayerConfig,
} from '../types/unified-map-props.js';
import type { MapLibreFilter } from '../types/maplibre-public.js';
import { MapLibreMap, type MapLibreMapProps } from './MapLibreMap.js';
import { MapPreviewSearchPanel } from '../preview/MapPreviewSearchPanel.js';
import { MapPreviewSearchSettingsDialog } from '../preview/MapPreviewSearchSettingsDialog.js';
import { useMapFeatureHighlights } from '../preview/useMapFeatureHighlights.js';
import { useMapFeatureHoverCandidates } from '../preview/useMapFeatureHoverCandidates.js';
import { useMapFeatureSearch } from '../preview/useMapFeatureSearch.js';
import { useMapFeatureSelectionGestures } from '../preview/useMapFeatureSelectionGestures.js';
import { defaultFeatureIdAccessor } from '../lib/feature-identification.js';
import type { MapSearchTargetDefinition, MapSearchTargetGroup } from '../preview/mapPreviewSearchTypes.js';
import {
  buildHighlightKey,
  mapHoverCandidatesAtom,
  mapHoverMatchesAtom,
  mapHoveredFeaturesAtom,
  mapSearchMatchesAtom,
  mapSearchTargetsAtom,
  mapSearchTextAtom,
  mapSelectedMatchesAtom,
  mapViewportFeatureIdsAtom,
  type MapHighlightEntry,
} from '../interaction/mapInteractionStore.js';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

type BasemapStyleEntry = {
  nodeId: string;
  absolutePath?: string;
  style: string | MapLibreStyle;
};

type MapLayerType = NonNullable<VectorTileLayerConfig['layerType']>;
type LayerStyleOverrides = Partial<Record<MapLayerType, Record<string, unknown>>>;
type Bounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };


type MapStatsSnapshot = {
  tileStats: { requests: number; bytes: number };
  featureCounts: Record<string, number>;
};

type MapStatsStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => MapStatsSnapshot;
};

export type ResourceVectorLayer = VectorTileDataSource & {
  nodeId: string;
  nodeType: 'shape' | 'location' | 'route';
  dataSourceName?: string;
  absolutePath?: string;
  layerConfig?: VectorTileLayerConfig;
  layerSetId?: LayerSetId;
  layerPriority?: number;
  hierarchyLevel?: number;
  layerLabel?: string;
};

export type ResourceGeoJsonLayer = {
  layerId: string;
  sourceId: string;
  data: FeatureCollection;
  layerType: 'line' | 'circle' | 'fill' | 'symbol';
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: MapLibreFilter;
  beforeId?: string;
  absolutePath?: string;
  layerSetId?: LayerSetId;
  layerPriority?: number;
  hierarchyLevel?: number;
  layerLabel?: string;
};

export type ResourceLayerMapProps = BaseMapProps & {
  basemapStyles?: BasemapStyleEntry[];
  vectorLayers: ResourceVectorLayer[];
  geoJsonLayers?: ResourceGeoJsonLayer[];
  styleOverrides?: Record<string, unknown>;
  styleOverridesByType?: LayerStyleOverrides;
  highlightOverridesByType?: LayerStyleOverrides;
  attributionItems?: MapAttributionItem[];
  controls?: MapLibreMapProps['controls'];
  hoveredFeatures?: MapLibreGeoJSONFeature[];
  snackbar?: {
    position?: 'top' | 'bottom' | 'bottom-center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    renderContent?: (features: MapLibreGeoJSONFeature[]) => React.ReactNode;
    autoHideDuration?: number | null;
  };
  interaction?: {
    enabled?: boolean;
    highlightLayerIds?: string[];
    buildHighlightEntry?: (feature?: MapLibreGeoJSONFeature | null) => MapHighlightEntry | null;
    onMissingLayers?: (layerIds: string[]) => void;
    search?: {
      enabled?: boolean;
      targetDefinitions?: Record<string, MapSearchTargetDefinition>;
      targetGroups?: Array<MapSearchTargetGroup<string>>;
      placeholder?: string;
      showSettings?: boolean;
      fitOnSearch?: boolean;
      fitPadding?: number;
    };
    hover?: {
      enabled?: boolean;
      radius?: number;
    };
    selection?: {
      enabled?: boolean;
      radius?: number;
    };
    fitSelection?: {
      enabled?: boolean;
      padding?: number;
    };
    snackbar?: {
      enabled?: boolean;
      position?: 'top' | 'bottom' | 'bottom-center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      renderContent?: (features: MapLibreGeoJSONFeature[]) => React.ReactNode;
      autoHideDuration?: number | null;
    };
  };
  stats?: {
    enabled?: boolean;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    renderExtra?: () => React.ReactNode;
  };
};

const LAYER_PAINT_KEYS: Record<MapLayerType, Set<string>> = {
  fill: new Set(['fill-color', 'fill-opacity', 'fill-outline-color']),
  line: new Set(['line-color', 'line-opacity', 'line-width']),
  circle: new Set(['circle-color', 'circle-opacity', 'circle-radius']),
  symbol: new Set(['text-color', 'text-halo-color', 'text-halo-width']),
  raster: new Set(['raster-opacity', 'raster-brightness-max', 'raster-brightness-min', 'raster-contrast']),
  background: new Set(['background-color', 'background-opacity', 'background-pattern']),
};

const pickStyleOverrides = (
  layerType: VectorTileLayerConfig['layerType'] | undefined,
  overrides?: Record<string, unknown>,
  overridesByType?: LayerStyleOverrides,
): Record<string, unknown> => {
  const allowed = LAYER_PAINT_KEYS[layerType ?? 'fill'];
  if (!allowed) return {};
  const globalOverrides = overrides ?? {};
  const typedOverrides = overridesByType?.[layerType ?? 'fill'] ?? {};
  return Object.fromEntries(
    Object.entries({ ...typedOverrides, ...globalOverrides }).filter(([key]) => allowed.has(key))
  );
};

type SortableLayer = {
  absolutePath?: string;
  nodeId?: string;
  layerId?: string;
  sourceId?: string;
  layerPriority?: number;
};

const sortByPath = <T extends SortableLayer>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aKey = a.absolutePath ?? a.nodeId ?? a.layerId ?? a.sourceId ?? '';
    const bKey = b.absolutePath ?? b.nodeId ?? b.layerId ?? b.sourceId ?? '';
    return aKey.localeCompare(bKey);
  });

const sortByLayerPriority = <T extends SortableLayer>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aPriority = a.layerPriority ?? 0;
    const bPriority = b.layerPriority ?? 0;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aKey = a.absolutePath ?? a.nodeId ?? a.layerId ?? a.sourceId ?? '';
    const bKey = b.absolutePath ?? b.nodeId ?? b.layerId ?? b.sourceId ?? '';
    return aKey.localeCompare(bKey);
  });

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const MapStatsPanel: React.FC<{
  store: MapStatsStore;
  vectorLayerEntries: Array<{ id: string; label?: string }>;
  renderExtra?: () => React.ReactNode;
}> = ({ store, vectorLayerEntries, renderExtra }) => {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return (
    <Box display="flex" gap={1} alignItems="flex-start">
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
        <Typography variant="caption" fontWeight={700} display="block">
          Dexie Tile Stats
        </Typography>
        <Box mt={0.5}>
          <Typography variant="caption" display="block">
            Requests: {snapshot.tileStats.requests.toLocaleString()}
          </Typography>
          <Typography variant="caption" display="block">
            Data: {formatBytes(snapshot.tileStats.bytes)}
          </Typography>
        </Box>
        <Box mt={0.75}>
          <Typography variant="caption" fontWeight={600} display="block">
            Viewport Features
          </Typography>
          {vectorLayerEntries.length === 0 ? (
            <Typography variant="caption" display="block">
              No layers
            </Typography>
          ) : (
            vectorLayerEntries.map((entry) => (
              <Typography key={entry.id} variant="caption" display="block">
                {entry.label}: {snapshot.featureCounts[entry.id]?.toLocaleString() ?? '0'}
              </Typography>
            ))
          )}
        </Box>
      </Paper>
      {renderExtra ? (
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
          {renderExtra()}
        </Paper>
      ) : null}
    </Box>
  );
};


export const ResourceLayerMap: React.FC<ResourceLayerMapProps> = (props) => {
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
    mapStyleObject?: MapLibreStyle;
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
  const [mapControlContainer, setMapControlContainer] = useState<HTMLElement | null>(null);
  const [fitControlContainer, setFitControlContainer] = useState<HTMLElement | null>(null);
  const [statsContainer, setStatsContainer] = useState<HTMLElement | null>(null);
  const [searchSettingsOpen, setSearchSettingsOpen] = useState(false);

  const orderedBasemaps = useMemo(() => (basemapStyles ? sortByPath(basemapStyles) : []), [basemapStyles]);
  const orderedLayers = useMemo(() => sortByLayerPriority(vectorLayers), [vectorLayers]);
  const orderedGeoJsonLayers = useMemo(
    () => (geoJsonLayers ? sortByLayerPriority(geoJsonLayers) : []),
    [geoJsonLayers]
  );

  const statsEnabled = Boolean(stats?.enabled);
  const statsPosition = stats?.position ?? 'top-left';
  const tileStatsRef = useRef({ requests: 0, bytes: 0 });
  const tileStatsTimerRef = useRef<number | null>(null);
  const statsStoreRef = useRef({
    snapshot: {
      tileStats: { requests: 0, bytes: 0 },
      featureCounts: {} as Record<string, number>,
    },
    listeners: new Set<() => void>(),
  });
  const hasDexieLayers = useMemo(
    () => orderedLayers.some((layer) => Boolean(layer.dbName && layer.tileDataProvider)),
    [orderedLayers],
  );
  const statsActive = statsEnabled && hasDexieLayers;
  const statsPositionStyle = useMemo(() => {
    switch (statsPosition) {
      case 'top-right':
        return { top: 12, right: 12 };
      case 'bottom-left':
        return { bottom: 12, left: 12 };
      case 'bottom-right':
        return { bottom: 12, right: 12 };
      default:
        return { top: 12, left: 12 };
    }
  }, [statsPosition]);

  const resolvedBaseStyle = useMemo(() => {
    if (orderedBasemaps.length) return orderedBasemaps[0]?.style;
    if (mapStyleObject) return mapStyleObject;
    return mapStyleUrl ?? DEFAULT_MAP_CONFIG.mapStyleUrl;
  }, [mapStyleObject, mapStyleUrl, orderedBasemaps]);

  const mapStyleProps =
    typeof resolvedBaseStyle === 'string'
      ? { mapStyleUrl: resolvedBaseStyle }
      : { mapStyleObject: resolvedBaseStyle };

  const handleMapLoad = useCallback(
    (map: MapLibreMapInstance) => {
      setMapInstance(map);
      onLoad?.(map);
    },
    [onLoad]
  );

  useEffect(() => {
    if (!mapInstance) {
      setMapControlContainer(null);
      return;
    }
    const container = mapInstance.getContainer().querySelector('.maplibregl-ctrl-top-right');
    setMapControlContainer(container instanceof HTMLElement ? container : null);
  }, [mapInstance]);

  useEffect(() => {
    if (!mapInstance || !statsActive) {
      setStatsContainer(null);
      return;
    }
    const container = mapInstance.getContainer();
    setStatsContainer(container instanceof HTMLElement ? container : null);
  }, [mapInstance, statsActive]);

  useEffect(() => {
    if (!mapInstance || !orderedGeoJsonLayers.length) return;
    const map = mapInstance as MapLibreMapInstance & {
      addSource: (id: string, source: unknown) => void;
      addLayer: (layer: Record<string, unknown>, beforeId?: string) => void;
      getLayer: (id: string) => unknown;
      getSource: (id: string) => unknown;
      removeLayer: (id: string) => void;
      removeSource: (id: string) => void;
    };
    const sourceData = new Map<string, FeatureCollection>();
    orderedGeoJsonLayers.forEach((layer) => {
      if (!sourceData.has(layer.sourceId)) {
        sourceData.set(layer.sourceId, layer.data);
      }
    });

    orderedGeoJsonLayers.forEach((layer) => {
      if (map.getLayer(layer.layerId)) map.removeLayer(layer.layerId);
    });

    sourceData.forEach((_data, sourceId) => {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    });

    sourceData.forEach((data, sourceId) => {
      map.addSource(sourceId, { type: 'geojson', data });
    });

    orderedGeoJsonLayers.forEach((layer) => {
      map.addLayer(
        {
          id: layer.layerId,
          type: layer.layerType,
          source: layer.sourceId,
          paint: normalizePaintLiteralArrays(layer.paint ?? {}),
          layout: layer.layout ?? {},
          ...(layer.filter ? { filter: layer.filter } : {}),
        },
        layer.beforeId,
      );
    });

    return () => {
      orderedGeoJsonLayers.forEach((layer) => {
        if (map.getLayer(layer.layerId)) map.removeLayer(layer.layerId);
      });
      sourceData.forEach((_data, sourceId) => {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });
    };
  }, [mapInstance, orderedGeoJsonLayers]);

  const interactionEnabled = interaction ? (interaction.enabled ?? true) : false;
  const searchConfig = interaction?.search;
  const hoverConfig = interaction?.hover;
  const selectionConfig = interaction?.selection;
  const fitSelectionConfig = interaction?.fitSelection;
  const interactionSnackbar = interaction?.snackbar;

  const searchEnabled = interactionEnabled && Boolean(searchConfig?.enabled ?? searchConfig?.targetDefinitions);
  const hoverEnabled = interactionEnabled && (hoverConfig?.enabled ?? true);
  const selectionEnabled = interactionEnabled && (selectionConfig?.enabled ?? true);
  const fitSelectionEnabled = interactionEnabled && (fitSelectionConfig?.enabled ?? true);
  const snackbarEnabled = interactionEnabled ? (interactionSnackbar?.enabled ?? true) : Boolean(snackbar);

  const vectorLayerEntries = useMemo(() => (
    orderedLayers.map((layer) => {
      const layerId = layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`;
      const sourceId = layer.layerConfig?.sourceId ?? `resource-source-${layer.nodeId}`;
      return {
        id: layerId,
        label: layer.layerConfig?.layerId ?? layer.nodeId,
        sourceId,
        sourceLayer: layer.layerConfig?.sourceLayer,
      };
    })
  ), [orderedLayers]);

  const subscribeToStats = useCallback<MapStatsStore['subscribe']>((listener) => {
    statsStoreRef.current.listeners.add(listener);
    return () => {
      statsStoreRef.current.listeners.delete(listener);
    };
  }, []);

  const getStatsSnapshot = useCallback<MapStatsStore['getSnapshot']>(() => statsStoreRef.current.snapshot, []);

  const notifyStats = useCallback(() => {
    statsStoreRef.current.listeners.forEach((listener) => listener());
  }, []);

  const setStatsSnapshot = useCallback((next: MapStatsSnapshot) => {
    const current = statsStoreRef.current.snapshot;
    if (current.tileStats === next.tileStats && current.featureCounts === next.featureCounts) return;
    statsStoreRef.current.snapshot = next;
  }, []);

  const resetTileStats = useCallback(() => {
    const next = { requests: 0, bytes: 0 };
    tileStatsRef.current = next;
    setStatsSnapshot({ tileStats: next, featureCounts: statsStoreRef.current.snapshot.featureCounts });
    notifyStats();
  }, [notifyStats, setStatsSnapshot]);

  const setFeatureCountsIfChanged = useCallback((nextCounts: Record<string, number>) => {
    const prev = statsStoreRef.current.snapshot.featureCounts;
    const nextKeys = Object.keys(nextCounts);
    const prevKeys = Object.keys(prev);
    if (nextKeys.length === prevKeys.length) {
      let same = true;
      for (const key of nextKeys) {
        if (prev[key] !== nextCounts[key]) {
          same = false;
          break;
        }
      }
      if (same) return;
    }
    setStatsSnapshot({ tileStats: statsStoreRef.current.snapshot.tileStats, featureCounts: nextCounts });
    notifyStats();
  }, [notifyStats, setStatsSnapshot]);

  const handleTileRequest = useCallback((statsEntry: { bytes: number }) => {
    if (!statsActive) return;
    tileStatsRef.current.requests += 1;
    tileStatsRef.current.bytes += Math.max(0, statsEntry.bytes);
    if (tileStatsTimerRef.current !== null) return;
    tileStatsTimerRef.current = window.setTimeout(() => {
      tileStatsTimerRef.current = null;
      const nextStats = { ...tileStatsRef.current };
      setStatsSnapshot({ tileStats: nextStats, featureCounts: statsStoreRef.current.snapshot.featureCounts });
      notifyStats();
    }, 250);
  }, [notifyStats, setStatsSnapshot, statsActive]);

  useEffect(() => {
    if (!statsActive) {
      resetTileStats();
      setStatsSnapshot({ tileStats: statsStoreRef.current.snapshot.tileStats, featureCounts: {} });
      notifyStats();
      return;
    }
    resetTileStats();
  }, [resetTileStats, setStatsSnapshot, statsActive, vectorLayerEntries.length, notifyStats]);

  useEffect(() => {
    if (!mapInstance || !statsActive) return;
    let frameId: number | null = null;
    const mapWithSource = mapInstance as MapLibreMapInstance & {
      querySourceFeatures?: (sourceId: string, params: { sourceLayer?: string }) => MapLibreGeoJSONFeature[];
    };
    const updateCounts = () => {
      frameId = null;
      const nextCounts: Record<string, number> = {};
      vectorLayerEntries.forEach((entry) => {
        nextCounts[entry.id] = 0;
      });
      vectorLayerEntries.forEach((entry) => {
        if (!entry.sourceId || !entry.sourceLayer) return;
        if (!mapInstance.getSource(entry.sourceId)) return;
        if (!mapWithSource.querySourceFeatures) return;
        try {
          const features = mapWithSource.querySourceFeatures(entry.sourceId, { sourceLayer: entry.sourceLayer });
          nextCounts[entry.id] = features.length;
        } catch {
          nextCounts[entry.id] = 0;
        }
      });
      const hasMissing = vectorLayerEntries.some((entry) => !entry.sourceLayer);
      if (hasMissing) {
        try {
          const features = mapInstance.queryRenderedFeatures();
          features.forEach((feature) => {
            const layerId = feature.layer?.id;
            if (!layerId || !(layerId in nextCounts)) return;
            nextCounts[layerId] = (nextCounts[layerId] ?? 0) + 1;
          });
        } catch {
          // Keep zeroed counts if queryRenderedFeatures fails.
        }
      }
      setFeatureCountsIfChanged(nextCounts);
    };
    const scheduleUpdate = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(updateCounts);
    };
    mapInstance.on('idle', scheduleUpdate);
    mapInstance.on('moveend', scheduleUpdate);
    mapInstance.on('zoomend', scheduleUpdate);
    mapInstance.on('render', scheduleUpdate);
    mapInstance.on('sourcedata', scheduleUpdate);
    scheduleUpdate();
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      mapInstance.off('idle', scheduleUpdate);
      mapInstance.off('moveend', scheduleUpdate);
      mapInstance.off('zoomend', scheduleUpdate);
      mapInstance.off('render', scheduleUpdate);
      mapInstance.off('sourcedata', scheduleUpdate);
    };
  }, [mapInstance, setFeatureCountsIfChanged, statsActive, vectorLayerEntries]);

  useEffect(() => {
    if (!fitSelectionEnabled || !mapControlContainer) {
      if (fitControlContainer?.parentNode) {
        fitControlContainer.parentNode.removeChild(fitControlContainer);
      }
      setFitControlContainer(null);
      return;
    }
    if (!fitControlContainer) {
      const container = document.createElement('div');
      container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
      setFitControlContainer(container);
      return;
    }
    const insertContainer = () => {
      const navControl = mapControlContainer.querySelector('.maplibregl-ctrl-group');
      if (navControl && navControl.nextSibling !== fitControlContainer) {
        mapControlContainer.insertBefore(fitControlContainer, navControl.nextSibling);
        return;
      }
      if (!navControl && mapControlContainer.lastChild !== fitControlContainer) {
        mapControlContainer.appendChild(fitControlContainer);
      }
    };
    insertContainer();
    const frame = window.requestAnimationFrame(insertContainer);
    return () => window.cancelAnimationFrame(frame);
  }, [fitSelectionEnabled, mapControlContainer, fitControlContainer]);

  const highlightLayerIds = useMemo(() => {
    if (interaction?.highlightLayerIds?.length) return interaction.highlightLayerIds;
    return [
      ...orderedLayers.map((layer) => layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`),
      ...orderedGeoJsonLayers.map((layer) => layer.layerId),
    ];
  }, [interaction?.highlightLayerIds, orderedGeoJsonLayers, orderedLayers]);

  const highlightLayerPriorityById = useMemo(() => {
    const map = new Map<string, number>();
    orderedLayers.forEach((layer) => {
      const layerId = layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`;
      map.set(layerId, layer.layerPriority ?? 0);
    });
    orderedGeoJsonLayers.forEach((layer) => {
      map.set(layer.layerId, layer.layerPriority ?? 0);
    });
    return map;
  }, [orderedGeoJsonLayers, orderedLayers]);

  const buildHighlightEntry = useCallback(
    (feature?: MapLibreGeoJSONFeature | null) => {
      if (interaction?.buildHighlightEntry) {
        return interaction.buildHighlightEntry(feature);
      }
      if (!feature) return null;
      const id = defaultFeatureIdAccessor(feature);
      const source = typeof feature.source === 'string' ? feature.source : undefined;
      if (id === undefined || id === null || !source) return null;
      const layerId = typeof feature.layer?.id === 'string' ? feature.layer.id : undefined;
      const sourceLayer = typeof feature.sourceLayer === 'string' ? feature.sourceLayer : undefined;
      return { source, id, layerId, sourceLayer };
    },
    [interaction],
  );

  const [searchText, setSearchText] = useAtom(mapSearchTextAtom);
  const [searchTargets, setSearchTargets] = useAtom(mapSearchTargetsAtom);
  const setSearchMatches = useSetAtom(mapSearchMatchesAtom);
  const setHoverCandidates = useSetAtom(mapHoverCandidatesAtom);
  const setHoverMatches = useSetAtom(mapHoverMatchesAtom);
  const searchMatches = useAtomValue(mapSearchMatchesAtom);
  const hoverMatches = useAtomValue(mapHoverMatchesAtom);
  const hoveredInteractionFeatures = useAtomValue(mapHoveredFeaturesAtom);
  const selectedMatches = useAtomValue(mapSelectedMatchesAtom);
  const setSelectedMatches = useSetAtom(mapSelectedMatchesAtom);
  const setViewportFeatureIds = useSetAtom(mapViewportFeatureIdsAtom);

  useEffect(() => {
    if (!searchEnabled || !searchConfig?.targetDefinitions) return;
    if (Object.keys(searchTargets).length > 0) return;
    const defaults = Object.fromEntries(
      Object.keys(searchConfig.targetDefinitions).map((targetId) => [targetId, true]),
    );
    setSearchTargets(defaults);
  }, [searchConfig?.targetDefinitions, searchEnabled, searchTargets, setSearchTargets]);

  const dedupeEntries = useCallback((entries: MapHighlightEntry[]) => {
    const map = new Map<string, MapHighlightEntry>();
    entries.forEach((entry) => {
      map.set(buildHighlightKey(entry), entry);
    });
    return Array.from(map.values());
  }, []);

  const applySelectionChange = useCallback(
    (mode: 'replace' | 'toggle' | 'add' | 'clear' | 'box', entries: MapHighlightEntry[]) => {
      if (mode === 'clear') {
        setSelectedMatches([]);
        return;
      }
      if (mode === 'replace') {
        setSelectedMatches(dedupeEntries(entries));
        return;
      }
      if (mode === 'box') {
        setSelectedMatches((prev) => {
          const next = new Map(prev.map((entry) => [buildHighlightKey(entry), entry]));
          entries.forEach((entry) => {
            next.set(buildHighlightKey(entry), entry);
          });
          return Array.from(next.values());
        });
        return;
      }
      setSelectedMatches((prev) => {
        const next = new Map(prev.map((entry) => [buildHighlightKey(entry), entry]));
        entries.forEach((entry) => {
          const key = buildHighlightKey(entry);
          if (mode === 'toggle') {
            if (next.has(key)) {
              next.delete(key);
            } else {
              next.set(key, entry);
            }
          } else {
            next.set(key, entry);
          }
        });
        return Array.from(next.values());
      });
    },
    [dedupeEntries, setSelectedMatches],
  );

  const fitPadding = fitSelectionConfig?.padding ?? 64;
  const fitSearchPadding = searchConfig?.fitPadding ?? 64;

  const visitCoordinates = useCallback(
    (coords: unknown, bounds: Bounds | null): Bounds | null => {
      if (!Array.isArray(coords)) return bounds;
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        const [lng, lat] = coords;
        if (!bounds) {
          return { minLng: lng, minLat: lat, maxLng: lng, maxLat: lat };
        }
        return {
          minLng: Math.min(bounds.minLng, lng),
          minLat: Math.min(bounds.minLat, lat),
          maxLng: Math.max(bounds.maxLng, lng),
          maxLat: Math.max(bounds.maxLat, lat),
        };
      }
      return coords.reduce(
        (current, entry) => visitCoordinates(entry, current),
        bounds,
      );
    },
    [],
  );

  const fitToFeatures = useCallback(
    (features: MapLibreGeoJSONFeature[], padding: number) => {
      if (!mapInstance || features.length === 0) return;
      let bounds: Bounds | null = null;
      features.forEach((feature) => {
        const geometry = (feature as { geometry?: { coordinates?: unknown } }).geometry;
        if (!geometry?.coordinates) return;
        bounds = visitCoordinates(geometry.coordinates, bounds);
      });
      if (!bounds) return;
      const resolvedBounds: Bounds = bounds;
      mapInstance.fitBounds(
        [
          [resolvedBounds.minLng, resolvedBounds.minLat],
          [resolvedBounds.maxLng, resolvedBounds.maxLat],
        ],
        { padding },
      );
    },
    [mapInstance, visitCoordinates],
  );

  const handleFitSelection = useCallback(() => {
    if (!mapInstance || selectedMatches.length === 0) return;
    const selectedKeySet = new Set(selectedMatches.map(buildHighlightKey));
    const canvas = mapInstance.getCanvas();
    const queryBounds: [[number, number], [number, number]] = [
      [0, 0],
      [canvas.width, canvas.height],
    ];
    let features: MapLibreGeoJSONFeature[] = [];
    try {
      features = mapInstance.queryRenderedFeatures(queryBounds, { layers: highlightLayerIds }) as MapLibreGeoJSONFeature[];
    } catch (error) {
      console.debug('[ResourceLayerMap] Failed to query selected features', error);
      return;
    }
    const matched = features.filter((feature) => {
      const source = typeof feature.source === 'string' ? feature.source : undefined;
      const id = defaultFeatureIdAccessor(feature);
      if (!source || id === undefined || id === null) return false;
      return selectedKeySet.has(`${source}:${id}`);
    });
    fitToFeatures(matched, fitPadding);
  }, [fitPadding, fitToFeatures, highlightLayerIds, mapInstance, selectedMatches]);

  const {
    runSearch,
    handleSearchClear,
    handleSearchTargetToggle,
  } = useMapFeatureSearch({
    mapInstance: searchEnabled ? mapInstance : null,
    highlightLayerIds,
    searchText,
    searchTargets,
    targetDefinitions: searchConfig?.targetDefinitions ?? {},
    buildHighlightEntry,
    onMatchesChange: (entries) => {
      setSearchMatches(entries);
    },
    onFeaturesChange: (features) => {
      if (searchConfig?.fitOnSearch) {
        fitToFeatures(features, fitSearchPadding);
      }
    },
    setSearchText,
    setSearchTargets: (updater) => setSearchTargets((prev) => updater(prev)),
    onMissingLayers: interaction?.onMissingLayers,
  });

  useMapFeatureHoverCandidates({
    mapInstance: hoverEnabled ? mapInstance : null,
    highlightLayerIds,
    layerPriorityById: highlightLayerPriorityById,
    buildHighlightEntry,
    radius: hoverConfig?.radius,
    onHoverChange: (entries, features) => {
      const candidates = features
        .map((feature) => {
          const entry = buildHighlightEntry(feature);
          if (!entry) return null;
          return { entry, feature };
        })
        .filter((candidate): candidate is { entry: MapHighlightEntry; feature: MapLibreGeoJSONFeature } => Boolean(candidate));
      setHoverCandidates(candidates);
      setHoverMatches(entries);
    },
  });

  useMapFeatureSelectionGestures({
    mapInstance: selectionEnabled ? mapInstance : null,
    highlightLayerIds,
    layerPriorityById: highlightLayerPriorityById,
    buildHighlightEntry,
    radius: selectionConfig?.radius,
    onSelectionChange: applySelectionChange,
  });

  useMapFeatureHighlights({
    mapInstance: interactionEnabled ? mapInstance : null,
    highlightLayerIds,
    searchMatches,
    hoverMatches,
    selectedMatches,
    onViewportLayerIdsChange: interactionEnabled ? setViewportFeatureIds : undefined,
    onMissingLayers: interaction?.onMissingLayers,
  });

  const snackbarFeatures = interactionEnabled ? hoveredInteractionFeatures : (hoveredFeatures ?? []);
  const effectiveSnackbar = interactionEnabled ? (interactionSnackbar ?? snackbar ?? {}) : snackbar;
  const snackbarPosition = effectiveSnackbar?.position ?? 'bottom';
  const anchorOrigin = (() => {
    switch (snackbarPosition) {
      case 'top':
        return { vertical: 'top', horizontal: 'center' } as const;
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
  const snackbarContent =
    effectiveSnackbar?.renderContent?.(snackbarFeatures)
    ?? (snackbarFeatures.length ? `(${snackbarFeatures.length} features)` : '');

  return (
    <>
      <MapLibreMap
        {...baseMapProps}
        {...mapStyleProps}
        onLoad={handleMapLoad}
        controls={resolvedControls}
      >
        {mapInstance &&
          orderedLayers.map((layer) => {
            const layerConfig = { ...DEFAULT_MAP_CONFIG.vectorTileLayer, ...layer.layerConfig };
            const layerType = layerConfig.layerType ?? 'fill';
            const paintOverrides = pickStyleOverrides(layerType, styleOverrides, styleOverridesByType);
            const highlightOverrides = highlightOverridesByType?.[layerType] ?? {};
            const layerPaint = { ...(layerConfig.paint ?? {}), ...paintOverrides, ...highlightOverrides };
            const layerId = layerConfig.layerId ?? `resource-layer-${layer.nodeId}`;
            const sourceId = layerConfig.sourceId ?? `resource-source-${layer.nodeId}`;

            return (
              <VectorTileLayer
                key={layerId}
                map={mapInstance}
                dbName={layer.dbName}
                nodeId={layer.nodeId}
                tiles={layer.tiles}
                tileDataProvider={layer.tileDataProvider}
                onTileRequest={statsActive ? handleTileRequest : undefined}
                layerId={layerId}
                sourceId={sourceId}
                promoteId={layer.promoteId}
                featureState={layer.featureState}
                paint={layerPaint}
                layout={layerConfig.layout}
                filter={layerConfig.filter}
                minzoom={layerConfig.minzoom}
                maxzoom={layerConfig.maxzoom}
                layerType={layerType}
                sourceLayer={layerConfig.sourceLayer}
                visible={layerConfig.visible}
              />
            );
          })}
      </MapLibreMap>
      {statsActive && statsContainer ? (
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
              store={{ subscribe: subscribeToStats, getSnapshot: getStatsSnapshot }}
              vectorLayerEntries={vectorLayerEntries}
              renderExtra={stats?.renderExtra}
            />
          </Box>,
          statsContainer,
        )
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
          open={snackbarEnabled && snackbarFeatures.length > 0}
          autoHideDuration={effectiveSnackbar.autoHideDuration ?? null}
          message={snackbarContent}
          anchorOrigin={anchorOrigin}
          sx={
            anchorOrigin.vertical === 'bottom' && anchorOrigin.horizontal === 'center'
              ? { left: '50%', transform: 'translateX(-50%)' }
              : undefined
          }
        />
      )}
    </>
  );
};
