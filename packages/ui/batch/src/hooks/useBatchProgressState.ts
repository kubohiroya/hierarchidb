import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toNodeId, type NodeType } from '@hierarchidb/common-types';
import type { UnifiedProgressInfo } from '@hierarchidb/common-api';
import { useBatchProgress, createAdapterFromProgressSubscribe } from '@hierarchidb/batch';
import { getWorkerBridge, type WorkerBridge } from '@hierarchidb/ui-worker-client';

export type UseBatchProgressStateOptions = {
  autoSubscribe?: boolean;
};

export interface BatchProgressState {
  progress: UnifiedProgressInfo | null;
  error: Error | null;
  subscribe: () => void;
  unsubscribe: () => void;
}

export const useBatchProgressState = (
  nodeType: NodeType,
  nodeId: string | null,
  options: UseBatchProgressStateOptions,
): BatchProgressState => {
  const { autoSubscribe = true } = options;
  const bridgeRef = useRef<WorkerBridge>(getWorkerBridge());
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!nodeId || !autoSubscribe) return;
    void bridgeRef.current.initialize().catch((err: unknown) => {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj);
    });
  }, [autoSubscribe, nodeId]);

  useEffect(() => {
    setError(null);
  }, []);

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

  const {
    progress: unifiedProgress,
    subscribe: sharedSubscribe,
    unsubscribe: sharedUnsubscribe,
  } = useBatchProgress(adapter, { autoSubscribe });

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
    error,
    subscribe,
    unsubscribe,
  };
};
