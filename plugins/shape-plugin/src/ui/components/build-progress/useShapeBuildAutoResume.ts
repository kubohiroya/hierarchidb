import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { BuildStatus } from '@hierarchidb/components';

type Args = {
  activeNodeId: NodeId | null;
  buildStatus: BuildStatus;
  runtimeStatus: string | null;
  handleStartOrResume: (options: { forceRestart: boolean; autoResume?: boolean }) => Promise<boolean>;
  handlePause: () => void;
  hasFailedFetchTasks: boolean;
  hasDataSource: boolean;
  hasSelection: boolean;
  isProcessingValid: boolean;
};

export const useShapeBuildAutoResume = ({
  activeNodeId,
  buildStatus,
  runtimeStatus,
  handleStartOrResume,
  handlePause,
  hasFailedFetchTasks,
  hasDataSource,
  hasSelection,
  isProcessingValid,
}: Args) => {
  const [isStartPending, setIsStartPending] = useState(false);
  const canStartOrResume = useMemo(() => (
    !isStartPending
    && buildStatus !== 'running'
    && hasDataSource
    && hasSelection
    && isProcessingValid
  ), [buildStatus, hasDataSource, hasSelection, isProcessingValid, isStartPending]);

  useEffect(() => {
    if (!isStartPending) return;
    if (buildStatus !== 'idle') {
      setIsStartPending(false);
    }
  }, [buildStatus, isStartPending]);

  const shouldSuspendRef = useRef(false);
  const activeNodeIdRef = useRef<NodeId | null>(null);
  const suspendIfRunningRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const hasActiveProcessing = runtimeStatus === 'processing';
    const isRunning = buildStatus === 'running';
    const isFinished = runtimeStatus === 'completed' || runtimeStatus === 'failed';
    shouldSuspendRef.current = !isFinished && (hasActiveProcessing || isRunning);
  }, [buildStatus, runtimeStatus]);
  const suspendIfRunning = useCallback(() => {
    if (!shouldSuspendRef.current) return;
    void handlePause();
  }, [handlePause]);
  useEffect(() => {
    activeNodeIdRef.current = activeNodeId ?? null;
    suspendIfRunningRef.current = suspendIfRunning;
  }, [activeNodeId, suspendIfRunning]);
  useEffect(() => {
    const handlePageHide = (event: Event) => {
      const maybePageTransition = event as PageTransitionEvent | undefined;
      if (maybePageTransition?.persisted) return;
      if (!activeNodeIdRef.current) return;
      suspendIfRunningRef.current?.();
    };
    const handleBeforeUnload = () => {
      if (!activeNodeIdRef.current) return;
      suspendIfRunningRef.current?.();
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (!activeNodeIdRef.current) return;
      suspendIfRunningRef.current?.();
    };
  }, []);

  const startOrResume = useCallback(async (options?: { autoResume?: boolean }) => {
    if (isStartPending) return;
    setIsStartPending(true);
    const ok = await handleStartOrResume({
      forceRestart: hasFailedFetchTasks,
      autoResume: options?.autoResume,
    });
    if (!ok) {
      setIsStartPending(false);
    }
  }, [handleStartOrResume, hasFailedFetchTasks, isStartPending]);

  useEffect(() => {
    if (!activeNodeId || !canStartOrResume || isStartPending) return;
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('autoResumeBuild');
      if (!stored || stored !== String(activeNodeId)) return;
      window.localStorage.removeItem('autoResumeBuild');
      void startOrResume({ autoResume: true });
    } catch (error) {
      console.warn('[ShapeBuildStep] auto-resume build failed', error);
    }
  }, [activeNodeId, canStartOrResume, isStartPending, startOrResume]);

  return {
    canStartOrResume,
    isStartPending,
    startOrResume,
  };
};
