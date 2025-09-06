import { useEffect, useRef, useState, useCallback } from 'react';
import type { ProgressEvent } from '@hierarchidb/common-type';
import { LocationVectorTileService } from '../services/tiles/LocationVectorTileService';
import { useBatchProgress, type UnifiedProgressInfo } from '@hierarchidb/ui-core/src/hooks/useBatchProgress';
import { AuthNotificationRegistry } from '@hierarchidb/common-auth';

export interface UseLocationProgressOptions {
  autoSubscribe?: boolean;
}

export interface UseLocationProgressState {
  progress: ProgressEvent | null;
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

  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<null | (() => void)>(null);
  const unsubscribeAuthRef = useRef<null | (() => void)>(null);

  const handle = useCallback((p: ProgressEvent) => setProgress(p), []);

  // Unified adapter for shared hook
  const adapter = sessionId
    ? {
        subscribe: (cb: (u: UnifiedProgressInfo) => void) =>
          service.onProgress(sessionId, (p) => cb({
            stage: p.stage,
            total: p.total,
            completed: p.completed,
            failed: p.failed,
            percentage: p.percentage,
            currentTask: p.currentTask,
          })),
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

  // Subscribe to global auth notifications and reflect as progress events
  useEffect(() => {
    const reg = AuthNotificationRegistry.getInstance?.();
    if (!reg) return;
    const id = 'location-progress-hook';
    reg.register?.(id, {
      onAuthRequired: async (n: any) => {
        setProgress({
          sessionId: sessionId || n?.context?.sessionId || 'location',
          stage: 'auth-required',
          total: 1,
          completed: 0,
          failed: 0,
          percentage: 0,
          currentTask: n?.context?.errorMessage || 'Authentication required',
          timestamp: Date.now(),
        });
      },
      onAuthSuccess: async (_n: any) => {
        setProgress({
          sessionId: sessionId || 'location',
          stage: 'resumed',
          total: 1,
          completed: 1,
          failed: 0,
          percentage: 100,
          currentTask: 'Authentication successful - resuming',
          timestamp: Date.now(),
        });
      },
      onAuthCancelled: async (n: any) => {
        setProgress({
          sessionId: sessionId || 'location',
          stage: 'cancelled',
          total: 1,
          completed: 0,
          failed: 1,
          percentage: 0,
          currentTask: n?.context?.reason || 'Authentication cancelled',
          timestamp: Date.now(),
        });
      },
    });
    unsubscribeAuthRef.current = () => reg.unregister?.(id);
    return () => { unsubscribeAuthRef.current?.(); };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    if (autoSubscribe) subscribe();
    return () => { unsubscribe(); };
  }, [sessionId, autoSubscribe, subscribe, unsubscribe]);

  return { progress: (shared.progress as unknown as ProgressEvent | null) ?? progress, isSubscribed, error, subscribe, unsubscribe };
}
