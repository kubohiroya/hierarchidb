import type { NodeId, TaskQueueRecord } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import { selectLatestTaskByProgress } from '../../taskOrdering';

type TaskOverrides = Partial<TaskQueueRecord> & {
  taskId: string;
  updatedAt: number;
  progress?: number;
};

const nodeId = 'node-1' as NodeId;

const buildTask = (overrides: TaskOverrides): TaskQueueRecord => ({
  taskId: overrides.taskId,
  nodeId,
  stage: overrides.stage ?? 'tileEmit',
  status: overrides.status ?? 'running',
  index: overrides.index ?? 0,
  progress: overrides.progress ?? 0,
  updatedAt: overrides.updatedAt,
});

describe('taskOrdering', () => {
  it('prefers higher progress over older timestamps for latest task resolution', () => {
    const tasks: TaskQueueRecord[] = [
      buildTask({ taskId: 'task-1', progress: 10, updatedAt: 2000, index: 0 }),
      buildTask({ taskId: 'task-2', progress: 11, updatedAt: 1500, index: 1 }),
    ];

    const latest = selectLatestTaskByProgress(tasks);

    expect(latest?.taskId).toBe('task-2');
  });
});
