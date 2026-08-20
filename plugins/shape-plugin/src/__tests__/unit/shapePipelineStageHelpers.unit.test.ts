import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listTasksByStageAndStatus,
  putTasks,
  updateTask,
  VtTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';
import {
  createPipelineLinkedAbortController,
  finalizePendingStageTasks,
} from '../../services/vt/shapePipelineStageHelpers';
import type { TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';

const NODE_ID = 'shape-stage-helper-test-node' as NodeId;
const createDb = (): VtTaskQueueDb => new VtTaskQueueDb();

const createTask = (
  taskId: string,
  status: TaskQueueRecord['status'],
): TaskQueueRecord => ({
  taskId,
  nodeId: NODE_ID,
  stage: 'source',
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

  it('propagates the pipeline abort signal to a stage controller', () => {
    const pipelineController = new AbortController();
    const stageController = createPipelineLinkedAbortController(pipelineController.signal);

    expect(stageController.signal.aborted).toBe(false);
    pipelineController.abort('pause-requested');
    expect(stageController.signal.aborted).toBe(true);
    expect(stageController.signal.reason).toBe('pause-requested');
  });

  it('allows explicit failed-to-queued retry transitions', async () => {
    db = createDb();
    const taskId = 'source-failed-1';
    await putTasks(db, [createTask(taskId, 'failed')]);

    await updateTask(db, taskId, { status: 'queued' });
    let failed = await listTasksByStageAndStatus(db, NODE_ID, 'source', 'failed');
    let queued = await listTasksByStageAndStatus(db, NODE_ID, 'source', 'queued');
    expect(failed).toHaveLength(1);
    expect(queued).toHaveLength(0);

    await updateTask(db, taskId, { status: 'queued' }, { allowTerminalStatusTransition: true });
    failed = await listTasksByStageAndStatus(db, NODE_ID, 'source', 'failed');
    queued = await listTasksByStageAndStatus(db, NODE_ID, 'source', 'queued');
    expect(failed).toHaveLength(0);
    expect(queued).toHaveLength(1);
  });

  it('persists failure reason into both message and errorMessage', async () => {
    db = createDb();
    await putTasks(db, [createTask('source-queued-1', 'queued')]);

    const failureReason = 'aborted: source stage completed with pending tasks';
    await finalizePendingStageTasks(
      db,
      NODE_ID,
      'source',
      failureReason,
      '[test] finalizePendingStageTasks',
      'run-1',
    );

    const failed = await listTasksByStageAndStatus(db, NODE_ID, 'source', 'failed');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.message).toBe(failureReason);
    expect(failed[0]?.errorMessage).toBe(failureReason);
  });

  it('keeps auth-pending tasks queued when finalizing pending tasks', async () => {
    db = createDb();
    await putTasks(db, [createTask('source-auth-pending-1', 'queued')]);
    await updateTask(db, 'source-auth-pending-1', {
      metadata: { authState: 'required' },
    });

    const failureReason = 'aborted: source stage completed with pending tasks';
    const finalized = await finalizePendingStageTasks(
      db,
      NODE_ID,
      'source',
      failureReason,
      '[test] finalizePendingStageTasks',
      'run-auth-pending',
    );

    const failed = await listTasksByStageAndStatus(db, NODE_ID, 'source', 'failed');
    const queued = await listTasksByStageAndStatus(db, NODE_ID, 'source', 'queued');
    expect(finalized.authPending).toBe(1);
    expect(failed).toHaveLength(0);
    expect(queued).toHaveLength(1);
  });

  it('does not let late running updates overwrite completed message', async () => {
    db = createDb();
    const taskId = 'source-completed-1';
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

    const completed = await listTasksByStageAndStatus(db, NODE_ID, 'source', 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.message).toBe('Completed successfully');
    expect(completed[0]?.progress).toBe(100);
  });
});
