import { describe, expect, it } from 'vitest';
import type { NodeId, TaskQueueRecord } from '@hierarchidb/core-types';
import { selectLatestTaskBySequence } from '../../taskOrdering.ts';

type TaskOverrides = Partial<TaskQueueRecord> & { taskId: string; sequence: number; updatedAt: number };

const nodeId = 'node-1' as NodeId;

const buildTask = (overrides: TaskOverrides): TaskQueueRecord => ({
  taskId: overrides.taskId,
  nodeId,
  stage: overrides.stage ?? 'vt',
  status: overrides.status ?? 'running',
  index: overrides.index ?? 0,
  progress: overrides.progress ?? 0,
  updatedAt: overrides.updatedAt,
  sequence: overrides.sequence,
});

describe('taskOrdering', () => {
  it('prefers higher sequence over timestamps when ordering tasks', () => {
    const tasks: TaskQueueRecord[] = [
      buildTask({ taskId: 'task-1', sequence: 10, updatedAt: 2000, index: 0 }),
      buildTask({ taskId: 'task-2', sequence: 11, updatedAt: 1500, index: 1 }),
    ];

    const latest = selectLatestTaskBySequence(tasks);

    expect(latest?.taskId).toBe('task-2');
  });
});
