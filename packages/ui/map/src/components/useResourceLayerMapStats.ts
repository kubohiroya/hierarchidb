import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapLibreGeoJSONFeature, MapLibreMapInstance } from '~/types/maplibre-public';

type MapStatsSnapshot = {
  tileStats: { requests: number; bytes: number };
  featureCounts: Record<string, number>;
};

type MapStatsStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => MapStatsSnapshot;
};

type StatsLayerEntry = {
  id: string;
  label?: string;
  sourceId?: string;
  sourceLayer?: string;
};

type StatsLayerSource = {
  dbName?: string;
  tileDataProvider?: unknown;
};

type StatsPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

type UseResourceLayerMapStatsArgs = {
  mapInstance: MapLibreMapInstance | null;
  orderedLayers: StatsLayerSource[];
  vectorLayerEntries: StatsLayerEntry[];
  statsEnabled: boolean;
  statsPosition: StatsPosition;
};

type UseResourceLayerMapStatsResult = {
  statsActive: boolean;
  statsContainer: HTMLElement | null;
  statsPositionStyle: { top?: number; right?: number; bottom?: number; left?: number };
  statsStore: MapStatsStore;
  handleTileRequest: (statsEntry: { bytes: number }) => void;
};

const DEFAULT_STATS_POSITION_STYLE = { top: 12, left: 12 };

const resolveStatsPositionStyle = (position: StatsPosition) => {
  switch (position) {
    case 'top-right':
      return { top: 12, right: 12 };
    case 'bottom-left':
      return { bottom: 12, left: 12 };
    case 'bottom-right':
      return { bottom: 12, right: 12 };
    default:
      return DEFAULT_STATS_POSITION_STYLE;
  }
};

const safeQuerySourceFeatures = (
  map: MapLibreMapInstance,
  sourceId: string,
  sourceLayer?: string
): MapLibreGeoJSONFeature[] => {
  const mapWithSource = map as MapLibreMapInstance & {
    querySourceFeatures?: (
      sourceId: string,
      params: { sourceLayer?: string }
    ) => MapLibreGeoJSONFeature[];
  };
  if (!mapWithSource.querySourceFeatures) return [];
  try {
    return mapWithSource.querySourceFeatures(sourceId, { sourceLayer });
  } catch {
    return [];
  }
};

type VectorLayerFeatureCounterEntry = {
  id: string;
  sourceId?: string;
  sourceLayer?: string;
};

type VectorLayerFeatureCounts = Record<string, number>;

export const resolveVectorLayerFeatureCounts = (
  map: MapLibreMapInstance,
  vectorLayerEntries: VectorLayerFeatureCounterEntry[]
): VectorLayerFeatureCounts => {
  const nextCounts: VectorLayerFeatureCounts = {};
  vectorLayerEntries.forEach((entry) => {
    nextCounts[entry.id] = 0;
  });
  vectorLayerEntries.forEach((entry) => {
    if (!entry.sourceId || !entry.sourceLayer) return;
    if (!map.getSource(entry.sourceId)) return;
    const features = safeQuerySourceFeatures(map, entry.sourceId, entry.sourceLayer);
    nextCounts[entry.id] = features.length;
  });
  const hasMissing = vectorLayerEntries.some((entry) => !entry.sourceLayer);
  if (hasMissing) {
    try {
      const features = map.queryRenderedFeatures();
      features.forEach((feature) => {
        const layerId = feature.layer?.id;
        if (!layerId || !(layerId in nextCounts)) return;
        nextCounts[layerId] = (nextCounts[layerId] ?? 0) + 1;
      });
    } catch {
      // Keep zeroed counts if queryRenderedFeatures fails.
    }
  }
  return nextCounts;
};

