import { describe, expect, it } from 'vitest';
import type { ShapeBuildTaskSummary } from 'packages/build-api';
import {
  reconcileSnapshotWithCurrentTasks,
  shouldPreferNextTask,
  resolveTaskStage,
} from '../../../components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.comparison.utils';
import { normalizeStageKey } from '../../../components/build-progress/internal/useShapeBuildStepHelpers/stage.js';
import type { RawTaskSummary } from '../../../components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.types';

const makeTask = (overrides: Partial<ShapeBuildTaskSummary>): ShapeBuildTaskSummary => ({
  taskId: 'task-unknown',
  stage: 'fetch',
  status: 'queued',
  progress: 0,
  message: 'queued',
  index: 0,
  ...overrides,
});

describe('reconcileSnapshotWithCurrentTasks', () => {
  it('replaces current tasks with snapshot even when empty', () => {
    const currentTasks = new Map<string, ShapeBuildTaskSummary>([
      ['node:fetch:1', makeTask({ taskId: 'node:fetch:1', status: 'completed', progress: 100, index: 1 })],
      ['node:fetch:2', makeTask({ taskId: 'node:fetch:2', status: 'failed', progress: 100, index: 2 })],
    ]);

    const next = reconcileSnapshotWithCurrentTasks([], currentTasks);

    expect(next).toHaveLength(0);
  });

  it('replaces stale snapshot with incoming snapshot order and data', () => {
    const currentTasks = new Map<string, ShapeBuildTaskSummary>([
      ['node:fetch:1', makeTask({
        taskId: 'node:fetch:1',
        status: 'running',
        progress: 25,
        message: 'building',
        index: 1,
      })],
    ]);

    const snapshotTasks = [
      makeTask({
        taskId: 'node:fetch:1',
        status: 'running',
        progress: 10,
        message: 'snapshot stale',
        index: 1,
      }),
    ];

    const next = reconcileSnapshotWithCurrentTasks(snapshotTasks, currentTasks);

    expect(next).toEqual([
      makeTask({
        taskId: 'node:fetch:1',
        status: 'running',
        progress: 10,
        message: 'snapshot stale',
        index: 1,
      }),
    ]);
  });

  it('applies snapshot tasks only when they are not stale', () => {
    const currentTasks = new Map<string, ShapeBuildTaskSummary>([
      ['node:fetch:1', makeTask({
        taskId: 'node:fetch:1',
        status: 'running',
        progress: 40,
        message: 'older',
        index: 1,
      })],
    ]);

    const snapshotTasks = [
      makeTask({
        taskId: 'node:fetch:1',
        status: 'running',
        progress: 70,
        message: 'newer',
        index: 1,
      }),
      makeTask({
        taskId: 'node:fetch:2',
        status: 'queued',
        progress: 0,
        message: 'new',
        index: 2,
      }),
    ];

    const next = reconcileSnapshotWithCurrentTasks(snapshotTasks, currentTasks);

    expect(next).toHaveLength(2);
    expect(next.find((item) => item.taskId === 'node:fetch:1')?.progress).toBe(70);
    expect(next.find((item) => item.taskId === 'node:fetch:2')?.status).toBe('queued');
  });
});

describe('shouldPreferNextTask', () => {
  it('prefers terminal state over non-terminal state', () => {
    const current = makeTask({ status: 'completed', progress: 100 });
    const next = makeTask({ status: 'running', progress: 100 });

    expect(shouldPreferNextTask(current, next)).toBe(false);
  });

  it('rejects task updates that regress progress', () => {
    const current = makeTask({ status: 'running', progress: 80 });
    const next = makeTask({ status: 'running', progress: 60 });

    expect(shouldPreferNextTask(current, next)).toBe(false);
  });

  it('accepts progress advancement', () => {
    const current = makeTask({ status: 'running', progress: 80 });
    const next = makeTask({ status: 'running', progress: 99 });

    expect(shouldPreferNextTask(current, next)).toBe(true);
  });
});

describe('resolveTaskStage', () => {
  const buildRawTask = (overrides: Partial<RawTaskSummary>): RawTaskSummary => ({
    taskId: 'task-unknown',
    stage: 'fetch',
    status: 'queued',
    progress: 0,
    message: 'queued',
    index: 0,
    ...overrides,
  });

  it('returns valid task stage as is', () => {
    const task = buildRawTask({ stage: 'transform' });
    expect(resolveTaskStage(task)).toBe('transform');
  });

  it('throws on invalid task stage', () => {
    const task = buildRawTask({ stage: 'invalid' as RawTaskSummary['stage'] });
    expect(() => resolveTaskStage(task)).toThrow('[ShapeBuildTaskSync] invalid task stage');
  });
});

describe('normalizeStageKey', () => {
  it('returns explicit task stage without defaulting', () => {
    expect(normalizeStageKey({ stage: 'transform' })).toBe('transform');
  });
});
