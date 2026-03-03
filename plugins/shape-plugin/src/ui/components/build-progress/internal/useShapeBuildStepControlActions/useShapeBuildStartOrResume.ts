import { useCallback } from 'react';
import { notify } from '@hierarchidb/components/notify';
import type { StartOrResumeControlActionsArgs, StartOrResumeOptions } from './types.js';
import { shouldResumeBuildSession } from '~/ui/components/build-progress/shouldResumeBuildSession';
import { executeStartOrResumeFlow } from './executeStartOrResumeFlow.js';
import { isShapeBuildPanelDebugEnabled } from '~/ui/components/build-progress/useBuildProgressPanelState/useBuildProgressPanelState.utils.js';

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
  setRequestedControlAction,
  saveDraftBeforeBuild,
  updateSessionRecord,
  setIsStopRequested,
  setIsStopAccepted,
}: StartOrResumeControlActionsArgs) => {
  const handleStartOrResume = useCallback(async (options?: StartOrResumeOptions): Promise<boolean> => {
    const requestStartedAt = Date.now();
    setRequestedControlAction('start');
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
    if (!bridgeApi.startBuildSession) {
      notify.warning('Build start API is not available.');
      return false;
    }

    try {
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
        setRequestedControlAction,
        saveDraftBeforeBuild,
        updateSessionRecord,
        setIsStopRequested,
        setIsStopAccepted,
        options,
        startupSource,
        shouldResumeSession,
        onTrace: (trace) => {
          if (!isShapeBuildPanelDebugEnabled('startResume')) return;
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
          if (isShapeBuildPanelDebugEnabled('startResume')) {
            console.log('[ShapeBuildStartResumeTrace] handleStartOrResume', {
              nodeId: String(activeNodeId),
              elapsedMs: Math.max(0, Date.now() - requestStartedAt),
              event: `${stepName}:start`,
            });
          }
          try {
            const result = await runner();
            if (isShapeBuildPanelDebugEnabled('startResume')) {
              console.log('[ShapeBuildStartResumeTrace] handleStartOrResume', {
                nodeId: String(activeNodeId),
                elapsedMs: Math.max(0, Date.now() - requestStartedAt),
                event: `${stepName}:finish`,
                stepElapsedMs: Math.max(0, Date.now() - stepStartedAt),
              });
            }
            return result;
          } catch (error) {
            if (isShapeBuildPanelDebugEnabled('startResume')) {
              console.log('[ShapeBuildStartResumeTrace] handleStartOrResume', {
                nodeId: String(activeNodeId),
                elapsedMs: Math.max(0, Date.now() - requestStartedAt),
                event: `${stepName}:error`,
                stepElapsedMs: Math.max(0, Date.now() - stepStartedAt),
                errorMessage: error instanceof Error ? error.message : String(error),
              });
            }
            throw error;
          }
        },
        bridgeRef,
      });
    } finally {
      setRequestedControlAction('none');
    }
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
    setRequestedControlAction,
    saveDraftBeforeBuild,
    updateSessionRecord,
    setIsStopRequested,
    setIsStopAccepted,
  ]);

  return handleStartOrResume;
};
