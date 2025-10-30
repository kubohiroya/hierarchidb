import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeType, ProgressEvent } from '@hierarchidb/common-types';
import type { UnifiedProgressInfo } from '@hierarchidb/common-api';
import { useBatchProgress, createAdapterFromProgressSubscribe } from '@hierarchidb/batch';
import { AuthNotificationRegistry } from '@hierarchidb/common-auth';
import { getWorkerBridge, type WorkerBridge } from '@hierarchidb/plugin-base';

export interface UseLocationProgressOptions {
  autoSubscribe?: boolean;
}

export interface LocationProgressEvent extends ProgressEvent {
  message?: string;
}

export interface UseLocationProgressState {
  progress: LocationProgressEvent | null;
  unifiedProgress: UnifiedProgressInfo | null;
  isSubscribed: boolean;
  error: Error | null;
}

const LOCATION_NODE_TYPE = 'location' as NodeType;

type ExtendedProgressInfo = UnifiedProgressInfo & {
  phase?: string;
  timestamp?: number;
  message?: string;
  nodeId?: string;
  sessionId?: string;
};

function toProgressEvent(
  info: ExtendedProgressInfo | null,
  fallbackSessionId?: string,
): LocationProgressEvent | null {
  if (!info) return null;
  const sessionId = (info.sessionId as string | undefined) ?? fallbackSessionId ?? 'location';
  const stage = info.phase === 'completed' ? 'completed' : info.stage;
  const event: LocationProgressEvent = {
    sessionId,
    stage,
    total: info.total ?? 0,
    completed: info.completed ?? 0,
    failed: info.failed ?? 0,
    percentage: info.percentage ?? 0,
    currentTask: info.currentTask ?? info.message ?? stage,
    timestamp: typeof info.timestamp === 'number' ? info.timestamp : Date.now(),
    message: info.message,
  };
  return event;
}

/**
 * useLocationProgress - Subscribe to Location batch progress events via WorkerBridge.
 */
export function useLocationProgress(
  sessionId: string | null,
  options: UseLocationProgressOptions = {},
): UseLocationProgressState & { subscribe: () => void; unsubscribe: () => void } {
  const { autoSubscribe = true } = options;
  const bridgeRef = useRef<WorkerBridge>(getWorkerBridge());
  const [overrideProgress, setOverrideProgress] = useState<LocationProgressEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!sessionId || !autoSubscribe) return;
    void bridgeRef.current.initialize().catch((err: unknown) => {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
    });
  }, [autoSubscribe, sessionId]);

  useEffect(() => {
    setOverrideProgress(null);
  }, [sessionId]);

  const adapter = useMemo(() => {
    if (!sessionId) return null;
    return createAdapterFromProgressSubscribe((cb) =>
      bridgeRef.current
        .subscribeBatchProgress(LOCATION_NODE_TYPE, sessionId, cb)
        .then((unsubscribe: () => void) => {
          setError(null);
          return unsubscribe;
        })
        .catch((err: unknown) => {
          const errorObj = err instanceof Error ? err : new Error('Failed to subscribe to location batch progress');
          setError(errorObj);
          return () => {
          };
        }),
    );
  }, [sessionId]);

  const {
    progress: unifiedProgress,
    subscribed,
    subscribe: sharedSubscribe,
    unsubscribe: sharedUnsubscribe,
  } = useBatchProgress(adapter, { autoSubscribe });

  useEffect(() => {
    if (unifiedProgress) {
      setOverrideProgress(null);
    }
  }, [unifiedProgress]);

  useEffect(() => {
    const registry = AuthNotificationRegistry.getInstance?.();
    if (!registry) return;
    const id = 'location-progress-hook';
    registry.register?.(id, {
      onAuthRequired: async (n: any) => {
        setOverrideProgress({
          sessionId: sessionId || n?.context?.sessionId || 'location',
          stage: 'auth-required',
          total: 1,
          completed: 0,
          failed: 0,
          percentage: 0,
          currentTask: n?.context?.errorMessage || 'Authentication required',
          timestamp: Date.now(),
          message: n?.context?.errorMessage,
        });
      },
      onAuthSuccess: async (_n: any) => {
        setOverrideProgress({
          sessionId: sessionId || 'location',
          stage: 'resumed',
          total: 1,
          completed: 1,
          failed: 0,
          percentage: 100,
          currentTask: 'Authentication successful - resuming',
          timestamp: Date.now(),
          message: 'Authentication successful - resuming',
        });
      },
      onAuthCancelled: async (n: any) => {
        setOverrideProgress({
          sessionId: sessionId || 'location',
          stage: 'cancelled',
          total: 1,
          completed: 0,
          failed: 1,
          percentage: 0,
          currentTask: n?.context?.reason || 'Authentication cancelled',
          timestamp: Date.now(),
          message: n?.context?.reason,
        });
      },
    });
    return () => {
      registry.unregister?.(id);
    };
  }, [sessionId]);

  const subscribe = useCallback(() => {
    void bridgeRef.current.initialize().catch((err: unknown) => {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
    });
    sharedSubscribe();
  }, [sharedSubscribe]);

  const unsubscribe = useCallback(() => {
    sharedUnsubscribe();
  }, [sharedUnsubscribe]);

  const derived = toProgressEvent(unifiedProgress as ExtendedProgressInfo | null, sessionId ?? undefined);
  const combined = derived ?? overrideProgress;

  return {
    progress: combined,
    unifiedProgress: unifiedProgress ?? null,
    isSubscribed: subscribed,
    error,
    subscribe,
    unsubscribe,
  };
}
