import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { DataSourceName } from '../../common/types/index';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/constants';
import { FetchStageAuthPendingError, runShapeFetchStageSection } from '../../services/vt/shapePipelineFetchStage';
import * as shapeFetchStageModule from '../../services/vt/shapeFetchStage';
import {
  listTasksByStageAndStatus,
  putTasks,
  VtTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';

const NODE_ID = 'shape-fetch-stage-section-node' as NodeId;

const createDb = (): VtTaskQueueDb => new VtTaskQueueDb();

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

const createFailedFetchTask = (taskId: string): TaskQueueRecord => ({
  taskId,
  nodeId: NODE_ID,
  stage: 'fetch',
  index: 0,
  status: 'failed',
  progress: 100,
  message: 'failed in prior run',
  errorMessage: 'failed in prior run',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  completedAt: Date.now(),
});

const createAuthPendingFetchTask = (taskId: string): TaskQueueRecord => ({
  taskId,
  nodeId: NODE_ID,
  stage: 'fetch',
  index: 0,
  status: 'queued',
  progress: 0,
  metadata: { authState: 'required' },
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe('runShapeFetchStageSection', () => {
  let db: VtTaskQueueDb | null = null;

  afterEach(async () => {
    if (!db) return;
    await db.tasks.clear();
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

  it('stops pipeline when fetch stage has only failed tasks even with finish_all_stages policy', async () => {
    db = createDb();
    await putTasks(db, [
      createFailedFetchTask('fetch-failed-1'),
      createFailedFetchTask('fetch-failed-2'),
    ]);

    const runShapeFetchStageSpy = vi
      .spyOn(shapeFetchStageModule, 'runShapeFetchStage')
      .mockResolvedValue(undefined);

    try {
      const stopAfterStage = await runShapeFetchStageSection({
        nodeId: NODE_ID,
        dataSource: 'geoboundaries',
        buildConfig: DEFAULT_BUILD_CONFIG,
        taskQueue: db,
        resumeExistingTasks: true,
        failureHandling: 'continue',
        buildContinuationPolicy: 'finish_all_stages',
        pipelineRunId: 'test-run-2',
      });

      expect(stopAfterStage).toBe(true);
    } finally {
      runShapeFetchStageSpy.mockRestore();
    }
  });

  it('throws auth-pending error without failing auth-pending fetch tasks', async () => {
    db = createDb();
    await putTasks(db, [createAuthPendingFetchTask('fetch-auth-pending-1')]);

    const runShapeFetchStageSpy = vi
      .spyOn(shapeFetchStageModule, 'runShapeFetchStage')
      .mockResolvedValue(undefined);

    try {
      await expect(runShapeFetchStageSection({
        nodeId: NODE_ID,
        dataSource: 'geoboundaries',
        buildConfig: DEFAULT_BUILD_CONFIG,
        taskQueue: db,
        resumeExistingTasks: true,
        failureHandling: 'continue',
        buildContinuationPolicy: 'finish_all_stages',
        pipelineRunId: 'test-run-auth',
      })).rejects.toBeInstanceOf(FetchStageAuthPendingError);
    } finally {
      runShapeFetchStageSpy.mockRestore();
    }

    const [failed, queued] = await Promise.all([
      listTasksByStageAndStatus(db, NODE_ID, 'fetch', 'failed'),
      listTasksByStageAndStatus(db, NODE_ID, 'fetch', 'queued'),
    ]);
    expect(failed).toHaveLength(0);
    expect(queued).toHaveLength(1);
  });
});
