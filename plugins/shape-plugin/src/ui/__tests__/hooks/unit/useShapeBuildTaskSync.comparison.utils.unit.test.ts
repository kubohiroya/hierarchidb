import type { ShapeBuildTaskSummary } from '@hierarchidb/build-api';
import { describe, expect, it } from 'vitest';
import {
  replaceSnapshotTasks,
  resolveTaskSummaryFromRaw,
  shouldPreferNextTask,
} from '../../../components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.comparisonUtils';
import type { RawTaskSummary } from '../../../components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSyncTypes';

const makeTask = (overrides: Partial<ShapeBuildTaskSummary>): ShapeBuildTaskSummary => ({
  taskId: 'task-unknown',
  stage: 'source',
  version: 1,
  status: 'queued',
  progress: 0,
  message: 'queued',
  index: 0,
  ...overrides,
});

describe('reconcileSnapshotWithCurrentTasks', () => {
  it('replaces current list with snapshot content only', () => {
    const snapshotTasks = [
      makeTask({ taskId: 'task-a', stage: 'geometry', progress: 15, index: 1 }),
      makeTask({ taskId: 'task-b', stage: 'geometry', progress: 30, index: 2 }),
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
  it('accepts same-version update even when progress regresses', () => {
    expect(
      shouldPreferNextTask(
        makeTask({ status: 'running', progress: 80 }),
        makeTask({ status: 'running', progress: 50 })
      )
    ).toBe(true);
  });

  it('accepts progress advancement', () => {
    expect(
      shouldPreferNextTask(
        makeTask({ status: 'running', progress: 80 }),
        makeTask({ status: 'running', progress: 90 })
      )
    ).toBe(true);
  });
});

describe('resolveTaskSummaryFromRaw', () => {
  const buildRawTask = (overrides: Partial<RawTaskSummary>): RawTaskSummary => ({
    taskId: 'task-unknown',
    stage: 'source',
    version: 1,
    status: 'queued',
    progress: 0,
    message: 'queued',
    index: 0,
    ...overrides,
  });

  it('throws for invalid stage', () => {
    expect(() => resolveTaskSummaryFromRaw(buildRawTask({ stage: 'invalid' as never }))).toThrow(
      'invalid task stage'
    );
  });

  it('keeps canonical stage', () => {
    const task = resolveTaskSummaryFromRaw(buildRawTask({ stage: 'geometry', progress: 50 }));
    expect(task.stage).toBe('geometry');
  });

  it('normalizes stage from canonical stageId when stage is legacy-incompatible', () => {
    const task = resolveTaskSummaryFromRaw(
      buildRawTask({
        stage: 'invalid' as never,
        stageId: 'source-stage',
        progress: 10,
      })
    );
    expect(task.stage).toBe('source');
  });

  it('prioritizes stageId over stage when both are present', () => {
    const task = resolveTaskSummaryFromRaw(
      buildRawTask({
        stage: 'tileEmit',
        stageId: 'geometry-stage',
        progress: 25,
      })
    );
    expect(task.stage).toBe('geometry');
  });

  it('throws when progress is undefined', () => {
    expect(() => resolveTaskSummaryFromRaw(buildRawTask({ progress: undefined }))).toThrow(
      'invalid progress'
    );
  });

  it('throws when progress is negative', () => {
    expect(() => resolveTaskSummaryFromRaw(buildRawTask({ progress: -1 }))).toThrow(
      'invalid progress'
    );
  });

  it('throws when progress is greater than 100', () => {
    expect(() => resolveTaskSummaryFromRaw(buildRawTask({ progress: 101 }))).toThrow(
      'invalid progress'
    );
  });
});
