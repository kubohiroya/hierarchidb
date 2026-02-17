import { useCallback, useEffect, useRef, useState } from 'react';

import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { getBuildWorkerBridge, type BuildWorkerBridge } from '@hierarchidb/ui-worker-client';

export interface BuildSessionMutationState {
  isMutating: boolean;
  mutationError: string | null;
  pauseSession: () => Promise<boolean>;
  resumeSession: () => Promise<boolean>;
  cancelQueuedBuildSession: (reason?: string) => Promise<boolean>;
  clearMutationError: () => void;
}

export const useBuildSessionMutation = (
  nodeType: NodeType,
  nodeId: NodeId | null,
): BuildSessionMutationState => {
  const bridgeRef = useRef<BuildWorkerBridge>(getBuildWorkerBridge());
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    if (!nodeId) return;
    void bridgeRef.current.initialize().catch((error: unknown) => {
      console.error('[useBuildSessionMutation] failed to initialize worker bridge', error);
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
      console.error('[useBuildSessionMutation] mutation failed', error);
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

  const cancelQueuedBuildSession = useCallback(async (reason?: string): Promise<boolean> => {
    return runMutation(async () => {
      if (!nodeId) return;
      await bridgeRef.current.cancelQueuedBuildSession(nodeType, nodeId, reason);
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
    cancelQueuedBuildSession,
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
