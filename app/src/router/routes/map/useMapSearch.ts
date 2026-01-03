import { useAtom } from 'jotai';
import { useCallback } from 'react';
import type { MapLibreGeoJSONFeature, MapLibreMapInstance } from '@hierarchidb/ui-plugin-shell/ui-map';
import type { MapHighlightEntry, MapSearchTargetId } from '../../../state/mapSearch.atoms.js';
import {
  mapSearchMatchesAtom,
  mapSearchTargetSelectionAtom,
  mapSearchTextAtom,
} from '../../../state/mapSearch.atoms.js';
import { SEARCH_TARGET_DEFINITIONS, SEARCH_TARGET_GROUPS } from './constants.js';

const POINT_TARGETS = SEARCH_TARGET_GROUPS[0]?.targetIds ?? [];
const ROUTE_TARGETS = SEARCH_TARGET_GROUPS[1]?.targetIds ?? [];
const SHAPE_TARGETS = SEARCH_TARGET_GROUPS[2]?.targetIds ?? [];

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

const getTargetsForLayerType = (layerType?: string): MapSearchTargetId[] => {
  if (layerType === 'circle') return POINT_TARGETS;
  if (layerType === 'line') return ROUTE_TARGETS;
  if (layerType === 'fill') return SHAPE_TARGETS;
  return [...POINT_TARGETS, ...ROUTE_TARGETS, ...SHAPE_TARGETS];
};

export type UseMapSearchParams = {
  mapInstance: MapLibreMapInstance | null;
  highlightLayerIds: string[];
  buildHighlightEntry: (feature?: MapLibreGeoJSONFeature | null) => MapHighlightEntry | null;
};

export type UseMapSearchResult = {
  searchText: string;
  searchTargets: Record<MapSearchTargetId, boolean>;
  setSearchText: (value: string) => void;
  runSearch: () => void;
  handleSearchClear: () => void;
  handleSearchTargetToggle: (targetId: MapSearchTargetId) => void;
};

export const useMapSearch = ({
  mapInstance,
  highlightLayerIds,
  buildHighlightEntry,
}: UseMapSearchParams): UseMapSearchResult => {
  const [searchText, setSearchText] = useAtom(mapSearchTextAtom);
  const [searchTargets, setSearchTargets] = useAtom(mapSearchTargetSelectionAtom);
  const [, setSearchMatches] = useAtom(mapSearchMatchesAtom);

  const clearSearchHighlights = useCallback(() => {
    setSearchMatches([]);
  }, [setSearchMatches]);

  const handleSearchClear = useCallback(() => {
    setSearchText('');
    clearSearchHighlights();
  }, [clearSearchHighlights, setSearchText]);

  const handleSearchTargetToggle = useCallback(
    (targetId: MapSearchTargetId) => {
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

    const canvas = mapInstance.getCanvas();
    const features = mapInstance.queryRenderedFeatures(
      [
        [0, 0],
        [canvas.width, canvas.height],
      ],
      { layers: highlightLayerIds },
    ) as MapLibreGeoJSONFeature[];

    const matchedEntries = new Map<string, MapHighlightEntry>();
    for (const feature of features) {
      const properties = (feature?.properties ?? {}) as Record<string, unknown>;
      const layerType = feature.layer?.type;
      const targetIds = getTargetsForLayerType(layerType);
      let matched = false;
      for (const targetId of targetIds) {
        if (!searchTargets[targetId]) continue;
        const targetKeys = SEARCH_TARGET_DEFINITIONS[targetId].keys;
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
    }

    setSearchMatches(Array.from(matchedEntries.values()));
  }, [buildHighlightEntry, clearSearchHighlights, highlightLayerIds, mapInstance, searchTargets, searchText, setSearchMatches]);

  const setSearchTextValue = useCallback(
    (value: string) => {
      setSearchText(value);
    },
    [setSearchText]
  );

  return {
    searchText,
    searchTargets,
    setSearchText: setSearchTextValue,
    runSearch,
    handleSearchClear,
    handleSearchTargetToggle,
  };
};
