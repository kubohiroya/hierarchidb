import type React from 'react';
import { Provider } from 'jotai';
import type { Store } from 'jotai/vanilla/store';
import type { MapInteractionInitialState } from './mapInteractionStore.js';
import {
  useMapInteractionInitializer,
  useResolvedMapInteractionStore,
} from './useMapInteractionProviderView.js';

export type MapInteractionProviderProps = {
  children: React.ReactNode;
  initialState?: MapInteractionInitialState;
  store?: Store;
};

const MapInteractionInitializer: React.FC<Pick<MapInteractionProviderProps, 'initialState'>> = ({ initialState }) => {
  useMapInteractionInitializer({ initialState });
  return null;
};

export const MapInteractionProvider: React.FC<MapInteractionProviderProps> = ({
  children,
  initialState,
  store,
}) => {
  const resolvedStore = useResolvedMapInteractionStore({ store });
  return (
    <Provider store={resolvedStore}>
      <MapInteractionInitializer initialState={initialState} />
      {children}
    </Provider>
  );
};
