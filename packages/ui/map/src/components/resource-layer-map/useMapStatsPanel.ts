import { useMemo, useSyncExternalStore } from 'react';
import { isRenderableNode } from './resourceLayerMapHelpers.js';
import type { MapStatsStore } from '../useResourceLayerMapStats.js';

type UseMapStatsPanelParams = {
  store: MapStatsStore;
  renderExtra?: () => React.ReactNode;
};

export const useMapStatsPanel = ({ store, renderExtra }: UseMapStatsPanelParams) => {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const extraNode = useMemo(() => {
    if (!renderExtra) return null;
    const rendered = renderExtra();
    return isRenderableNode(rendered) ? rendered : null;
  }, [renderExtra]);

  return {
    snapshot,
    extraNode,
  };
};
