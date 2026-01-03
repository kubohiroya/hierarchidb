import { useAtom, useSetAtom } from 'jotai';
import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type {
  MapFeatureIdentifyResult,
  MapLibreGeoJSONFeature,
  MapLibreMapInstance,
  MapLibreMapMouseEvent,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  defaultFeatureIdAccessor,
  resolveIdentifyCandidates,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import type {
  MapHighlightEntry,
  MapLayerInfo,
  MapViewportFeatureIds,
} from '../../../state/mapSearch.atoms.js';
import {
  mapHoverMatchAtom,
  mapSearchMatchesAtom,
  mapSelectedMatchAtom,
  mapViewportFeatureIdsAtom,
} from '../../../state/mapSearch.atoms.js';

export type UseMapHighlightsParams = {
  mapInstance: MapLibreMapInstance | null;
  highlightLayerIds: string[];
  layerInfoById: Map<string, MapLayerInfo>;
  layerInfoBySource: Map<string, MapLayerInfo>;
};

export type UseMapHighlightsResult = {
  buildHighlightEntry: (feature?: MapLibreGeoJSONFeature | null) => MapHighlightEntry | null;
  handleIdentify: (result: MapFeatureIdentifyResult) => void;
};

export const useMapHighlights = ({
  mapInstance,
  highlightLayerIds,
  layerInfoById,
  layerInfoBySource,
}: UseMapHighlightsParams): UseMapHighlightsResult => {
  const [searchMatches] = useAtom(mapSearchMatchesAtom);
  const [hoverMatch, setHoverMatch] = useAtom(mapHoverMatchAtom);
  const [selectedMatch, setSelectedMatch] = useAtom(mapSelectedMatchAtom);
  const setViewportFeatureIds = useSetAtom(mapViewportFeatureIdsAtom);
  const appliedSearchMatchesRef = useRef<MapHighlightEntry[]>([]);
  const appliedHoverRef = useRef<MapHighlightEntry | null>(null);
  const appliedSelectedRef = useRef<MapHighlightEntry | null>(null);

  const resolveLayerMeta = useCallback(
    (feature?: MapLibreGeoJSONFeature | null) => {
      if (!feature) return undefined;
      const layerId = typeof feature.layer?.id === 'string' ? feature.layer.id : undefined;
      if (layerId) {
        const byId = layerInfoById.get(layerId);
        if (byId) return byId;
      }
      const sourceId = typeof feature.source === 'string' ? feature.source : undefined;
      return sourceId ? layerInfoBySource.get(sourceId) : undefined;
    },
    [layerInfoById, layerInfoBySource],
  );

  const buildHighlightEntry = useCallback(
    (feature?: MapLibreGeoJSONFeature | null): MapHighlightEntry | null => {
      if (!feature) return null;
      const id = defaultFeatureIdAccessor(feature);
      const source = typeof feature.source === 'string' ? feature.source : undefined;
      if (id === undefined || id === null || !source) return null;
      const layerId = typeof feature.layer?.id === 'string' ? feature.layer.id : undefined;
      const meta = resolveLayerMeta(feature);
      return {
        source,
        id,
        layerId,
        nodeId: meta?.nodeId,
        nodeType: meta?.nodeType,
      };
    },
    [resolveLayerMeta]
  );

  const updateViewportFeatures = useCallback(() => {
    if (!mapInstance) return;
    const canvas = mapInstance.getCanvas();
    let features: MapLibreGeoJSONFeature[] = [];
    try {
      features = mapInstance.queryRenderedFeatures(
        [
          [0, 0],
          [canvas.width, canvas.height],
        ],
        { layers: highlightLayerIds },
      ) as MapLibreGeoJSONFeature[];
    } catch (error) {
      console.debug('[MapPage] Failed to query viewport features', error);
      return;
    }

    const idsByLayer = new Map<string, Set<string | number>>();
    layerInfoById.forEach((_info, layerId) => {
      idsByLayer.set(layerId, new Set());
    });

    for (const feature of features) {
      const layerId = typeof feature.layer?.id === 'string' ? feature.layer.id : undefined;
      if (!layerId) continue;
      if (!layerInfoById.has(layerId)) continue;
      const id = defaultFeatureIdAccessor(feature);
      if (id === undefined || id === null) continue;
      idsByLayer.get(layerId)?.add(id);
    }

    const next: MapViewportFeatureIds = {};
    layerInfoById.forEach((info, layerId) => {
      if (!next[info.nodeId]) next[info.nodeId] = {};
      next[info.nodeId]![info.nodeType] = Array.from(idsByLayer.get(layerId) ?? []);
    });

    setViewportFeatureIds(next);
  }, [highlightLayerIds, layerInfoById, mapInstance, setViewportFeatureIds]);

  const clearHighlightKey = useCallback(
    (entry: MapHighlightEntry | null, key: 'hdbSearch' | 'hdbHover' | 'hdbSelected') => {
      if (!mapInstance || !entry) return;
      try {
        mapInstance.removeFeatureState({ source: entry.source, id: entry.id, key });
      } catch (error) {
        console.debug('[MapPage] Failed to clear feature-state', error);
      }
    },
    [mapInstance],
  );

  const applyHighlightKey = useCallback(
    (entry: MapHighlightEntry | null, key: 'hdbSearch' | 'hdbHover' | 'hdbSelected') => {
      if (!mapInstance || !entry) return;
      try {
        mapInstance.setFeatureState({ source: entry.source, id: entry.id }, { [key]: true });
      } catch (error) {
        console.debug('[MapPage] Failed to set feature-state', error);
      }
    },
    [mapInstance],
  );

  const setSingleHighlight = useCallback(
    (
      ref: MutableRefObject<MapHighlightEntry | null>,
      key: 'hdbHover' | 'hdbSelected',
      next: MapHighlightEntry | null,
    ) => {
      const current = ref.current;
      if (current && (!next || current.source !== next.source || current.id !== next.id)) {
        clearHighlightKey(current, key);
      }
      if (next) {
        applyHighlightKey(next, key);
      }
      ref.current = next;
    },
    [applyHighlightKey, clearHighlightKey],
  );

  const handleIdentify = useCallback(
    (result: MapFeatureIdentifyResult) => {
      const entry = buildHighlightEntry(result.features[0]);
      setSelectedMatch(entry);
    },
    [buildHighlightEntry, setSelectedMatch],
  );

  useEffect(() => {
    if (!mapInstance) return undefined;
    const handleMouseMove = (event: MapLibreMapMouseEvent) => {
      const result = resolveIdentifyCandidates(mapInstance, event, {
        layerIds: highlightLayerIds,
        radius: 6,
        getFeatureId: defaultFeatureIdAccessor,
      });
      const entry = buildHighlightEntry(result.features[0]);
      setHoverMatch(entry);
    };

    const handleMouseLeave = () => {
      setHoverMatch(null);
    };

    const canvas = mapInstance.getCanvas();
    mapInstance.on('mousemove', handleMouseMove as (...args: unknown[]) => void);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      mapInstance.off('mousemove', handleMouseMove as (...args: unknown[]) => void);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [buildHighlightEntry, highlightLayerIds, mapInstance, setHoverMatch]);

  useEffect(() => {
    if (!mapInstance) return;
    updateViewportFeatures();
    const handleViewportChange = () => updateViewportFeatures();
    mapInstance.on('moveend', handleViewportChange);
    mapInstance.on('zoomend', handleViewportChange);
    return () => {
      mapInstance.off('moveend', handleViewportChange);
      mapInstance.off('zoomend', handleViewportChange);
    };
  }, [mapInstance, updateViewportFeatures]);

  useEffect(() => {
    if (!mapInstance) return;
    appliedSearchMatchesRef.current.forEach((entry) => {clearHighlightKey(entry, 'hdbSearch');});
    searchMatches.forEach((entry) => {applyHighlightKey(entry, 'hdbSearch');});
    appliedSearchMatchesRef.current = searchMatches;
  }, [applyHighlightKey, clearHighlightKey, mapInstance, searchMatches]);

  useEffect(() => {
    if (!mapInstance) return;
    setSingleHighlight(appliedHoverRef, 'hdbHover', hoverMatch);
  }, [hoverMatch, mapInstance, setSingleHighlight]);

  useEffect(() => {
    if (!mapInstance) return;
    setSingleHighlight(appliedSelectedRef, 'hdbSelected', selectedMatch);
  }, [mapInstance, selectedMatch, setSingleHighlight]);

  return {
    buildHighlightEntry,
    handleIdentify,
  };
};
