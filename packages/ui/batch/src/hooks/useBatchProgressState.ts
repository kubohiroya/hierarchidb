import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toNodeId, type NodeType } from '@hierarchidb/common-types';
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
  nodeId: string | null,
  options: UseBatchProgressStateOptions,
): BatchProgressState => {
  const { autoSubscribe = true, enablePollingFallback = true, mapStatusToUnified } = options;
  const bridgeRef = useRef<WorkerBridge>(getWorkerBridge());
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<BatchSessionStatus | null>(null);

  useEffect(() => {
    if (!nodeId || !autoSubscribe) return;
    void bridgeRef.current.initialize().catch((err: unknown) => {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj);
    });
  }, [autoSubscribe, nodeId]);

  useEffect(() => {
    setStatus(null);
    setError(null);
  }, [nodeId]);

  const adapter = useMemo(() => {
    if (!nodeId) return null;
    const resolvedNodeId = toNodeId(nodeId);
    return createAdapterFromProgressSubscribe((eventCallback) =>
      bridgeRef.current
        .subscribeBatchProgress(nodeType, resolvedNodeId, eventCallback)
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
  }, [nodeType, nodeId]);

  const poll = useMemo(() => {
    if (!nodeId || !enablePollingFallback) return undefined;
    const resolvedNodeId = toNodeId(nodeId);
    return async (): Promise<UnifiedProgressInfo | null> => {
      try {
        const nextStatus = await bridgeRef.current.getBatchSessionStatus(nodeType, resolvedNodeId);
        setStatus(nextStatus);
        return mapStatusToUnified(nextStatus);
      } catch (err: unknown) {
        const errObj = err instanceof Error ? err : new Error('Failed to fetch batch status');
        setError(errObj);
        return null;
      }
    };
  }, [enablePollingFallback, mapStatusToUnified, nodeType, nodeId]);

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
