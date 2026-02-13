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
      | 'completed-before-first-task-update';
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
  taskCount: number;
  isPausePending: boolean;
};

export const resolveAwaitingFirstTaskDecision = (
  input: AwaitingFirstTaskDecisionInput,
): AwaitingFirstTaskDecision => {
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
    const completedWithoutTasks = input.taskCount === 0;
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
    return {
      kind: 'error',
      reason: 'failed-before-task-start',
      transitionFinish: {
        level: 'error',
        message: 'Build failed before task execution started.',
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
