import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, describe, expect, it } from 'vitest';
import { runStageTasks } from '../runStageTasks';
import { listTasksByStageAndStatus, putTasks, VtTaskQueueDb } from '../task/taskQueue';

const NODE_ID = 'vt-orchestrator-abort-node' as NodeId;

const createDeferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolver: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolver = resolve;
  });
  return {
    promise,
    resolve: () => {
      if (!resolver) throw new Error('deferred resolver is missing');
      resolver();
    },
  };
};

describe('runStageTasks external abort', () => {
  const db = new VtTaskQueueDb();

  afterEach(async () => {
    await db.tasks.clear();
  });

  it('does not publish a late task result after the pipeline signal aborts', async () => {
    const taskId = 'source-abort-1';
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
        inputData: {},
      },
    ]);
    const handlerStarted = createDeferred();
    const allowHandlerToFinish = createDeferred();
    const abortController = new AbortController();

    const run = runStageTasks({
      nodeId: NODE_ID,
      stage: 'source',
      handler: async () => {
        handlerStarted.resolve();
        await allowHandlerToFinish.promise;
        return { status: 'completed' as const, progress: 100 };
      },
      maxConcurrent: 1,
      failureHandling: 'continue',
      abortController,
    });

    await handlerStarted.promise;
    abortController.abort();
    allowHandlerToFinish.resolve();
    await run;

    const [running, completed, failed] = await Promise.all([
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'running'),
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'completed'),
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'failed'),
    ]);
    expect(running.map((task) => task.taskId)).toEqual([taskId]);
    expect(completed).toHaveLength(0);
    expect(failed).toHaveLength(0);
  });
});
