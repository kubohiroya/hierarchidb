import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildStopReason } from '@hierarchidb/shape-api';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';

type Args = {
  activeNodeId: NodeId | null;
  buildStatus: BuildStatus;
  stopReason?: ShapeBuildStopReason;
  runtimeStatus: string | null;
  handleStartOrResume: (options: { forceRestart: boolean; autoResume?: boolean }) => Promise<boolean>;
  handlePause: (reason?: 'route-leave' | 'user-pause') => void;
  hasFailedSourceTasks: boolean;
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
  hasFailedSourceTasks,
  hasDataSource,
  hasSelection,
  isProcessingValid,
  isLockSupported,
}: Args) => {
  const [isStartPending, setIsStartPending] = useState(false);
  const isStartPendingRef = useRef(false);
  const setStartPending = useCallback((next: boolean) => {
    isStartPendingRef.current = next;
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
    if (
      buildStatus === 'running'
      || buildStatus === 'completed'
      || buildStatus === 'failed'
      || buildStatus === 'paused'
    ) {
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
    setStartPending(true);
    const ok = await handleStartOrResume({
      forceRestart: hasFailedSourceTasks,
      autoResume: options?.autoResume,
    });
    if (!ok) {
      setStartPending(false);
    }
  }, [handleStartOrResume, hasFailedSourceTasks, isLockSupported, setStartPending]);
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

      // セッション状態との整合性をチェック
      if (!canAutoResume) {
        console.log('[ShapeBuildAutoResume] Removing autoResumeBuild flag - cannot auto resume', {
          buildStatus,
          runtimeStatus,
          stopReason,
        });
        storage.removeItem('autoResumeBuild');
        return;
      }

      // 実際のセッション状態を確認してから自動再開
      console.log('[ShapeBuildAutoResume] Attempting auto resume', {
        nodeId: String(activeNodeId),
        buildStatus,
        runtimeStatus,
        stopReason,
      });

      storage.removeItem('autoResumeBuild');
      void startOrResume({ autoResume: true });
    } catch (error) {
      console.warn('[ShapeBuildStep] auto-resume build failed', error);
      // エラー時はautoResumeBuildフラグを削除
      try {
        storage.removeItem('autoResumeBuild');
      } catch (cleanupError) {
        console.warn('[ShapeBuildStep] failed to cleanup autoResumeBuild flag', cleanupError);
      }
    }
  }, [activeNodeId, canAutoResume, canStartOrResume, isStartPending, startOrResume, buildStatus, runtimeStatus, stopReason]);

  return {
    canStartOrResume,
    isStartPending,
    startOrResume,
    clearStartPending,
  };
};
