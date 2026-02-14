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
      isTaskStreamReady: true,
      isPausePending: false,
      expectTaskGeneration: true,
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
      isTaskStreamReady: true,
      isPausePending: false,
      expectTaskGeneration: true,
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
      isTaskStreamReady: true,
      isPausePending: false,
      expectTaskGeneration: false,
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

  it('continues waiting when completed without tasks but task generation is expected', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: 0,
      isTaskStreamReady: true,
      isPausePending: false,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('returns error when build fails before first task start', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'failed',
      taskCount: 0,
      isTaskStreamReady: false,
      isPausePending: false,
      expectTaskGeneration: true,
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

  it('includes worker stageId in failure message when available', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'failed',
      taskCount: 0,
      isTaskStreamReady: false,
      isPausePending: false,
      expectTaskGeneration: true,
      sessionStageId: 'pipeline:fetch-stage:error',
    });
    expect(decision).toEqual({
      kind: 'error',
      reason: 'failed-before-task-start',
      transitionFinish: {
        level: 'error',
        message: 'Build failed before task execution started (worker stage: pipeline:fetch-stage:error).',
      },
    });
  });

  it('continues waiting when status is failed but startup stage is still progressing', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'failed',
      taskCount: 0,
      isTaskStreamReady: false,
      isPausePending: false,
      expectTaskGeneration: true,
      sessionStageId: 'startup:plan-fetch-total:start',
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues waiting when status is failed and task progress total is already known', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'failed',
      taskCount: 0,
      isTaskStreamReady: false,
      isPausePending: false,
      expectTaskGeneration: true,
      sessionProgressTotal: 2,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues waiting when status is failed and progress task signal is present', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: true,
      buildStatus: 'failed',
      taskCount: 0,
      isTaskStreamReady: false,
      isPausePending: false,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('returns cancelled when paused before first task start and pause is not pending', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'paused',
      taskCount: 0,
      isTaskStreamReady: false,
      isPausePending: false,
      expectTaskGeneration: true,
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
      isTaskStreamReady: false,
      isPausePending: true,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues waiting while task stream is not ready even if status is completed', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: 0,
      isTaskStreamReady: false,
      isPausePending: false,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('returns success when stream is not ready but worker session progress proves completion', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: undefined,
      isTaskStreamReady: false,
      isPausePending: false,
      expectTaskGeneration: true,
      sessionProgressTotal: 5,
    });
    expect(decision).toEqual({
      kind: 'success',
      reason: 'completed-with-session-progress-evidence',
      transitionFinish: {
        level: 'info',
        message: 'Build completed before task stream synchronization.',
      },
    });
  });

  it('continues waiting while task count is still unknown after stream becomes ready', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: undefined,
      isTaskStreamReady: true,
      isPausePending: false,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('returns success when task count is unknown but worker session progress proves completion', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: undefined,
      isTaskStreamReady: true,
      isPausePending: false,
      expectTaskGeneration: true,
      sessionProgressTotal: 5,
    });
    expect(decision).toEqual({
      kind: 'success',
      reason: 'completed-with-session-progress-evidence',
      transitionFinish: {
        level: 'info',
        message: 'Build completed before task stream synchronization.',
      },
    });
  });

  it('returns success when completed after at least one task record is observed', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: 2,
      isTaskStreamReady: true,
      isPausePending: false,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({
      kind: 'success',
      reason: 'completed-before-first-task-update',
      transitionFinish: undefined,
    });
  });

  it('returns success when completed with zero UI tasks but worker session progress proves task execution', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: 0,
      isTaskStreamReady: true,
      isPausePending: false,
      expectTaskGeneration: true,
      sessionProgressTotal: 5,
    });
    expect(decision).toEqual({
      kind: 'success',
      reason: 'completed-with-session-progress-evidence',
      transitionFinish: {
        level: 'info',
        message: 'Build completed before task stream synchronization.',
      },
    });
  });

  it('continues waiting while build is still running and no first-task signal exists', () => {
    const decision = resolveAwaitingFirstTaskDecision({
      hasFirstTaskSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'running',
      taskCount: undefined,
      isTaskStreamReady: false,
      isPausePending: false,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });
});
