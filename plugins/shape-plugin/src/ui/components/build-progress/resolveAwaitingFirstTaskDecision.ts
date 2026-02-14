import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { BuildSessionTransitionNotificationLevel } from '@hierarchidb/components/build-session';

type Notification = {
  level: BuildSessionTransitionNotificationLevel;
  message: string;
};

type TransitionFinish = {
  level: BuildSessionTransitionNotificationLevel;
  message: string;
};

type TaskExecutionStarted = {
  queuedOnly: boolean;
  hasProgressTaskSignal: boolean;
};

export type AwaitingFirstTaskDecision =
  | { kind: 'continue' }
  | {
    kind: 'success';
    reason:
      | 'task-execution-started'
      | 'task-queue-observed'
      | 'completed-without-generating-tasks'
      | 'completed-before-first-task-update'
      | 'completed-with-session-progress-evidence';
    taskExecutionStarted?: TaskExecutionStarted;
    notification?: Notification;
    transitionFinish?: TransitionFinish;
  }
  | {
    kind: 'error';
    reason: 'failed-before-task-start';
    transitionFinish: TransitionFinish;
  }
  | {
    kind: 'cancelled';
    reason: 'paused-before-task-start';
    transitionFinish: TransitionFinish;
  };

export type AwaitingFirstTaskDecisionInput = {
  hasFirstTaskSignal: boolean;
  hasStartedTasks: boolean;
  hasProgressTaskSignal: boolean;
  buildStatus: BuildStatus;
  taskCount: number | undefined;
  isTaskStreamReady: boolean;
  isPausePending: boolean;
  expectTaskGeneration: boolean;
  sessionProgressTotal?: number;
  sessionStageId?: string | null;
};

const buildFailedBeforeTaskStartMessage = (sessionStageId?: string | null): string => {
  if (typeof sessionStageId === 'string' && sessionStageId.length > 0) {
    return `Build failed before task execution started (worker stage: ${sessionStageId}).`;
  }
  return 'Build failed before task execution started.';
};

const isTransientStartupStage = (sessionStageId?: string | null): boolean => {
  if (typeof sessionStageId !== 'string' || sessionStageId.length === 0) {
    return false;
  }
  if (!sessionStageId.startsWith('startup:')) {
    return false;
  }
  return !sessionStageId.endsWith(':error');
};

export const resolveAwaitingFirstTaskDecision = (
  input: AwaitingFirstTaskDecisionInput,
): AwaitingFirstTaskDecision => {
  const hasSessionProgressEvidence = (
    typeof input.sessionProgressTotal === 'number'
    && input.sessionProgressTotal > 0
  );
  const hasTaskProgressSignal = input.hasStartedTasks || input.hasProgressTaskSignal;
  if (input.hasFirstTaskSignal) {
    return {
      kind: 'success',
      reason: input.hasStartedTasks ? 'task-execution-started' : 'task-queue-observed',
      taskExecutionStarted: {
        queuedOnly: !input.hasStartedTasks,
        hasProgressTaskSignal: input.hasProgressTaskSignal,
      },
      notification: input.hasStartedTasks
        ? {
          level: 'success',
          message: 'Build task execution started.',
        }
        : {
          level: 'info',
          message: 'Build task queue is ready.',
        },
    };
  }
  if (input.buildStatus === 'completed') {
    if (!input.isTaskStreamReady) {
      if (hasSessionProgressEvidence && hasTaskProgressSignal) {
        return {
          kind: 'success',
          reason: 'completed-with-session-progress-evidence',
          transitionFinish: {
            level: 'info',
            message: 'Build completed before task stream synchronization.',
          },
        };
      }
      return { kind: 'continue' };
    }
    if (typeof input.taskCount !== 'number') {
      if (hasSessionProgressEvidence && hasTaskProgressSignal) {
        return {
          kind: 'success',
          reason: 'completed-with-session-progress-evidence',
          transitionFinish: {
            level: 'info',
            message: 'Build completed before task stream synchronization.',
          },
        };
      }
      return { kind: 'continue' };
    }
    const completedWithoutTasks = input.taskCount === 0;
    if (completedWithoutTasks && input.expectTaskGeneration) {
      if (hasSessionProgressEvidence && hasTaskProgressSignal) {
        return {
          kind: 'success',
          reason: 'completed-with-session-progress-evidence',
          transitionFinish: {
            level: 'info',
            message: 'Build completed before task stream synchronization.',
          },
        };
      }
      return { kind: 'continue' };
    }
    return {
      kind: 'success',
      reason: completedWithoutTasks
        ? 'completed-without-generating-tasks'
        : 'completed-before-first-task-update',
      transitionFinish: completedWithoutTasks
        ? {
          level: 'info',
          message: 'Build completed without generating tasks.',
        }
        : undefined,
    };
  }
  if (input.buildStatus === 'failed') {
    // During resume/startup, build status can remain "failed" briefly while worker stage
    // has already moved into startup:*:start/finish. Avoid premature failure finalization.
    if (isTransientStartupStage(input.sessionStageId) || hasSessionProgressEvidence || input.hasProgressTaskSignal) {
      return { kind: 'continue' };
    }
    return {
      kind: 'error',
      reason: 'failed-before-task-start',
      transitionFinish: {
        level: 'error',
        message: buildFailedBeforeTaskStartMessage(input.sessionStageId),
      },
    };
  }
  if (input.buildStatus === 'paused' && !input.isPausePending) {
    return {
      kind: 'cancelled',
      reason: 'paused-before-task-start',
      transitionFinish: {
        level: 'warning',
        message: 'Build paused before task execution started.',
      },
    };
  }
  return { kind: 'continue' };
};
