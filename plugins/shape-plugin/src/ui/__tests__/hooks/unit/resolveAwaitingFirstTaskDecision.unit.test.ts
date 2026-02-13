import { describe, expect, it } from 'vitest';
import { resolveAwaitingFirstTaskDecision } from '../../../components/build-progress/resolveAwaitingFirstTaskDecision.ts';

describe('resolveAwaitingFirstTaskDecision', () => {
  it('returns success with task execution start when started tasks exist', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: true,
      hasStartedTasks: true,
      hasProgressTaskSignal: true,
      buildStatus: 'running',
      taskCount: 3,
      isPausePending: false,
    });
    expect(decision).toMatchObject({
      kind: 'success',
      reason: 'task-execution-started',
      taskExecutionStarted: {
        queuedOnly: false,
        hasProgressTaskSignal: true,
      },
      notification: {
        level: 'success',
      },
    });
  });

  it('returns success with queue observed when only queued tasks exist', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: true,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'running',
      taskCount: 1,
      isPausePending: false,
    });
    expect(decision).toMatchObject({
      kind: 'success',
      reason: 'task-queue-observed',
      taskExecutionStarted: {
        queuedOnly: true,
        hasProgressTaskSignal: false,
      },
      notification: {
        level: 'info',
      },
    });
  });

  it('returns success with info transition when completed without tasks', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: 0,
      isPausePending: false,
    });
    expect(decision).toEqual({
      kind: 'success',
      reason: 'completed-without-generating-tasks',
      transitionFinish: {
        level: 'info',
        message: 'Build completed without generating tasks.',
      },
    });
  });

  it('returns success without extra transition when completed with tasks', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: 2,
      isPausePending: false,
    });
    expect(decision).toEqual({
      kind: 'success',
      reason: 'completed-before-first-task-update',
      transitionFinish: undefined,
    });
  });

  it('returns error when build fails before first task start', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'failed',
      taskCount: 0,
      isPausePending: false,
    });
    expect(decision).toEqual({
      kind: 'error',
      reason: 'failed-before-task-start',
      transitionFinish: {
        level: 'error',
        message: 'Build failed before task execution started.',
      },
    });
  });

  it('returns cancelled when paused before first task start and pause is not pending', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'paused',
      taskCount: 0,
      isPausePending: false,
    });
    expect(decision).toEqual({
      kind: 'cancelled',
      reason: 'paused-before-task-start',
      transitionFinish: {
        level: 'warning',
        message: 'Build paused before task execution started.',
      },
    });
  });

  it('continues waiting when paused but pause command is pending', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'paused',
      taskCount: 0,
      isPausePending: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });
});
