import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeType } from '@hierarchidb/common-types';
import type { BatchSessionStatus, UnifiedProgressInfo } from '@hierarchidb/common-api';
import { useBatchProgress, createAdapterFromProgressSubscribe } from '@hierarchidb/batch';
import { getWorkerBridge, type WorkerBridge } from '@hierarchidb/ui-worker-client';

export type UseBatchProgressStateOptions = {
  autoSubscribe?: boolean;
  enablePollingFallback?: boolean;
  mapStatusToUnified: (status: BatchSessionStatus) => UnifiedProgressInfo;
};

export interface BatchProgressState {
  progress: UnifiedProgressInfo | null;
  status: BatchSessionStatus | null;
  isSubscribed: boolean;
  error: Error | null;
  subscribe: () => void;
  unsubscribe: () => void;
}

export const useBatchProgressState = (
  nodeType: NodeType,
  sessionId: string | null,
  options: UseBatchProgressStateOptions,
): BatchProgressState => {
  const { autoSubscribe = true, enablePollingFallback = true, mapStatusToUnified } = options;
  const bridgeRef = useRef<WorkerBridge>(getWorkerBridge());
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<BatchSessionStatus | null>(null);

  useEffect(() => {
    if (!sessionId || !autoSubscribe) return;
    void bridgeRef.current.initialize().catch((err: unknown) => {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj);
    });
  }, [autoSubscribe, sessionId]);

  useEffect(() => {
    setStatus(null);
    setError(null);
  }, [sessionId]);

  const adapter = useMemo(() => {
    if (!sessionId) return null;
    return createAdapterFromProgressSubscribe((eventCallback) =>
      bridgeRef.current
        .subscribeBatchProgress(nodeType, sessionId, eventCallback)
        .then((unsubscribe: () => void) => {
          setError(null);
          return unsubscribe;
        })
        .catch((err: unknown) => {
          const errObj = err instanceof Error ? err : new Error('Failed to subscribe to batch progress');
          setError(errObj);
          return () => {};
        }),
    );
  }, [nodeType, sessionId]);

  const poll = useMemo(() => {
    if (!sessionId || !enablePollingFallback) return undefined;
    return async (): Promise<UnifiedProgressInfo | null> => {
      try {
        const nextStatus = await bridgeRef.current.getBatchSessionStatus(nodeType, sessionId);
        setStatus(nextStatus);
        return mapStatusToUnified(nextStatus);
      } catch (err: unknown) {
        const errObj = err instanceof Error ? err : new Error('Failed to fetch batch status');
        setError(errObj);
        return null;
      }
    };
  }, [enablePollingFallback, mapStatusToUnified, nodeType, sessionId]);

  const {
    progress: unifiedProgress,
    subscribed,
    subscribe: sharedSubscribe,
    unsubscribe: sharedUnsubscribe,
  } = useBatchProgress(adapter, { autoSubscribe, poll });

  const subscribe = useCallback(() => {
    void bridgeRef.current.initialize().catch((err: unknown) => {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj);
    });
    sharedSubscribe();
  }, [sharedSubscribe]);

  const unsubscribe = useCallback(() => {
    sharedUnsubscribe();
  }, [sharedUnsubscribe]);

  return {
    progress: unifiedProgress,
    status,
    isSubscribed: subscribed,
    error,
    subscribe,
    unsubscribe,
  };
};
