import type { BuildSessionTransitionNotificationLevel } from '@hierarchidb/ui-build-progress/build-session';
import type { BuildStatusSource } from '~/ui/components/build-progress/resolveBuildStatusSource';

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

export type ReceivingTaskSnapshotDecision =
  | { kind: 'continue' }
  | {
      kind: 'success';
      reason:
        | 'task-execution-started'
        | 'task-queue-observed'
        | 'completed-without-generating-tasks';
      taskExecutionStarted: TaskExecutionStarted;
      notification: Notification;
      transitionFinish?: TransitionFinish;
    }
  | {
      kind: 'error';
      reason: 'failed-before-task-start';
      transitionFinish: TransitionFinish;
    }
  | {
      kind: 'cancelled';
      reason: 'stopped-before-task-start';
      transitionFinish: TransitionFinish;
    };

export type ReceivingTaskSnapshotSuccessDecision = Extract<
  ReceivingTaskSnapshotDecision,
  { kind: 'success' }
>;

export type ReceivingTaskSnapshotDecisionInput = {
  hasReceivingTaskSnapshotSignal: boolean;
  hasStartedTasks: boolean;
  hasProgressTaskSignal: boolean;
  buildStatus: BuildStatusSource;
  taskCount: number | undefined;
  isTaskSnapshotProgressConnected: boolean;
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

export const resolveReceivingTaskSnapshotDecision = (
  input: ReceivingTaskSnapshotDecisionInput
): ReceivingTaskSnapshotDecision => {
  if (input.hasReceivingTaskSnapshotSignal) {
    if (typeof input.taskCount === 'number' && input.taskCount === 0) {
      if (input.buildStatus !== 'completed') {
        return { kind: 'continue' };
      }
      return {
        kind: 'success',
        reason: 'completed-without-generating-tasks',
        taskExecutionStarted: {
          queuedOnly: false,
          hasProgressTaskSignal: input.hasProgressTaskSignal,
        },
        notification: {
          level: 'info',
          message: 'Build completed without generating tasks.',
        },
        transitionFinish: {
          level: 'info',
          message: 'Build completed without generating tasks.',
        },
      };
    }
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
    return { kind: 'continue' };
  }

  if (input.buildStatus === 'failed') {
    const hasSessionProgressEvidence =
      typeof input.sessionProgressTotal === 'number' && input.sessionProgressTotal > 0;
    // During resume/startup, build status can remain "failed" briefly while worker stage
    // has already moved into startup:*:start/finish. Avoid premature failure finalization.
    if (
      isTransientStartupStage(input.sessionStageId) ||
      input.hasProgressTaskSignal ||
      hasSessionProgressEvidence
    ) {
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
  if (input.buildStatus === 'paused') {
    return {
      kind: 'cancelled',
      reason: 'stopped-before-task-start',
      transitionFinish: {
        level: 'warning',
        message: 'Build stopped before task execution started.',
      },
    };
  }
  return { kind: 'continue' };
};
