import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { TaskQueueRecord } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { DataSourceName } from '../../common/types/index.js';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/constants.js';
import { runShapeFetchStageSection } from '../../services/vt/shapePipelineFetchStage.ts';
import {
  listTasksByStageAndStatus,
  putTasks,
  VtTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';

const NODE_ID = 'shape-fetch-stage-section-node' as NodeId;

const createDb = (): VtTaskQueueDb => new VtTaskQueueDb(`hdb-fetch-stage-${Date.now()}-${Math.random()}`);

const createRunningFetchTask = (taskId: string): TaskQueueRecord => ({
  taskId,
  nodeId: NODE_ID,
  stage: 'fetch',
  index: 0,
  status: 'running',
  progress: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe('runShapeFetchStageSection', () => {
  let db: VtTaskQueueDb | null = null;

  afterEach(async () => {
    if (!db) return;
    await db.delete();
    db = null;
  });

  it('finalizes pending fetch tasks when fetch stage throws', async () => {
    db = createDb();
    await putTasks(db, [createRunningFetchTask('fetch-running-1')]);

    await expect(runShapeFetchStageSection({
      nodeId: NODE_ID,
      dataSource: '__invalid_source__' as DataSourceName,
      buildConfig: DEFAULT_BUILD_CONFIG,
      taskQueue: db,
      resumeExistingTasks: true,
      failureHandling: 'continue',
      buildContinuationPolicy: 'finish_all_stages',
      pipelineRunId: 'test-run-1',
    })).rejects.toThrow();

    const [failed, running, queued] = await Promise.all([
      listTasksByStageAndStatus(db, NODE_ID, 'fetch', 'failed'),
      listTasksByStageAndStatus(db, NODE_ID, 'fetch', 'running'),
      listTasksByStageAndStatus(db, NODE_ID, 'fetch', 'queued'),
    ]);

    expect(failed).toHaveLength(1);
    expect(running).toHaveLength(0);
    expect(queued).toHaveLength(0);
    expect(failed[0]?.message?.startsWith('aborted:')).toBe(true);
    expect(failed[0]?.errorMessage).toBe(failed[0]?.message);
  });
});
