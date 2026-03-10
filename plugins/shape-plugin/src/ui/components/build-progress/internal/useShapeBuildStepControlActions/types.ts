import type { NodeId } from '@hierarchidb/core-types';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import type { BuildSessionTransitionNotificationLevel } from '@hierarchidb/ui-build-progress/build-session';
import type { BuildSessionTransitionLogLevel } from '@hierarchidb/ui-build-progress/build-session';
import type { BuildSessionStatus } from '@hierarchidb/build-api';
import type { ShapeBuildSessionRecord, ShapeBuildStopReason } from '@hierarchidb/shape-api';
import type { ShapeEntity } from '~/common/types/index';
import type { BuildWorkerBridge } from '@hierarchidb/ui-worker-client';

export type ShapeBuildPauseReason = ShapeBuildStopReason;

export type BuildSessionTransitionPhase =
  | 'acquiring-lock'
  | 'waiting-lock'
  | 'saving-draft'
  | 'initializing-worker'
  | 'building-payloads'
  | 'starting-session';

export type BuildStartupStep =
  | 'lock-acquire'
  | 'lock-wait'
  | 'draft-save'
  | 'worker-initialize'
  | 'payload-build'
  | 'session-start-request'
  | 'session-status-persist';

export type BuildStartupStepOutcome = 'success' | 'error' | 'cancelled' | 'aborted';

export type StartOrResumeOptions = {
  forceRestart?: boolean;
  autoResume?: boolean;
};

export type StartOrResumeTrace = {
  event: string;
  payload?: Record<string, unknown>;
};

export type ShapeBuildWorkerBuildSessionData = {
  selectedArrayByCountries?: ShapeEntity['selectedArrayByCountries'];
  buildConfig?: {
    dataSourceName?: string | null;
  };
};

export type ShapeBuildSessionPatch = Partial<ShapeBuildSessionRecord> & {
  stopReason?: ShapeBuildStopReason;
};

export type BridgeApi = Pick<
  BuildWorkerBridge,
  'initialize' | 'startBuildSession' | 'pauseBuildSession' | 'cancelQueuedBuildSession'
>;

export type ControlActionsArgs = {
  activeNodeId: NodeId | null;
  data?: ShapeBuildWorkerBuildSessionData;
  buildStatus: BuildStatus;
  runtimeStatus: string | null;
  buildSessionTransitionActive: boolean;
  isStopRequestedInFlight: boolean;
  bridgeRef: React.RefObject<BridgeApi>;
  beginBuildSessionTransition: (phase: BuildSessionTransitionPhase, message?: string) => void;
  advanceBuildSessionTransitionPhase: (
    phase: BuildSessionTransitionPhase,
    options?: {
      message?: string;
      level?: BuildSessionTransitionNotificationLevel;
    },
  ) => void;
  finishBuildSessionTransition: (options?: {
    message?: string;
    level?: BuildSessionTransitionNotificationLevel;
  }) => void;
  beginBuildStartupStep: (step: BuildStartupStep, extra?: Record<string, unknown>) => void;
  finishBuildStartupStep: (step: BuildStartupStep, outcome: BuildStartupStepOutcome, extra?: Record<string, unknown>) => void;
  emitBuildSessionTransitionLog: (level: BuildSessionTransitionLogLevel, message: string, extra?: Record<string, unknown>) => void;
  clearStartPendingRef: React.MutableRefObject<(() => void) | null>;
  releaseBuildLock: () => void;
  tryAcquireBuildLock: (options?: { notifyOnFailure?: boolean }) => Promise<boolean>;
  waitForBuildLock: (requestedAt: number) => Promise<boolean>;
  cancelStartRequestRef: React.MutableRefObject<boolean>;
  setRequestedControlAction: (next: 'none' | 'start' | 'pause' | 'cancel') => void;
  saveDraftBeforeBuild: () => Promise<boolean>;
  updateSessionRecord: (patch: ShapeBuildSessionPatch) => Promise<boolean>;
  setIsStopRequested: (next: boolean) => void;
  setIsStopAccepted: (next: boolean) => void;
};

export type StartOrResumeControlActionsArgs = Pick<
  ControlActionsArgs,
  | 'activeNodeId'
  | 'data'
  | 'buildStatus'
  | 'runtimeStatus'
  | 'bridgeRef'
  | 'beginBuildSessionTransition'
  | 'advanceBuildSessionTransitionPhase'
  | 'finishBuildSessionTransition'
  | 'beginBuildStartupStep'
  | 'finishBuildStartupStep'
  | 'emitBuildSessionTransitionLog'
  | 'releaseBuildLock'
  | 'tryAcquireBuildLock'
  | 'waitForBuildLock'
  | 'cancelStartRequestRef'
  | 'setRequestedControlAction'
  | 'saveDraftBeforeBuild'
  | 'updateSessionRecord'
  | 'setIsStopRequested'
  | 'setIsStopAccepted'
>;

export type StartOrResumeExecutionArgs = StartOrResumeControlActionsArgs & {
  options?: StartOrResumeOptions;
  startupSource: 'manual' | 'auto';
  shouldResumeSession: boolean;
  onTrace: (trace: StartOrResumeTrace) => void;
  requestStartedAt: number;
  runTimedStep: <T>(stepName: string, runner: () => Promise<T>) => Promise<T>;
};

export type { BuildSessionStatus };

export type PauseControlActionsArgs = Pick<
  ControlActionsArgs,
  | 'activeNodeId'
  | 'buildStatus'
  | 'runtimeStatus'
  | 'buildSessionTransitionActive'
  | 'isStopRequestedInFlight'
  | 'bridgeRef'
  | 'clearStartPendingRef'
  | 'setRequestedControlAction'
  | 'setIsStopRequested'
  | 'setIsStopAccepted'
>;

export type PauseWithCancelHookActionsArgs = PauseControlActionsArgs & {
  handleCancelQueued: (reason: ShapeBuildPauseReason) => Promise<void>;
};

export type CancelQueuedControlActionsArgs = Pick<
  ControlActionsArgs,
  | 'activeNodeId'
  | 'bridgeRef'
  | 'clearStartPendingRef'
  | 'buildSessionTransitionActive'
  | 'cancelStartRequestRef'
  | 'setRequestedControlAction'
  | 'releaseBuildLock'
  | 'finishBuildSessionTransition'
  | 'isStopRequestedInFlight'
  | 'setIsStopRequested'
  | 'setIsStopAccepted'
>;
