import { useCallback } from 'react';
import { useSetAtom } from 'jotai';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { notify } from '@hierarchidb/components/notify';
import type { StartControlActionsArgs, StartOptions } from './types.js';
import { shouldResumeBuildSession } from '~/ui/components/build-progress/shouldResumeBuildSession';
import { executeStartFlow } from './executeStartFlow.js';
import { isShapeBuildPanelDebugEnabled } from '~/ui/components/build-progress/useBuildProgressPanelState/useBuildProgressPanelState.utils.js';
import { dispatchBuildSessionEventAtom } from '~/ui/atoms/buildSessionStateAtoms';
import { createBuildSessionWorkerEventAdapter } from '~/ui/atoms/buildSessionWorkerEventAdapter';

const SHAPE_NODE_TYPE = 'shape' as NodeType;

export const useShapeBuildStart = ({
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
}: StartControlActionsArgs) => {
  const dispatch = useSetAtom(dispatchBuildSessionEventAtom);

  // Fetches the latest runtime record from the worker and pushes it into the atom.
  // Used after startBuildSession succeeds so the UI reflects the running phase immediately
  // without waiting for the next subscription event.
  const onRuntimeRecord = useCallback(async (nodeId: NodeId): Promise<void> => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    const nodeIdText = String(nodeId);
    const adapter = createBuildSessionWorkerEventAdapter(nodeIdText, (event) => {
      dispatch(event);
    });
    const runtime = await bridge.getBuildSessionRuntime(SHAPE_NODE_TYPE, nodeId);
    if (runtime) {
      adapter.onRuntimeRecord(runtime);
    }
  }, [bridgeRef, dispatch]);

  const handleStart = useCallback(async (options?: StartOptions): Promise<boolean> => {
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
      return executeStartFlow({
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
        onRuntimeRecord,
        onTrace: (trace) => {
          if (!isShapeBuildPanelDebugEnabled('startResume')) return;
          console.log('[ShapeBuildStartTrace] handleStart', {
            nodeId: String(activeNodeId),
            durationMs: Math.max(0, Date.now() - requestStartedAt),
            event: trace.event,
            ...(trace.payload ?? {}),
          });
        },
        requestStartedAt,
        runTimedStep: async <T,>(stepName: string, runner: () => Promise<T>): Promise<T> => {
          const stepStartedAt = Date.now();
          if (isShapeBuildPanelDebugEnabled('startResume')) {
            console.log('[ShapeBuildStartTrace] handleStart', {
              nodeId: String(activeNodeId),
              durationMs: Math.max(0, Date.now() - requestStartedAt),
              event: `${stepName}:start`,
            });
          }
          try {
            const result = await runner();
            if (isShapeBuildPanelDebugEnabled('startResume')) {
              console.log('[ShapeBuildStartTrace] handleStart', {
                nodeId: String(activeNodeId),
                durationMs: Math.max(0, Date.now() - requestStartedAt),
                event: `${stepName}:finish`,
                stepDurationMs: Math.max(0, Date.now() - stepStartedAt),
              });
            }
            return result;
          } catch (error) {
            if (isShapeBuildPanelDebugEnabled('startResume')) {
              console.log('[ShapeBuildStartTrace] handleStart', {
                nodeId: String(activeNodeId),
                durationMs: Math.max(0, Date.now() - requestStartedAt),
                event: `${stepName}:error`,
                stepDurationMs: Math.max(0, Date.now() - stepStartedAt),
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
    onRuntimeRecord,
  ]);

  return handleStart;
};
