import { useStore } from 'jotai';
import type { Store } from 'jotai/vanilla/store';
import { useEffect, useMemo, useRef } from 'react';
import {
  createMapInteractionStore,
  type MapInteractionInitialState,
  mapSearchMatchesAtom,
  mapSearchTargetsAtom,
  mapSearchTextAtom,
  mapSelectedMatchesAtom,
} from './mapInteractionStore.js';

type UseMapInteractionInitializerArgs = {
  initialState?: MapInteractionInitialState;
};

type UseResolvedMapInteractionStoreArgs = {
  store?: Store;
};

export const useMapInteractionInitializer = ({
  initialState,
}: UseMapInteractionInitializerArgs): void => {
  const initializedRef = useRef(false);
  const store = useStore();

  useEffect(() => {
    if (initializedRef.current) return;
    if (!initialState) {
      initializedRef.current = true;
      return;
    }
    if (initialState.searchText !== undefined) {
      store.set(mapSearchTextAtom, initialState.searchText);
    }
    if (initialState.searchTargets) {
      store.set(mapSearchTargetsAtom, initialState.searchTargets);
    }
    if (initialState.searchMatches) {
      store.set(mapSearchMatchesAtom, initialState.searchMatches);
    }
    if (initialState.selectedMatches) {
      store.set(mapSelectedMatchesAtom, initialState.selectedMatches);
    }
    initializedRef.current = true;
  }, [initialState, store]);
};

export const useResolvedMapInteractionStore = ({
  store,
}: UseResolvedMapInteractionStoreArgs): Store =>
  useMemo(() => store ?? createMapInteractionStore(), [store]);
