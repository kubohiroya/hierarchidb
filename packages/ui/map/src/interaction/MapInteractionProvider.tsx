import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Provider, type Store, useStore } from 'jotai';
import {
  type MapInteractionInitialState,
  createMapInteractionStore,
  mapSearchMatchesAtom,
  mapSearchTargetsAtom,
  mapSearchTextAtom,
  mapSelectedMatchesAtom,
} from './mapInteractionStore.js';

export type MapInteractionProviderProps = {
  children: React.ReactNode;
  initialState?: MapInteractionInitialState;
  store?: Store;
};

const MapInteractionInitializer: React.FC<Pick<MapInteractionProviderProps, 'initialState'>> = ({ initialState }) => {
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

  return null;
};

export const MapInteractionProvider: React.FC<MapInteractionProviderProps> = ({
  children,
  initialState,
  store,
}) => {
  const resolvedStore = useMemo(() => store ?? createMapInteractionStore(), [store]);
  return (
    <Provider store={resolvedStore}>
      <MapInteractionInitializer initialState={initialState} />
      {children}
    </Provider>
  );
};
