import { useShapeBuildCancelQueued } from './useShapeBuildStepControlActions/useShapeBuildCancelQueued.ts';
import { useShapeBuildPause } from './useShapeBuildStepControlActions/useShapeBuildPause.ts';
import { useShapeBuildStartOrResume } from './useShapeBuildStepControlActions/useShapeBuildStartOrResume.ts';
import type {
  StartOrResumeControlActionsArgs,
  PauseControlActionsArgs,
  CancelQueuedControlActionsArgs,
} from './useShapeBuildStepControlActions/types.ts';

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
  saveDraftBeforeBuild,
  refreshTasks,
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
    saveDraftBeforeBuild,
    refreshTasks,
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
