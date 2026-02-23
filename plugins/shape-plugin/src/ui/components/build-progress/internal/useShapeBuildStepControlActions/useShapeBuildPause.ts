import { useCallback } from 'react';
import { notify } from '@hierarchidb/components/notify';
import type { PauseWithCancelHookActionsArgs, ShapeBuildPauseReason } from './types.js';
import { runWithTimeout } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/elapsed';
import { SHAPE_NODE_TYPE } from '~/ui/components/build-progress/shapeBuildTaskSyncDebug';
import { PAUSE_COMMAND_TIMEOUT_MS } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/constants';
import { isShapeBuildPanelDebugEnabled } from '~/ui/components/build-progress/useBuildProgressPanelState/useBuildProgressPanelState.utils.js';

export const useShapeBuildPause = ({
  activeNodeId,
  buildStatus,
  runtimeStatus,
  buildSessionTransitionActive,
  isStopRequestedInFlight,
  bridgeRef,
  clearStartPendingRef,
  setIsStopRequested,
  setIsStopAccepted,
  handleCancelQueued,
}: PauseWithCancelHookActionsArgs) => {
  const handlePause = useCallback(async (reason: ShapeBuildPauseReason = 'user-pause'): Promise<void> => {
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return;
    }
    const bridgeApi = bridgeRef.current;
    if (!bridgeApi) {
      notify.warning('Build worker is not ready.');
      return;
    }

    if (isStopRequestedInFlight) return;

    const shouldCancelQueued = buildSessionTransitionActive
      && buildStatus !== 'running'
      && runtimeStatus !== 'processing';

    if (shouldCancelQueued) {
      await handleCancelQueued(reason);
      return;
    }

    const pauseRequestedAt = Date.now();
    const shouldLogPauseTrace = isShapeBuildPanelDebugEnabled('startResume');
    const logPauseTrace = (event: string, payload?: Record<string, unknown>): void => {
      if (!shouldLogPauseTrace) return;
      console.log('[ShapeBuildPauseTrace] handlePause', {
        nodeId: String(activeNodeId),
        elapsedMs: Math.max(0, Date.now() - pauseRequestedAt),
        event,
        reason,
        buildStatus,
        runtimeStatus,
        ...(payload ?? {}),
      });
    };

    logPauseTrace('request-received');
    setIsStopRequested(true);
    clearStartPendingRef.current?.();

    try {
      await bridgeApi.initialize();
      await runWithTimeout(
        bridgeApi.pauseBuildSession(SHAPE_NODE_TYPE, activeNodeId, reason),
        PAUSE_COMMAND_TIMEOUT_MS,
        `Pause command timed out after ${PAUSE_COMMAND_TIMEOUT_MS}ms while worker is busy.`,
      );
      setIsStopAccepted(true);
      logPauseTrace('request-finished');
    } catch (error) {
      setIsStopRequested(false);
      setIsStopAccepted(false);
      notify.error('Failed to pause build.');
      console.error('[ShapeBuildProgressStep] pause failed', error);
      logPauseTrace('request-failed', {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }, [
    activeNodeId,
    buildStatus,
    runtimeStatus,
    buildSessionTransitionActive,
    isStopRequestedInFlight,
    bridgeRef,
    clearStartPendingRef,
    handleCancelQueued,
    setIsStopRequested,
    setIsStopAccepted,
  ]);

  return handlePause;
};
