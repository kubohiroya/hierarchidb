import { describe, expect, it } from 'vitest';
import type { ShapeBuildTaskSummary } from '@hierarchidb/build-api';
import {
  replaceSnapshotTasks,
  shouldPreferNextTask,
  resolveTaskSummaryFromRaw,
} from '../../../components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.comparison.utils';
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
  it('replaces current list with snapshot content only', () => {
    const snapshotTasks = [
      makeTask({ taskId: 'task-a', stage: 'transform', progress: 15, index: 1 }),
      makeTask({ taskId: 'task-b', stage: 'transform', progress: 30, index: 2 }),
    ];

    const next = replaceSnapshotTasks(snapshotTasks);

    expect(next).toEqual(snapshotTasks);
    expect(next).toHaveLength(2);
  });

  it('keeps snapshot items order as provided', () => {
    const snapshotTasks = [
      makeTask({ taskId: 'task-b', progress: 30, index: 2 }),
      makeTask({ taskId: 'task-a', progress: 10, index: 1 }),
    ];

    const next = replaceSnapshotTasks(snapshotTasks);

    expect(next[0]?.taskId).toBe('task-b');
    expect(next[1]?.taskId).toBe('task-a');
  });
});

describe('shouldPreferNextTask', () => {
  it('rejects progress regression', () => {
    expect(shouldPreferNextTask(
      makeTask({ status: 'running', progress: 80 }),
      makeTask({ status: 'running', progress: 50 }),
    )).toBe(false);
  });

  it('accepts progress advancement', () => {
    expect(shouldPreferNextTask(
      makeTask({ status: 'running', progress: 80 }),
      makeTask({ status: 'running', progress: 90 }),
    )).toBe(true);
  });
});

describe('resolveTaskSummaryFromRaw', () => {
  const buildRawTask = (overrides: Partial<RawTaskSummary>): RawTaskSummary => ({
    taskId: 'task-unknown',
    stage: 'fetch',
    status: 'queued',
    progress: 0,
    message: 'queued',
    index: 0,
    ...overrides,
  });

  it('throws for invalid stage', () => {
    expect(() => resolveTaskSummaryFromRaw(buildRawTask({ stage: 'invalid' as never }))).toThrow('invalid task stage');
  });

  it('keeps canonical stage', () => {
    const task = resolveTaskSummaryFromRaw(buildRawTask({ stage: 'transform', progress: 100 }));
    expect(task.stage).toBe('transform');
  });
});
