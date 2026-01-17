import { atom, createStore } from 'jotai';
import type { Store } from 'jotai';
import type { MapLibreGeoJSONFeature } from '../types/maplibre-public.js';

export type MapHighlightEntry = {
  source: string;
  id: string | number;
  layerId?: string;
  nodeId?: string;
  nodeType?: string;
};

export type MapHoverCandidate = {
  entry: MapHighlightEntry;
  feature: MapLibreGeoJSONFeature;
};

export type MapInteractionInitialState = {
  searchText?: string;
  searchTargets?: Record<string, boolean>;
  searchMatches?: MapHighlightEntry[];
  selectedMatches?: MapHighlightEntry[];
};

export const buildHighlightKey = (entry: MapHighlightEntry): string => `${entry.source}:${entry.id}`;

export const mapSearchTextAtom = atom('');
export const mapSearchTargetsAtom = atom<Record<string, boolean>>({});
export const mapSearchMatchesAtom = atom<MapHighlightEntry[]>([]);
export const mapSearchMatchKeysAtom = atom((get) => new Set(get(mapSearchMatchesAtom).map(buildHighlightKey)));

export const mapHoverCandidatesAtom = atom<MapHoverCandidate[]>([]);
export const mapHoverMatchesAtom = atom((get) => get(mapHoverCandidatesAtom).map((candidate) => candidate.entry));
export const mapHoverMatchKeysAtom = atom((get) => new Set(get(mapHoverMatchesAtom).map(buildHighlightKey)));
export const mapHoveredFeaturesAtom = atom((get) => get(mapHoverCandidatesAtom).map((candidate) => candidate.feature));

export const mapSelectedMatchesAtom = atom<MapHighlightEntry[]>([]);
export const mapSelectedMatchKeysAtom = atom((get) => new Set(get(mapSelectedMatchesAtom).map(buildHighlightKey)));

export const mapViewportFeatureIdsAtom = atom<Map<string, Set<string | number>> | null>(null);

export const createMapInteractionStore = (
  initialState?: MapInteractionInitialState,
): Store => {
  const store = createStore();
  if (initialState?.searchText !== undefined) {
    store.set(mapSearchTextAtom, initialState.searchText);
  }
  if (initialState?.searchTargets) {
    store.set(mapSearchTargetsAtom, initialState.searchTargets);
  }
  if (initialState?.searchMatches) {
    store.set(mapSearchMatchesAtom, initialState.searchMatches);
  }
  if (initialState?.selectedMatches) {
    store.set(mapSelectedMatchesAtom, initialState.selectedMatches);
  }
  return store;
};
