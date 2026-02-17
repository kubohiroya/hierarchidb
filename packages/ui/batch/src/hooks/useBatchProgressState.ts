import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toNodeId, type NodeType } from '@hierarchidb/core-types';
import type { BuildUnifiedProgressInfo } from '@hierarchidb/batch-api';
import { useBuildProgress, createAdapterFromProgressSubscribe } from '@hierarchidb/batch';
import { getBuildWorkerBridge, type BuildWorkerBridge } from '@hierarchidb/ui-worker-client';

export type UseBuildProgressStateOptions = {
  autoSubscribe?: boolean;
};
/** @deprecated Use UseBuildProgressStateOptions. */
export type UseBatchProgressStateOptions = UseBuildProgressStateOptions;

export interface BuildProgressState {
  progress: BuildUnifiedProgressInfo | null;
  error: Error | null;
  subscribe: () => void;
  unsubscribe: () => void;
}
/** @deprecated Use BuildProgressState. */
export type BatchProgressState = BuildProgressState;

export const useBuildProgressState = (
  nodeType: NodeType,
  nodeId: string | null,
  options: UseBuildProgressStateOptions,
): BuildProgressState => {
  const { autoSubscribe = true } = options;
  const bridgeRef = useRef<BuildWorkerBridge>(getBuildWorkerBridge());
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
        .subscribeBuildProgress(nodeType, resolvedNodeId, eventCallback)
        .then((unsubscribe: () => void) => {
          setError(null);
          return unsubscribe;
        })
        .catch((err: unknown) => {
          const errObj = err instanceof Error ? err : new Error('Failed to subscribe to build progress');
          setError(errObj);
          return () => {};
        }),
    );
  }, [nodeType, nodeId]);

  const {
    progress: unifiedProgress,
    subscribe: sharedSubscribe,
    unsubscribe: sharedUnsubscribe,
  } = useBuildProgress(adapter, { autoSubscribe });

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

/** @deprecated Use useBuildProgressState. */
export const useBatchProgressState = useBuildProgressState;
