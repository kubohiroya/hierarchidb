import { useEffect, useRef, useState, useCallback } from 'react';
import type { ProgressInfo } from '../services/tiles/LocationVectorTileService';
import { LocationVectorTileService } from '../services/tiles/LocationVectorTileService';
import { useBatchProgress, type UnifiedProgressInfo } from '@hierarchidb/ui-core/src/hooks/useBatchProgress';

export interface UseLocationProgressOptions {
  autoSubscribe?: boolean;
}

export interface UseLocationProgressState {
  progress: ProgressInfo | null;
  isSubscribed: boolean;
  error: Error | null;
}

/**
 * useLocationProgress - Subscribe to Location batch progress events.
 * The caller provides the `service` instance and `sessionId`.
 */
export function useLocationProgress(
  service: LocationVectorTileService,
  sessionId: string | null,
  options: UseLocationProgressOptions = {}
): UseLocationProgressState & { subscribe: () => void; unsubscribe: () => void } {
  const { autoSubscribe = true } = options;

  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<null | (() => void)>(null);

  const handle = useCallback((p: ProgressInfo) => setProgress(p), []);

  // Unified adapter for shared hook
  const adapter = sessionId
    ? {
        subscribe: (cb: (u: UnifiedProgressInfo) => void) =>
          service.onProgress(sessionId, (p) => cb(p as unknown as UnifiedProgressInfo)),
      }
    : null;
  const shared = useBatchProgress(adapter, { autoSubscribe });

  const subscribe = useCallback(() => {
    if (!sessionId || isSubscribed) return;
    try {
      unsubscribeRef.current = service.onProgress(sessionId, handle);
      setIsSubscribed(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to subscribe'));
    }
  }, [sessionId, isSubscribed, service, handle]);

  const unsubscribe = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setIsSubscribed(false);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    if (autoSubscribe) subscribe();
    return () => { unsubscribe(); };
  }, [sessionId, autoSubscribe, subscribe, unsubscribe]);

  return { progress: shared.progress as unknown as ProgressInfo | null ?? progress, isSubscribed, error, subscribe, unsubscribe };
}
