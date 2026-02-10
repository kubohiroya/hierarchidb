import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildStopReason } from '@hierarchidb/shape-api';
import type { BuildStatus } from '@hierarchidb/components/build-status';

type Args = {
  activeNodeId: NodeId | null;
  buildStatus: BuildStatus;
  stopReason?: ShapeBuildStopReason;
  runtimeStatus: string | null;
  handleStartOrResume: (options: { forceRestart: boolean; autoResume?: boolean }) => Promise<boolean>;
  handlePause: (reason?: 'route-leave' | 'user-pause') => void;
  hasFailedFetchTasks: boolean;
  hasDataSource: boolean;
  hasSelection: boolean;
  isProcessingValid: boolean;
  isLockSupported: boolean;
};

export const useShapeBuildAutoResume = ({
  activeNodeId,
  buildStatus,
  stopReason,
  runtimeStatus,
  handleStartOrResume,
  handlePause,
  hasFailedFetchTasks,
  hasDataSource,
  hasSelection,
  isProcessingValid,
  isLockSupported,
}: Args) => {
  const [isStartPending, setIsStartPending] = useState(false);
  const isStartPendingRef = useRef(false);
  const setStartPending = useCallback((next: boolean, immediate = false) => {
    isStartPendingRef.current = next;
    if (immediate) {
      flushSync(() => {
        setIsStartPending(next);
      });
      return;
    }
    setIsStartPending(next);
  }, []);
  const canStartOrResume = useMemo(() => (
    !isStartPending
    && buildStatus !== 'running'
    && hasDataSource
    && hasSelection
    && isProcessingValid
    && isLockSupported
  ), [buildStatus, hasDataSource, hasSelection, isLockSupported, isProcessingValid, isStartPending]);

  useEffect(() => {
    if (!isStartPending) return;
    if (buildStatus === 'running' || buildStatus === 'completed' || buildStatus === 'failed') {
      setStartPending(false);
    }
  }, [buildStatus, isStartPending, setStartPending]);

  const shouldSuspendRef = useRef(false);
  const activeNodeIdRef = useRef<NodeId | null>(null);
  const suspendIfRunningRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const hasActiveProcessing = runtimeStatus === 'processing';
    const isRunning = buildStatus === 'running';
    const isFinished = runtimeStatus === 'completed' || runtimeStatus === 'failed';
    shouldSuspendRef.current = !isFinished && (hasActiveProcessing || isRunning);
  }, [buildStatus, runtimeStatus]);
  const canAutoResume = useMemo(() => {
    if (buildStatus === 'completed' || buildStatus === 'failed') return false;
    if (buildStatus === 'paused') return stopReason === 'route-leave';
    if (stopReason && stopReason !== 'route-leave') return false;
    return runtimeStatus === 'processing' || buildStatus === 'idle';
  }, [buildStatus, runtimeStatus, stopReason]);

  const suspendIfRunning = useCallback(() => {
    if (!shouldSuspendRef.current) return;
    void handlePause('route-leave');
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
    };
  }, []);

  const startOrResume = useCallback(async (options?: { autoResume?: boolean }) => {
    if (isStartPendingRef.current) return;
    if (!isLockSupported) return;
    setStartPending(true, true);
    const ok = await handleStartOrResume({
      forceRestart: hasFailedFetchTasks,
      autoResume: options?.autoResume,
    });
    if (!ok) {
      setStartPending(false);
    }
  }, [handleStartOrResume, hasFailedFetchTasks, isLockSupported, setStartPending]);
  const clearStartPending = useCallback(() => {
    setStartPending(false);
  }, [setStartPending]);

  useEffect(() => {
    if (!activeNodeId || !canStartOrResume || isStartPending) return;
    if (!isLockSupported) return;
    if (typeof window === 'undefined') return;
    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.removeItem !== 'function') return;
    try {
      const stored = storage.getItem('autoResumeBuild');
      if (!stored || stored !== String(activeNodeId)) return;
      if (!canAutoResume) {
        storage.removeItem('autoResumeBuild');
        return;
      }
      storage.removeItem('autoResumeBuild');
      void startOrResume({ autoResume: true });
    } catch (error) {
      console.warn('[ShapeBuildStep] auto-resume build failed', error);
    }
  }, [activeNodeId, canAutoResume, canStartOrResume, isStartPending, startOrResume]);

  return {
    canStartOrResume,
    isStartPending,
    startOrResume,
    clearStartPending,
  };
};
