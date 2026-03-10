import { useShapeBuildCancelQueued } from './useShapeBuildStepControlActions/useShapeBuildCancelQueued.js';
import { useShapeBuildPause } from './useShapeBuildStepControlActions/useShapeBuildPause.js';
import { useShapeBuildStart } from './useShapeBuildStepControlActions/useShapeBuildStart.js';
import type {
  StartControlActionsArgs,
  PauseControlActionsArgs,
  CancelQueuedControlActionsArgs,
} from './useShapeBuildStepControlActions/types.js';

export const useShapeBuildStepControlActions = ({
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
