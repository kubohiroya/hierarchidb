import { useCallback } from 'react';
import { notify } from '@hierarchidb/components/notify';
import type { StartOrResumeControlActionsArgs, StartOrResumeOptions } from './types.js';
import { shouldResumeBuildSession } from '~/ui/components/build-progress/shouldResumeBuildSession';
import { executeStartOrResumeFlow } from './useShapeBuildStartOrResumeExecution.js';

export const useShapeBuildStartOrResume = ({
  activeNodeId,
  data,
  buildStatus,
  runtimeStatus,
  bridgeRef,
  beginBuildSessionTransition,
  advanceBuildSessionTransitionPhase,
  finishBuildSessionTransition,
  beginBuildStartupStep,
  finishBuildStartupStep,
  emitBuildSessionTransitionLog,
  releaseBuildLock,
  tryAcquireBuildLock,
  waitForBuildLock,
  cancelStartRequestRef,
  saveDraftBeforeBuild,
  refreshTasks,
  updateSessionRecord,
  setIsStopRequested,
  setIsStopAccepted,
}: StartOrResumeControlActionsArgs) => {
  const handleStartOrResume = useCallback(async (options?: StartOrResumeOptions): Promise<boolean> => {
    const requestStartedAt = Date.now();
    setIsStopRequested(false);
    setIsStopAccepted(false);
    cancelStartRequestRef.current = false;

    const startupSource = options?.autoResume ? 'auto' : 'manual';
    const shouldResumeSession = shouldResumeBuildSession({
      forceRestart: options?.forceRestart,
      buildStatus,
      runtimeStatus,
    });
    const bridgeApi = bridgeRef.current;

    if (!bridgeApi) {
      notify.warning('Build worker is not ready.');
      finishBuildSessionTransition({
        level: 'error',
        message: 'Build worker is not available.',
      });
      return false;
    }
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return false;
    }
    if (shouldResumeSession && !bridgeApi.resumeBuildSession) {
      notify.warning('Build resume API is not available.');
      return false;
    }
    if (!shouldResumeSession && !bridgeApi.startBuildSession) {
      notify.warning('Build start API is not available.');
      return false;
    }
    await refreshTasks();

    return executeStartOrResumeFlow({
      activeNodeId,
      data,
      buildStatus,
      runtimeStatus,
      beginBuildSessionTransition,
      advanceBuildSessionTransitionPhase,
      finishBuildSessionTransition,
      beginBuildStartupStep,
      finishBuildStartupStep,
      emitBuildSessionTransitionLog,
      releaseBuildLock,
      tryAcquireBuildLock,
      waitForBuildLock,
      cancelStartRequestRef,
      saveDraftBeforeBuild,
      updateSessionRecord,
      refreshTasks,
      setIsStopRequested,
      setIsStopAccepted,
      options,
      startupSource,
      shouldResumeSession,
      onTrace: (trace) => {
        console.log('[ShapeBuildStartResumeTrace] handleStartOrResume', {
          nodeId: String(activeNodeId),
          elapsedMs: Math.max(0, Date.now() - requestStartedAt),
          event: trace.event,
          ...(trace.payload ?? {}),
        });
      },
      requestStartedAt,
      runTimedStep: async <T, >(stepName: string, runner: () => Promise<T>): Promise<T> => {
        const stepStartedAt = Date.now();
        console.log('[ShapeBuildStartResumeTrace] handleStartOrResume', {
          nodeId: String(activeNodeId),
          elapsedMs: Math.max(0, Date.now() - requestStartedAt),
          event: `${stepName}:start`,
        });
        try {
          const result = await runner();
          console.log('[ShapeBuildStartResumeTrace] handleStartOrResume', {
            nodeId: String(activeNodeId),
            elapsedMs: Math.max(0, Date.now() - requestStartedAt),
            event: `${stepName}:finish`,
            stepElapsedMs: Math.max(0, Date.now() - stepStartedAt),
          });
          return result;
        } catch (error) {
          console.log('[ShapeBuildStartResumeTrace] handleStartOrResume', {
            nodeId: String(activeNodeId),
            elapsedMs: Math.max(0, Date.now() - requestStartedAt),
            event: `${stepName}:error`,
            stepElapsedMs: Math.max(0, Date.now() - stepStartedAt),
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      },
      bridgeRef,
    });
  }, [
    data,
    activeNodeId,
    buildStatus,
    runtimeStatus,
    bridgeRef,
    beginBuildSessionTransition,
    advanceBuildSessionTransitionPhase,
    beginBuildStartupStep,
    finishBuildSessionTransition,
    finishBuildStartupStep,
    emitBuildSessionTransitionLog,
    releaseBuildLock,
    tryAcquireBuildLock,
    waitForBuildLock,
    cancelStartRequestRef,
    saveDraftBeforeBuild,
    refreshTasks,
    updateSessionRecord,
    setIsStopRequested,
    setIsStopAccepted,
  ]);

  return handleStartOrResume;
};
