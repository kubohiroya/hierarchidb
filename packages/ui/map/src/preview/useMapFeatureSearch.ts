import { useCallback } from 'react';
import type {
  MapLibreGeoJSONFeature,
  MapLibreMapInstance,
} from '~/types/maplibre-public';
import type { MapSearchTargetDefinition } from './mapPreviewSearchTypes.js';

const normalizeSearchValue = (value: string) => value.trim().toLowerCase();

const coerceString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const getNestedValue = (source: Record<string, unknown>, keyPath: string): unknown => {
  const parts = keyPath.split('.');
  let current: unknown = source;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

const collectSearchValues = (properties: Record<string, unknown>, keys: string[]): string[] => {
  const values = new Set<string>();
  keys.forEach((keyPath) => {
    const raw = getNestedValue(properties, keyPath);
    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        const next = coerceString(item);
        if (next) values.add(next);
      });
      return;
    }
    const next = coerceString(raw);
    if (next) values.add(next);
  });
  return Array.from(values);
};

const getTargetsForLayerType = <TargetId extends string>(
  layerType: string | undefined,
  definitions: Record<TargetId, MapSearchTargetDefinition>,
): TargetId[] => {
  const group =
    layerType === 'circle' ? 'point' : layerType === 'line' ? 'route' : layerType === 'fill' ? 'shape' : null;
  const targetIds = Object.keys(definitions) as TargetId[];
  if (!group) return targetIds;
  return targetIds.filter((targetId) => definitions[targetId].group === group);
};

export type UseMapFeatureSearchParams<TargetId extends string, HighlightEntry extends { source: string; id: string | number }> = {
  mapInstance: MapLibreMapInstance | null;
  highlightLayerIds: string[];
  searchText: string;
  searchTargets: Record<TargetId, boolean>;
  targetDefinitions: Record<TargetId, MapSearchTargetDefinition>;
  buildHighlightEntry: (feature?: MapLibreGeoJSONFeature | null) => HighlightEntry | null;
  onMatchesChange: (entries: HighlightEntry[]) => void;
  onFeaturesChange?: (features: MapLibreGeoJSONFeature[]) => void;
  onSearchComplete?: (result: { entries: HighlightEntry[]; features: MapLibreGeoJSONFeature[] }) => void;
  setSearchText?: (value: string) => void;
  setSearchTargets?: (updater: (prev: Record<TargetId, boolean>) => Record<TargetId, boolean>) => void;
  onMissingLayers?: (layerIds: string[]) => void;
};

export type UseMapFeatureSearchResult<TargetId extends string> = {
  runSearch: () => void;
  handleSearchClear: () => void;
  handleSearchTargetToggle: (targetId: TargetId) => void;
};

export const useMapFeatureSearch = <TargetId extends string, HighlightEntry extends { source: string; id: string | number }>({
  mapInstance,
  highlightLayerIds,
  searchText,
  searchTargets,
  targetDefinitions,
  buildHighlightEntry,
  onMatchesChange,
  onFeaturesChange,
  onSearchComplete,
  setSearchText,
  setSearchTargets,
  onMissingLayers,
}: UseMapFeatureSearchParams<TargetId, HighlightEntry>): UseMapFeatureSearchResult<TargetId> => {
  const clearSearchHighlights = useCallback(() => {
    onMatchesChange([]);
    onFeaturesChange?.([]);
  }, [onFeaturesChange, onMatchesChange]);

  const handleSearchClear = useCallback(() => {
    if (setSearchText) {
      setSearchText('');
    }
    clearSearchHighlights();
  }, [clearSearchHighlights, setSearchText]);

  const handleSearchTargetToggle = useCallback(
    (targetId: TargetId) => {
      if (!setSearchTargets) return;
      setSearchTargets((prev) => ({ ...prev, [targetId]: !prev[targetId] }));
    },
    [setSearchTargets]
  );

  const runSearch = useCallback(() => {
    if (!mapInstance) return;
    const query = normalizeSearchValue(searchText);
    if (!query) {
      clearSearchHighlights();
      return;
    }

    if (typeof mapInstance.getLayer === 'function') {
      const missingLayerIds = highlightLayerIds.filter((layerId) => !mapInstance.getLayer(layerId));
      if (missingLayerIds.length > 0) {
        onMissingLayers?.(missingLayerIds);
        return;
      }
    }

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
      console.debug('[MapPreview] Failed to query search features', error);
      return;
    }

    const matchedEntries = new Map<string, HighlightEntry>();
    const matchedFeatures: MapLibreGeoJSONFeature[] = [];
    for (const feature of features) {
      const properties = (feature?.properties ?? {}) as Record<string, unknown>;
      const layerType = feature.layer?.type;
      const targetIds = getTargetsForLayerType(layerType, targetDefinitions);
      let matched = false;
      for (const targetId of targetIds) {
        if (!searchTargets[targetId]) continue;
        const targetKeys = targetDefinitions[targetId].keys;
        const values = collectSearchValues(properties, targetKeys);
        if (values.some((value) => normalizeSearchValue(value).startsWith(query))) {
          matched = true;
          break;
        }
      }
      if (!matched) continue;
      const entry = buildHighlightEntry(feature);
      if (!entry) continue;
      matchedEntries.set(`${entry.source}:${entry.id}`, entry);
      matchedFeatures.push(feature);
    }

    const entryList = Array.from(matchedEntries.values());
    onMatchesChange(entryList);
    onFeaturesChange?.(matchedFeatures);
    onSearchComplete?.({ entries: entryList, features: matchedFeatures });
  }, [
    buildHighlightEntry,
    clearSearchHighlights,
    highlightLayerIds,
    mapInstance,
    onMatchesChange,
    onFeaturesChange,
    onSearchComplete,
    onMissingLayers,
    searchText,
    searchTargets,
    targetDefinitions,
  ]);

  return {
    runSearch,
    handleSearchClear,
    handleSearchTargetToggle,
  };
};
