import { useCallback, useEffect, useMemo } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import type { ReactNode } from 'react';
import type { MapLibreGeoJSONFeature, MapLibreMapInstance } from '~/types/maplibre-public';
import type { SxProps, Theme } from '@mui/material/styles';
import { defaultFeatureIdAccessor } from '~/lib/feature-identification';
import { useMapFeatureHighlights } from '~/preview/useMapFeatureHighlights';
import { useMapFeatureHoverCandidates } from '~/preview/useMapFeatureHoverCandidates';
import { useMapFeatureSearch } from '~/preview/useMapFeatureSearch';
import { useMapFeatureSelectionGestures } from '~/preview/useMapFeatureSelectionGestures';
import type { MapSearchTargetDefinition, MapSearchTargetGroup } from '~/preview/mapPreviewSearchTypes';
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
} from '~/interaction/mapInteractionStore';
import { type Bounds, type ResourceGeoJsonLayer, type ResourceVectorLayer } from './ResourceLayerMap.types.js';

type InteractionConfig = {
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
    content?: ReactNode;
    renderContent?: (features: MapLibreGeoJSONFeature[]) => ReactNode;
    autoHideDuration?: number | null;
    open?: boolean;
    contentSx?: SxProps<Theme>;
  };
};

type BaseSnackbarConfig = {
  position?: 'top' | 'bottom' | 'bottom-center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  content?: ReactNode;
  renderContent?: (features: MapLibreGeoJSONFeature[]) => ReactNode;
  autoHideDuration?: number | null;
  open?: boolean;
  contentSx?: SxProps<Theme>;
};

type Result = {
  interactionEnabled: boolean;
  searchEnabled: boolean;
  hoverEnabled: boolean;
  selectionEnabled: boolean;
  fitSelectionEnabled: boolean;
  snackbarEnabled: boolean;
  searchText: string;
  setSearchText: (next: string) => void;
  searchTargets: Record<string, boolean>;
  setSearchTargets: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  vectorLayerEntries: Array<{ id: string; label?: string; sourceId: string; sourceLayer?: string }>;
  searchMatches: MapHighlightEntry[];
  hoverMatches: MapHighlightEntry[];
  hoveredInteractionFeatures: MapLibreGeoJSONFeature[];
  selectedMatches: MapHighlightEntry[];
  snackbarFeatures: MapLibreGeoJSONFeature[];
  effectiveSnackbar?: BaseSnackbarConfig;
  runSearch: (text?: string) => void;
  handleSearchClear: () => void;
  handleSearchTargetToggle: (targetId: string) => void;
  handleFitSelection: () => void;
  highlightLayerIds: string[];
  highlightLayerPriorityById: Map<string, number>;
  fitPadding: number;
};

export const useResourceLayerMapInteractions = ({
  mapInstance,
  interaction,
  orderedLayers,
  orderedGeoJsonLayers,
  hoveredFeatures,
  snackbar,
}: {
  mapInstance: MapLibreMapInstance | null;
  interaction?: InteractionConfig;
  orderedLayers: ResourceVectorLayer[];
  orderedGeoJsonLayers: ResourceGeoJsonLayer[];
  hoveredFeatures?: MapLibreGeoJSONFeature[];
  snackbar?: BaseSnackbarConfig;
}): Result => {
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

  const vectorLayerEntries = useMemo(
    () => orderedLayers.map((layer) => ({
      id: layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`,
      label: layer.layerConfig?.layerId ?? layer.nodeId,
      sourceId: layer.layerConfig?.sourceId ?? `resource-source-${layer.nodeId}`,
      sourceLayer: layer.layerConfig?.sourceLayer,
    })),
    [orderedLayers],
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
    setSearchTargets(defaults as Record<string, boolean>);
  }, [searchConfig?.targetDefinitions, searchEnabled, searchTargets, setSearchTargets]);

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

  const visitCoordinates = useCallback((coords: unknown, bounds: Bounds | null): Bounds | null => {
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
  }, []);

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
  const effectiveSnackbar = interactionEnabled ? (interactionSnackbar ?? snackbar) : snackbar;

  return {
    interactionEnabled,
    searchEnabled,
    hoverEnabled,
    selectionEnabled,
    fitSelectionEnabled,
    snackbarEnabled,
    searchText,
    setSearchText,
    searchTargets,
    setSearchTargets: (updater) => setSearchTargets((prev) => updater(prev)),
    vectorLayerEntries,
    searchMatches,
    hoverMatches,
    hoveredInteractionFeatures: hoveredInteractionFeatures as MapLibreGeoJSONFeature[],
    selectedMatches,
    snackbarFeatures,
    effectiveSnackbar,
    runSearch,
    handleSearchClear,
    handleSearchTargetToggle,
    handleFitSelection,
    highlightLayerIds,
    highlightLayerPriorityById,
    fitPadding,
  };
};
