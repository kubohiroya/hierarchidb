import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listTasksByStageAndStatus,
  putTasks,
  updateTask,
  VtTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';
import { finalizePendingStageTasks } from '../../services/vt/shapePipelineStageHelpers';
import type { TaskQueueRecord } from 'packages/build-api';
import type { NodeId } from '@hierarchidb/core-types';

const NODE_ID = 'shape-stage-helper-test-node' as NodeId;
const createDb = (): VtTaskQueueDb => new VtTaskQueueDb(`hdb-stage-helper-${Date.now()}-${Math.random()}`);

const createTask = (
  taskId: string,
  status: TaskQueueRecord['status'],
): TaskQueueRecord => ({
  taskId,
  nodeId: NODE_ID,
  stage: 'fetch',
  index: 0,
  status,
  progress: status === 'completed' ? 100 : 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe('shapePipelineStageHelpers', () => {
  let db: VtTaskQueueDb | null = null;

  afterEach(async () => {
    if (!db) return;
    await db.tasks.clear();
    db = null;
  });

  it('allows explicit failed-to-queued retry transitions', async () => {
    db = createDb();
    const taskId = 'fetch-failed-1';
    await putTasks(db, [createTask(taskId, 'failed')]);

    await updateTask(db, taskId, { status: 'queued' });
    let failed = await listTasksByStageAndStatus(db, NODE_ID, 'fetch', 'failed');
    let queued = await listTasksByStageAndStatus(db, NODE_ID, 'fetch', 'queued');
    expect(failed).toHaveLength(1);
    expect(queued).toHaveLength(0);

    await updateTask(db, taskId, { status: 'queued' }, { allowTerminalStatusTransition: true });
    failed = await listTasksByStageAndStatus(db, NODE_ID, 'fetch', 'failed');
    queued = await listTasksByStageAndStatus(db, NODE_ID, 'fetch', 'queued');
    expect(failed).toHaveLength(0);
    expect(queued).toHaveLength(1);
  });

  it('persists failure reason into both message and errorMessage', async () => {
    db = createDb();
    await putTasks(db, [createTask('fetch-queued-1', 'queued')]);

    const failureReason = 'aborted: fetch stage completed with pending tasks';
    await finalizePendingStageTasks(
      db,
      NODE_ID,
      'fetch',
      failureReason,
      '[test] finalizePendingStageTasks',
      'run-1',
    );

    const failed = await listTasksByStageAndStatus(db, NODE_ID, 'fetch', 'failed');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.message).toBe(failureReason);
    expect(failed[0]?.errorMessage).toBe(failureReason);
  });

  it('does not let late running updates overwrite completed message', async () => {
    db = createDb();
    const taskId = 'fetch-completed-1';
    await putTasks(db, [createTask(taskId, 'queued')]);

    await updateTask(db, taskId, {
      status: 'completed',
      progress: 100,
      message: 'Completed successfully',
      completedAt: Date.now(),
    });
    await updateTask(db, taskId, {
      status: 'running',
      progress: 95,
      message: 'encode',
    });

    const completed = await listTasksByStageAndStatus(db, NODE_ID, 'fetch', 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.message).toBe('Completed successfully');
    expect(completed[0]?.progress).toBe(100);
  });
});
