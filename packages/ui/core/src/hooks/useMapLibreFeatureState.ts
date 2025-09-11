import * as React from 'react';
import { CrossViewStyles } from '../sync/CrossViewStyles';

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
      try { CrossViewStyles.applyMapLibreFeatureState(datasetId, map, sourceId); } catch {}
    });
    return () => { try { (unsub as any)(); } catch {} };
  }, [datasetId, map, sourceId, throttleMs]);
}
