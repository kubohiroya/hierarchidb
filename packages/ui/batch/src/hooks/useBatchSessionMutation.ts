import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { getWorkerBridge, type WorkerBridge } from '@hierarchidb/ui-worker-client';

export interface BatchSessionMutationState {
  isMutating: boolean;
  mutationError: string | null;
  pauseSession: () => Promise<boolean>;
  resumeSession: () => Promise<boolean>;
  cancelQueuedSession: (reason?: string) => Promise<boolean>;
  clearMutationError: () => void;
}

export const useBatchSessionMutation = (
  nodeType: NodeType,
  nodeId: NodeId | null,
): BatchSessionMutationState => {
  const bridgeRef = useRef<WorkerBridge>(getWorkerBridge());
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    if (!nodeId) return;
    void bridgeRef.current.initialize().catch((error: unknown) => {
      console.error('[useBatchSessionMutation] failed to initialize worker bridge', error);
      setMutationError(toErrorMessage(error));
    });
  }, [nodeId]);

  const runMutation = useCallback(async (
    operation: () => Promise<void>,
  ): Promise<boolean> => {
    if (!nodeId || isMutating) return false;
    setIsMutating(true);
    setMutationError(null);
    try {
      await operation();
      return true;
    } catch (error: unknown) {
      console.error('[useBatchSessionMutation] mutation failed', error);
      setMutationError(toErrorMessage(error));
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [isMutating, nodeId]);

  const pauseSession = useCallback(async (): Promise<boolean> => {
    return runMutation(async () => {
      if (!nodeId) return;
      await bridgeRef.current.pauseBuildSession(nodeType, nodeId);
    });
  }, [nodeId, nodeType, runMutation]);

  const resumeSession = useCallback(async (): Promise<boolean> => {
    return runMutation(async () => {
      if (!nodeId) return;
      await bridgeRef.current.resumeBuildSession(nodeType, nodeId);
    });
  }, [nodeId, nodeType, runMutation]);

  const cancelQueuedSession = useCallback(async (reason?: string): Promise<boolean> => {
    return runMutation(async () => {
      if (!nodeId) return;
      const bridge = bridgeRef.current as WorkerBridge & {
        cancelQueuedBuildSession?: (nodeType: NodeType, nodeId: NodeId, reason?: string) => Promise<void>;
        cancelQueuedBatchSession?: (nodeType: NodeType, nodeId: NodeId, reason?: string) => Promise<void>;
      };
      if (typeof bridge.cancelQueuedBuildSession === 'function') {
        await bridge.cancelQueuedBuildSession(nodeType, nodeId, reason);
        return;
      }
      if (typeof bridge.cancelQueuedBatchSession === 'function') {
        await bridge.cancelQueuedBatchSession(nodeType, nodeId, reason);
      }
    });
  }, [nodeId, nodeType, runMutation]);

  const clearMutationError = useCallback(() => {
    setMutationError(null);
  }, []);

  return {
    isMutating,
    mutationError,
    pauseSession,
    resumeSession,
    cancelQueuedSession,
    clearMutationError,
  };
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}
