import { describe, expect, it } from 'vitest';
import type { TaskQueueRecord } from '@hierarchidb/batch-api';
import { reconcileStageTasksByMetadata } from '../../services/vt/shapeStageReconcile.ts';

type TestInput = { value: string };

type TestTask = TaskQueueRecord<TestInput, unknown>;

const buildTask = (taskId: string, value: string): TestTask => ({
  taskId,
  nodeId: 'node-1',
  stage: 'fetch',
  status: 'queued',
  index: 0,
  progress: 0,
  inputData: { value },
});

describe('reconcileStageTasksByMetadata', () => {
  it('keeps when signatures match', () => {
    const desired = [buildTask('t1', 'a')];
    const existing = [buildTask('t1', 'a')];
    const result = reconcileStageTasksByMetadata(desired, existing);
    expect(result.missingTasks).toEqual([]);
    expect(result.obsoleteTaskIds).toEqual([]);
  });

  it('marks update when signatures differ', () => {
    const desired = [buildTask('t1', 'b')];
    const existing = [buildTask('t1', 'a')];
    const result = reconcileStageTasksByMetadata(desired, existing);
    expect(result.missingTasks.map((task) => task.taskId)).toEqual(['t1']);
    expect(result.obsoleteTaskIds).toEqual(['t1']);
  });

  it('marks missing when task does not exist', () => {
    const desired = [buildTask('t1', 'a')];
    const result = reconcileStageTasksByMetadata(desired, []);
    expect(result.missingTasks.map((task) => task.taskId)).toEqual(['t1']);
    expect(result.obsoleteTaskIds).toEqual([]);
  });

  it('marks obsolete when source is removed', () => {
    const existing = [buildTask('t1', 'a')];
    const result = reconcileStageTasksByMetadata([], existing);
    expect(result.missingTasks).toEqual([]);
    expect(result.obsoleteTaskIds).toEqual(['t1']);
  });
});
