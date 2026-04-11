import { useCallback } from 'react';

import type { CancelQueuedControlActionsArgs, ShapeBuildPauseReason } from './types.js';
import { runWithTimeout } from '~/ui/components/build-progress/internal/useShapeBuildSessionHelpers/elapsedConstants';
import { PAUSE_COMMAND_TIMEOUT_MS, SHAPE_NODE_TYPE } from '~/ui/components/build-progress/internal/useShapeBuildSessionHelpers/constants';

export const useShapeBuildCancelQueued = ({
  activeNodeId,
  bridgeRef,
  clearStartPendingRef,
  buildSessionTransitionActive,
  cancelStartRequestRef,
  setRequestedControlAction,
  releaseBuildLock,
  finishBuildSessionTransition,
  isStopRequestedInFlight,
  setIsStopRequested,
  setIsStopAccepted,
}: CancelQueuedControlActionsArgs) => {
  const handleCancelQueued = useCallback(async (reason: ShapeBuildPauseReason = 'user-pause'): Promise<void> => {
    const bridgeApi = bridgeRef.current;
    if (!activeNodeId || isStopRequestedInFlight || !bridgeApi) return;
    setRequestedControlAction('cancel');
    cancelStartRequestRef.current = true;
    clearStartPendingRef.current?.();
    setIsStopRequested(true);
    try {
      await bridgeApi.initialize();
      await runWithTimeout(
        bridgeApi.cancelQueuedBuildSession(SHAPE_NODE_TYPE, activeNodeId, reason),
        PAUSE_COMMAND_TIMEOUT_MS,
        `Cancel queued build timed out after ${PAUSE_COMMAND_TIMEOUT_MS}ms.`,
      );
      setIsStopAccepted(true);
      setIsStopRequested(false);
      setRequestedControlAction('none');
      releaseBuildLock();
      if (buildSessionTransitionActive) {
        finishBuildSessionTransition({
          level: 'warning',
          message: 'Build start was cancelled.',
        });
      }
    } catch (error) {
      console.error('[ShapeBuildProgressStep] cancel queued failed', error);
      setIsStopRequested(false);
      setIsStopAccepted(false);
      setRequestedControlAction('none');
    }
  }, [
    activeNodeId,
    bridgeRef,
    buildSessionTransitionActive,
    clearStartPendingRef,
    finishBuildSessionTransition,
    isStopRequestedInFlight,
    releaseBuildLock,
    setRequestedControlAction,
    setIsStopAccepted,
    setIsStopRequested,
    cancelStartRequestRef,
  ]);

  return handleCancelQueued;
};
