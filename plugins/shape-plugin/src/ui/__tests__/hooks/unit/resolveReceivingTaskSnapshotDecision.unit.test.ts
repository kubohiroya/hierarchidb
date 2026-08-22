import { describe, expect, it } from 'vitest';
import { resolveReceivingTaskSnapshotDecision } from '../../../components/build-progress/resolveReceivingTaskSnapshotDecision';

describe('resolveReceivingTaskSnapshotDecision', () => {
  it('returns success with task execution start when started tasks exist', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: true,
      hasStartedTasks: true,
      hasProgressTaskSignal: true,
      buildStatus: 'running',
      taskCount: 3,
      isTaskSnapshotProgressConnected: true,
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

  it('continues waiting when snapshot is received and empty but build is still running', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: true,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'running',
      taskCount: 0,
      isTaskSnapshotProgressConnected: true,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({
      kind: 'continue',
    });
  });

  it('returns success with no-task-completion when snapshot is received and build is completed', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: true,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: 0,
      isTaskSnapshotProgressConnected: true,
      expectTaskGeneration: true,
    });
    expect(decision).toMatchObject({
      kind: 'success',
      reason: 'completed-without-generating-tasks',
      taskExecutionStarted: {
        queuedOnly: false,
        hasProgressTaskSignal: false,
      },
      notification: {
        level: 'info',
        message: 'Build completed without generating tasks.',
      },
      transitionFinish: {
        level: 'info',
        message: 'Build completed without generating tasks.',
      },
    });
  });

  it('returns success with queue observed when only queued tasks exist', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: true,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'running',
      taskCount: 1,
      isTaskSnapshotProgressConnected: true,
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

  it('continues waiting when completed without tasks but snapshot has not been received', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: 0,
      isTaskSnapshotProgressConnected: true,
      expectTaskGeneration: false,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues waiting when completed without tasks but task generation is expected', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: 0,
      isTaskSnapshotProgressConnected: true,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('returns error when build fails before receiving-task-snapshot start', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'failed',
      taskCount: 0,
      isTaskSnapshotProgressConnected: false,
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
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'failed',
      taskCount: 0,
      isTaskSnapshotProgressConnected: false,
      expectTaskGeneration: true,
      sessionStageId: 'pipeline:source-stage:error',
    });
    expect(decision).toEqual({
      kind: 'error',
      reason: 'failed-before-task-start',
      transitionFinish: {
        level: 'error',
        message:
          'Build failed before task execution started (worker stage: pipeline:source-stage:error).',
      },
    });
  });

  it('continues when build failed but session progress evidence exists', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'failed',
      taskCount: undefined,
      isTaskSnapshotProgressConnected: false,
      expectTaskGeneration: true,
      sessionProgressTotal: 2,
      sessionStageId: 'pipeline:source-stage:error',
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues when build failed but progress-task signal exists', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: true,
      buildStatus: 'failed',
      taskCount: undefined,
      isTaskSnapshotProgressConnected: false,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues waiting when status is failed but startup stage is still progressing', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'failed',
      taskCount: 0,
      isTaskSnapshotProgressConnected: false,
      expectTaskGeneration: true,
      sessionStageId: 'startup:plan-source-total:start',
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues waiting when status is failed and task progress total is already known', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'failed',
      taskCount: 0,
      isTaskSnapshotProgressConnected: false,
      expectTaskGeneration: true,
      sessionProgressTotal: 2,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues waiting when status is failed and progress task signal is present', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: true,
      buildStatus: 'failed',
      taskCount: 0,
      isTaskSnapshotProgressConnected: false,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('returns cancelled when paused before receiving-task-snapshot start and pause is not pending', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'paused',
      taskCount: 0,
      isTaskSnapshotProgressConnected: false,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({
      kind: 'cancelled',
      reason: 'stopped-before-task-start',
      transitionFinish: {
        level: 'warning',
        message: 'Build stopped before task execution started.',
      },
    });
  });

  it('continues waiting while task snapshot progress is not connected even if status is completed', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: 0,
      isTaskSnapshotProgressConnected: false,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues when task snapshot progress is not connected and only session progress is known', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: undefined,
      isTaskSnapshotProgressConnected: false,
      expectTaskGeneration: true,
      sessionProgressTotal: 5,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues waiting while task snapshot progress is still unknown after snapshot progress is connected', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: undefined,
      isTaskSnapshotProgressConnected: true,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues when session progress exists but progress-task signal is still unknown', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: undefined,
      isTaskSnapshotProgressConnected: true,
      expectTaskGeneration: true,
      sessionProgressTotal: 5,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues when completed and receiving task snapshot signal has not been received yet', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: 2,
      isTaskSnapshotProgressConnected: true,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues when completed with zero UI tasks but receiving task snapshot signal has not been received', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: true,
      buildStatus: 'completed',
      taskCount: 0,
      isTaskSnapshotProgressConnected: true,
      expectTaskGeneration: true,
      sessionProgressTotal: 5,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues when completed and task record exists but snapshot is still not received', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: true,
      hasProgressTaskSignal: false,
      buildStatus: 'completed',
      taskCount: 0,
      isTaskSnapshotProgressConnected: false,
      expectTaskGeneration: true,
      sessionProgressTotal: 5,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });

  it('continues waiting while build is still running and no receiving task snapshot signal exists', () => {
    const decision = resolveReceivingTaskSnapshotDecision({
      hasReceivingTaskSnapshotSignal: false,
      hasStartedTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'running',
      taskCount: undefined,
      isTaskSnapshotProgressConnected: false,
      expectTaskGeneration: true,
    });
    expect(decision).toEqual({ kind: 'continue' });
  });
});
