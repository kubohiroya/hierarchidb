import * as React from 'react';
import { CrossViewStyles } from '@hierarchidb/ui-data-grid';

const logMapLibreFeatureWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[useMapLibreFeatureState]', message, error);
};

export interface UseMapLibreFeatureStateOptions {
  datasetId: string;
  map: any; // MapLibre GL JS map instance
  sourceId: string;
  /** Throttle applyMapLibreFeatureState by ms (default: 0=none) */
  throttleMs?: number;
}

export function useMapLibreFeatureState({ datasetId, map, sourceId, throttleMs = 0 }: UseMapLibreFeatureStateOptions) {
  const last = React.useRef(0);
  React.useEffect(() => {
    if (!map) return;
    const unsub = CrossViewStyles.subscribe(datasetId, () => {
      const now = Date.now();
      if (throttleMs > 0 && now - last.current < throttleMs) return;
      last.current = now;
      try {
        CrossViewStyles.applyMapLibreFeatureState(datasetId, map, sourceId);
      } catch (error) {
        logMapLibreFeatureWarning('Failed to apply MapLibre features state', error);
      }
    });
    return () => {
      try {
        unsub();
      } catch (error) {
        logMapLibreFeatureWarning('Failed to unsubscribe features state watcher', error);
      }
    };
  }, [datasetId, map, sourceId, throttleMs]);
}