export const useResourceLayerMapStats = (
  args: UseResourceLayerMapStatsArgs
): UseResourceLayerMapStatsResult => {
  const { mapInstance, orderedLayers, vectorLayerEntries, statsEnabled, statsPosition } = args;

  const [statsContainer, setStatsContainer] = useState<HTMLElement | null>(null);
  const tileStatsRef = useRef({ requests: 0, bytes: 0 });
  const tileStatsTimerRef = useRef<number | null>(null);
  const statsStoreRef = useRef({
    snapshot: {
      tileStats: { requests: 0, bytes: 0 },
      featureCounts: {} as Record<string, number>,
    },
    listeners: new Set<() => void>(),
  });

  const statsPositionStyle = useMemo(
    () => resolveStatsPositionStyle(statsPosition),
    [statsPosition]
  );

  const hasDexieLayers = useMemo(
    () => orderedLayers.some((layer) => Boolean(layer.dbName && layer.tileDataProvider)),
    [orderedLayers]
  );
  const statsActive = statsEnabled && hasDexieLayers;

  useEffect(() => {
    if (!mapInstance || !statsActive) {
      setStatsContainer(null);
      return;
    }
    const container = mapInstance.getContainer();
    setStatsContainer(container instanceof HTMLElement ? container : null);
  }, [mapInstance, statsActive]);

  const subscribe = useCallback<MapStatsStore['subscribe']>((listener) => {
    statsStoreRef.current.listeners.add(listener);
    return () => {
      statsStoreRef.current.listeners.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback<MapStatsStore['getSnapshot']>(
    () => statsStoreRef.current.snapshot,
    []
  );

  const notifyStats = useCallback(() => {
    statsStoreRef.current.listeners.forEach((listener) => {
      listener();
    });
  }, []);

  const setStatsSnapshot = useCallback((next: MapStatsSnapshot) => {
    const current = statsStoreRef.current.snapshot;
    if (current.tileStats === next.tileStats && current.featureCounts === next.featureCounts)
      return;
    statsStoreRef.current.snapshot = next;
  }, []);

  const resetTileStats = useCallback(() => {
    const next = { requests: 0, bytes: 0 };
    tileStatsRef.current = next;
    setStatsSnapshot({
      tileStats: next,
      featureCounts: statsStoreRef.current.snapshot.featureCounts,
    });
    notifyStats();
  }, [notifyStats, setStatsSnapshot]);

  const setFeatureCountsIfChanged = useCallback(
    (nextCounts: Record<string, number>) => {
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
      setStatsSnapshot({
        tileStats: statsStoreRef.current.snapshot.tileStats,
        featureCounts: nextCounts,
      });
      notifyStats();
    },
    [notifyStats, setStatsSnapshot]
  );

  const handleTileRequest = useCallback(
    (statsEntry: { bytes: number }) => {
      if (!statsActive) return;
      tileStatsRef.current.requests += 1;
      tileStatsRef.current.bytes += Math.max(0, statsEntry.bytes);
      if (tileStatsTimerRef.current !== null) return;
      tileStatsTimerRef.current = window.setTimeout(() => {
        tileStatsTimerRef.current = null;
        const nextStats = { ...tileStatsRef.current };
        setStatsSnapshot({
          tileStats: nextStats,
          featureCounts: statsStoreRef.current.snapshot.featureCounts,
        });
        notifyStats();
      }, 250);
    },
    [notifyStats, setStatsSnapshot, statsActive]
  );

  useEffect(() => {
    if (!statsActive) {
      resetTileStats();
      setStatsSnapshot({ tileStats: statsStoreRef.current.snapshot.tileStats, featureCounts: {} });
      notifyStats();
      return;
    }
    resetTileStats();
  }, [resetTileStats, setStatsSnapshot, statsActive, notifyStats]);

  useEffect(() => {
    if (!mapInstance || !statsActive) return;
    let frameId: number | null = null;
    const updateCounts = () => {
      frameId = null;
      const nextCounts = resolveVectorLayerFeatureCounts(mapInstance, vectorLayerEntries);
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

  useEffect(
    () => () => {
      if (tileStatsTimerRef.current !== null) {
        window.clearTimeout(tileStatsTimerRef.current);
        tileStatsTimerRef.current = null;
      }
    },
    []
  );

  const statsStore = useMemo(() => ({ subscribe, getSnapshot }), [getSnapshot, subscribe]);

  return {
    statsActive,
    statsContainer,
    statsPositionStyle,
    statsStore,
    handleTileRequest,
  };
};

export type { MapStatsSnapshot, MapStatsStore, StatsLayerEntry, StatsPosition };
