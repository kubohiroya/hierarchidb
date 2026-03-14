import { useShapeBuildCancelQueued } from './useShapeBuildSessionControlActions/useShapeBuildCancelQueued.js';
import { useShapeBuildPause } from './useShapeBuildSessionControlActions/useShapeBuildPause.js';
import { useShapeBuildStart } from './useShapeBuildSessionControlActions/useShapeBuildStart.js';
import type {
  StartControlActionsArgs,
  PauseControlActionsArgs,
  CancelQueuedControlActionsArgs,
} from './useShapeBuildSessionControlActions/types.js';

export const useShapeBuildSessionControlActions = ({
  activeNodeId,
  data,
  buildStatus,
  runtimeStatus,
  buildSessionTransitionActive,
  isStopRequestedInFlight,
  bridgeRef,
  beginBuildSessionTransition,
  advanceBuildSessionTransitionPhase,
  finishBuildSessionTransition,
  beginBuildStartupStep,
  finishBuildStartupStep,
  emitBuildSessionTransitionLog,
  clearStartPendingRef,
  releaseBuildLock,
  tryAcquireBuildLock,
  waitForBuildLock,
  cancelStartRequestRef,
  setRequestedControlAction,
  saveDraftBeforeBuild,
  updateSessionRecord,
  setIsStopRequested,
  setIsStopAccepted,
}: StartControlActionsArgs & PauseControlActionsArgs & CancelQueuedControlActionsArgs) => {
  const handleStart = useShapeBuildStart({
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
  });

  const handleCancelQueued = useShapeBuildCancelQueued({
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
  });

  const handlePause = useShapeBuildPause({
    activeNodeId,
    buildStatus,
    runtimeStatus,
    buildSessionTransitionActive,
    isStopRequestedInFlight,
    bridgeRef,
    clearStartPendingRef,
    setRequestedControlAction,
    setIsStopRequested,
    setIsStopAccepted,
    handleCancelQueued,
  });

  return {
    handleStart,
    handleCancelQueued,
    handlePause,
  };
};
