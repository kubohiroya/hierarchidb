import { describe, expect, it } from 'vitest';
import type { TaskQueueRecord } from 'packages/build-api';
import { reconcileStageTasksByMetadata } from '../../services/vt/shapeStageReconcile';

type TestInput = {
  value?: string;
  cacheKey?: string;
  inputHash?: string;
};

type TestTask = TaskQueueRecord<TestInput, unknown>;

const buildTask = (
  taskId: string,
  value: string,
  overrides?: Partial<TestInput>,
): TestTask => ({
  taskId,
  nodeId: 'node-1',
  stage: 'fetch',
  status: 'queued',
  index: 0,
  progress: 0,
  inputData: {
    value,
    ...overrides,
  },
});

describe('reconcileStageTasksByMetadata', () => {
  it('keeps when cacheKey/inputHash match', () => {
    const desired = [buildTask('t1', 'a', { cacheKey: 'k:1', inputHash: 'h:1' })];
    const existing = [buildTask('t1', 'b', { cacheKey: 'k:1', inputHash: 'h:1' })];
    const result = reconcileStageTasksByMetadata(desired, existing);
    expect(result.missingTasks).toEqual([]);
    expect(result.obsoleteTaskIds).toEqual([]);
  });

  it('marks update when cacheKey matches and inputHash differs', () => {
    const desired = [buildTask('t1', 'a', { cacheKey: 'k:1', inputHash: 'h:2' })];
    const existing = [buildTask('t1', 'a', { cacheKey: 'k:1', inputHash: 'h:1' })];
    const result = reconcileStageTasksByMetadata(desired, existing);
    expect(result.missingTasks.map((task) => task.taskId)).toEqual(['t1']);
    expect(result.obsoleteTaskIds).toEqual(['t1']);
  });

  it('marks create/remove when cacheKey differs even if inputHash matches', () => {
    const desired = [buildTask('t1-new', 'a', { cacheKey: 'k:new', inputHash: 'h:1' })];
    const existing = [buildTask('t1-old', 'a', { cacheKey: 'k:old', inputHash: 'h:1' })];
    const result = reconcileStageTasksByMetadata(desired, existing);
    expect(result.missingTasks.map((task) => task.taskId)).toEqual(['t1-new']);
    expect(result.obsoleteTaskIds).toEqual(['t1-old']);
  });

  it('marks missing when task does not exist', () => {
    const desired = [buildTask('t1', 'a', { cacheKey: 'k:1', inputHash: 'h:1' })];
    const result = reconcileStageTasksByMetadata(desired, []);
    expect(result.missingTasks.map((task) => task.taskId)).toEqual(['t1']);
    expect(result.obsoleteTaskIds).toEqual([]);
  });

  it('marks obsolete when source is removed', () => {
    const existing = [buildTask('t1', 'a', { cacheKey: 'k:1', inputHash: 'h:1' })];
    const result = reconcileStageTasksByMetadata([], existing);
    expect(result.missingTasks).toEqual([]);
    expect(result.obsoleteTaskIds).toEqual(['t1']);
  });
});
