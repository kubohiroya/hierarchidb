import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runStageTasks } from '../runStageTasks';
import { listTasksByStageAndStatus, putTasks, VtTaskQueueDb } from '../task/taskQueue';

const NODE_ID = 'vt-orchestrator-auth-pending-node' as NodeId;

describe('runStageTasks auth required handling', () => {
  const db = new VtTaskQueueDb();

  afterEach(async () => {
    await db.tasks.clear();
  });

  it('requeues auth-required task without marking it failed', async () => {
    const taskId = 'source-auth-1';
    await putTasks(db, [
      {
        taskId,
        nodeId: NODE_ID,
        stage: 'source',
        status: 'queued',
        index: 0,
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        inputData: { url: 'https://example.com/data.geojson' },
      },
    ]);

    const handler = vi.fn(async () => {
      const error = new Error('Authentication required');
      error.name = 'AuthRequiredError';
      throw error;
    });

    await runStageTasks({
      nodeId: NODE_ID,
      stage: 'source',
      handler,
      maxConcurrent: 1,
      failureHandling: 'continue',
    });

    const [queued, failed] = await Promise.all([
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'queued'),
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'failed'),
    ]);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(failed).toHaveLength(0);
    expect(queued).toHaveLength(1);
    expect((queued[0]?.metadata as { authState?: string } | undefined)?.authState).toBe('required');
  });
});
