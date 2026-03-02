import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { listTasksByStage, putTasks, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { applyStageTaskReconcile } from '../../services/vt/shapeStageReconcile';

type TestTaskInput = {
  value?: string;
  cacheKey?: string;
  inputHash?: string;
};

const NODE_ID = 'shape-stage-reconcile-apply-node' as NodeId;

const buildTask = (
  taskId: string,
  overrides?: Partial<TestTaskInput>,
): TaskQueueRecord<TestTaskInput, unknown> => ({
  taskId,
  nodeId: NODE_ID,
  stage: 'source',
  status: 'queued',
  index: 0,
  progress: 0,
  inputData: {
    value: taskId,
    ...overrides,
  },
});

describe('applyStageTaskReconcile', () => {
  const taskQueue = new VtTaskQueueDb();

  afterEach(async () => {
    await taskQueue.tasks.clear();
  });

  it('puts all desired tasks on fresh runs', async () => {
    const desired = [buildTask('t1', { cacheKey: 'k:1', inputHash: 'h:1' })];
    const result = await applyStageTaskReconcile({
      taskQueue,
      nodeId: NODE_ID,
      stage: 'source',
      desiredTasks: desired,
      resumeExistingTasks: false,
    });

    const stored = await listTasksByStage(taskQueue, NODE_ID, 'source');
    expect(stored.map((task) => task.taskId)).toEqual(['t1']);
    expect(result.missingTasks.map((task) => task.taskId)).toEqual(['t1']);
    expect(result.obsoleteTaskIds).toEqual([]);
  });

  it('keeps existing tasks when cacheKey/inputHash match', async () => {
    const existing = [buildTask('t1', { cacheKey: 'k:1', inputHash: 'h:1', value: 'old' })];
    await putTasks(taskQueue, existing);
    const desired = [buildTask('t1', { cacheKey: 'k:1', inputHash: 'h:1', value: 'new' })];

    const result = await applyStageTaskReconcile({
      taskQueue,
      nodeId: NODE_ID,
      stage: 'source',
      desiredTasks: desired,
      resumeExistingTasks: true,
    });

    const stored = await listTasksByStage(taskQueue, NODE_ID, 'source');
    expect(stored.map((task) => task.taskId)).toEqual(['t1']);
    expect(result.missingTasks).toEqual([]);
    expect(result.obsoleteTaskIds).toEqual([]);
  });

  it('replaces tasks when meta differs', async () => {
    const existing = [buildTask('t1-old', { cacheKey: 'k:1', inputHash: 'h:1' })];
    await putTasks(taskQueue, existing);
    const desired = [buildTask('t1-new', { cacheKey: 'k:1', inputHash: 'h:2' })];

    const result = await applyStageTaskReconcile({
      taskQueue,
      nodeId: NODE_ID,
      stage: 'source',
      desiredTasks: desired,
      resumeExistingTasks: true,
    });

    const stored = await listTasksByStage(taskQueue, NODE_ID, 'source');
    expect(stored.map((task) => task.taskId)).toEqual(['t1-new']);
    expect(result.missingTasks.map((task) => task.taskId)).toEqual(['t1-new']);
    expect(result.obsoleteTaskIds).toEqual(['t1-old']);
  });

  it('creates desired tasks when existing task list is empty on resume', async () => {
    const desired = [buildTask('t1', { cacheKey: 'k:1', inputHash: 'h:1' })];

    const result = await applyStageTaskReconcile({
      taskQueue,
      nodeId: NODE_ID,
      stage: 'source',
      desiredTasks: desired,
      existingTasks: [],
      resumeExistingTasks: true,
    });

    const stored = await listTasksByStage(taskQueue, NODE_ID, 'source');
    expect(stored.map((task) => task.taskId)).toEqual(['t1']);
    expect(result.missingTasks.map((task) => task.taskId)).toEqual(['t1']);
    expect(result.obsoleteTaskIds).toEqual([]);
  });
});
