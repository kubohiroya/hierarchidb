import { useShapeBuildCancelQueued } from './useShapeBuildStepControlActions/useShapeBuildCancelQueued.js';
import { useShapeBuildPause } from './useShapeBuildStepControlActions/useShapeBuildPause.js';
import { useShapeBuildStartOrResume } from './useShapeBuildStepControlActions/useShapeBuildStartOrResume.js';
import type {
  StartOrResumeControlActionsArgs,
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
}: StartOrResumeControlActionsArgs & PauseControlActionsArgs & CancelQueuedControlActionsArgs) => {
  const handleStartOrResume = useShapeBuildStartOrResume({
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
    handleStartOrResume,
    handleCancelQueued,
    handlePause,
  };
};
