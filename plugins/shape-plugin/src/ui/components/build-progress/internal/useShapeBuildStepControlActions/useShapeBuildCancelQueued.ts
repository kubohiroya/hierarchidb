import { useCallback } from 'react';
import {
  PAUSE_COMMAND_TIMEOUT_MS,
  SHAPE_NODE_TYPE,
  runWithTimeout,
} from '../useShapeBuildStepHelpers.ts';
import { type CancelQueuedControlActionsArgs, type ShapeBuildPauseReason } from './types.ts';

export const useShapeBuildCancelQueued = ({
  activeNodeId,
  bridgeRef,
  clearStartPendingRef,
  buildSessionTransitionActive,
  cancelStartRequestRef,
  releaseBuildLock,
  finishBuildSessionTransition,
  isStopRequestedInFlight,
  setIsStopRequested,
  setIsStopAccepted,
}: CancelQueuedControlActionsArgs) => {
  const handleCancelQueued = useCallback(async (reason: ShapeBuildPauseReason = 'user-pause'): Promise<void> => {
    const bridgeApi = bridgeRef.current;
    if (!activeNodeId || isStopRequestedInFlight || !bridgeApi) return;
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
    }
  }, [
    activeNodeId,
    bridgeRef,
    buildSessionTransitionActive,
    clearStartPendingRef,
    finishBuildSessionTransition,
    isStopRequestedInFlight,
    releaseBuildLock,
    setIsStopAccepted,
    setIsStopRequested,
    cancelStartRequestRef,
  ]);

  return handleCancelQueued;
};
