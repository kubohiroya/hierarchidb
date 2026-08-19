import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import type { DataSourceName } from '../../common/types/index';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/constants';
import { SourceStageAuthPendingError, runShapeSourceStageSection } from '../../services/vt/shapePipelineSourceStage';
import * as shapeSourceStageModule from '../../services/vt/runShapeSourceStage';
import {
  listTasksByStageAndStatus,
  putTasks,
  updateTask,
  VtTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';

const NODE_ID = 'shape-source-stage-section-node' as NodeId;

const createDb = (): VtTaskQueueDb => new VtTaskQueueDb();

const createRunningSourceTask = (taskId: string): TaskQueueRecord => ({
  taskId,
  nodeId: NODE_ID,
  stage: 'source',
  index: 0,
  status: 'running',
  progress: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const createFailedSourceTask = (taskId: string): TaskQueueRecord => ({
  taskId,
  nodeId: NODE_ID,
  stage: 'source',
  index: 0,
  status: 'failed',
  progress: 100,
  message: 'failed in prior run',
  errorMessage: 'failed in prior run',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  completedAt: Date.now(),
});

const createAuthPendingSourceTask = (taskId: string): TaskQueueRecord => ({
  taskId,
  nodeId: NODE_ID,
  stage: 'source',
  index: 0,
  status: 'queued',
  progress: 0,
  metadata: { authState: 'required' },
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const createQueuedSourceTask = (taskId: string): TaskQueueRecord => ({
  taskId,
  nodeId: NODE_ID,
  stage: 'source',
  index: 0,
  status: 'queued',
  progress: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe('runShapeSourceStageSection', () => {
  let db: VtTaskQueueDb | null = null;

  beforeEach(async () => {
    await ephemeralDB.open();
    await Promise.all([
      ephemeralDB.buildSessionConfigs.delete(NODE_ID),
      ephemeralDB.buildSessionStatuses.delete(NODE_ID),
      ephemeralDB.buildSessionHeartbeats.delete(NODE_ID),
      ephemeralDB.buildStageStatuses.where('nodeId').equals(NODE_ID).delete(),
    ]);
    await Promise.all([
      ephemeralDB.buildSessionConfigs.put({ nodeId: NODE_ID, startedAt: Date.now() }),
      ephemeralDB.buildSessionStatuses.put({ nodeId: NODE_ID, status: 'running' }),
    ]);
  });

  afterEach(async () => {
    if (db) {
      await db.tasks.clear();
    }
    await Promise.all([
      ephemeralDB.buildSessionConfigs.delete(NODE_ID),
      ephemeralDB.buildSessionStatuses.delete(NODE_ID),
      ephemeralDB.buildSessionHeartbeats.delete(NODE_ID),
      ephemeralDB.buildStageStatuses.where('nodeId').equals(NODE_ID).delete(),
    ]);
    db = null;
  });

  it('finalizes pending source tasks when source stage throws', async () => {
    db = createDb();
    await putTasks(db, [createRunningSourceTask('source-running-1')]);

    await expect(runShapeSourceStageSection({
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
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'failed'),
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'running'),
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'queued'),
    ]);

    expect(failed).toHaveLength(1);
    expect(running).toHaveLength(0);
    expect(queued).toHaveLength(0);
    expect(failed[0]?.message?.startsWith('aborted:')).toBe(true);
    expect(failed[0]?.errorMessage).toBe(failed[0]?.message);
  });

  it('stops pipeline when source stage has only failed tasks even with finish_all_stages policy', async () => {
    db = createDb();
    await putTasks(db, [
      createFailedSourceTask('source-failed-1'),
      createFailedSourceTask('source-failed-2'),
    ]);

    const runShapeSourceStageSpy = vi
      .spyOn(shapeSourceStageModule, 'runShapeSourceStage')
      .mockResolvedValue(undefined);

    try {
      const stopAfterStage = await runShapeSourceStageSection({
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
      runShapeSourceStageSpy.mockRestore();
    }
  });

  it('throws auth-pending error without failing auth-pending source tasks', async () => {
    db = createDb();
    await putTasks(db, [createAuthPendingSourceTask('source-auth-pending-1')]);

    const runShapeSourceStageSpy = vi
      .spyOn(shapeSourceStageModule, 'runShapeSourceStage')
      .mockResolvedValue(undefined);

    try {
      await expect(runShapeSourceStageSection({
        nodeId: NODE_ID,
        dataSource: 'geoboundaries',
        buildConfig: DEFAULT_BUILD_CONFIG,
        taskQueue: db,
        resumeExistingTasks: true,
        failureHandling: 'continue',
        buildContinuationPolicy: 'finish_all_stages',
        pipelineRunId: 'test-run-auth',
      })).rejects.toBeInstanceOf(SourceStageAuthPendingError);
    } finally {
      runShapeSourceStageSpy.mockRestore();
    }

    const [failed, queued] = await Promise.all([
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'failed'),
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'queued'),
    ]);
    expect(failed).toHaveLength(0);
    expect(queued).toHaveLength(1);
  });

  it('keeps queued source tasks as queued during resume runs instead of marking them failed', async () => {
    db = createDb();
    await putTasks(db, [createQueuedSourceTask('source-queued-1')]);

    const runShapeSourceStageSpy = vi
      .spyOn(shapeSourceStageModule, 'runShapeSourceStage')
      .mockResolvedValue(undefined);

    try {
      const stopAfterStage = await runShapeSourceStageSection({
        nodeId: NODE_ID,
        dataSource: 'geoboundaries',
        buildConfig: DEFAULT_BUILD_CONFIG,
        taskQueue: db,
        resumeExistingTasks: true,
        failureHandling: 'continue',
        buildContinuationPolicy: 'finish_all_stages',
        pipelineRunId: 'test-run-resume-pending',
      });
      expect(stopAfterStage).toBe(false);
    } finally {
      runShapeSourceStageSpy.mockRestore();
    }

    const [failed, queued] = await Promise.all([
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'failed'),
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'queued'),
    ]);
    expect(failed).toHaveLength(0);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.message ?? null).toBeNull();
    expect(queued[0]?.errorMessage ?? null).toBeNull();
  });

  it('retries queued drain once on fresh runs before finalizing pending tasks', async () => {
    db = createDb();
    await putTasks(db, [createQueuedSourceTask('source-queued-drain-1')]);

    const runShapeSourceStageSpy = vi
      .spyOn(shapeSourceStageModule, 'runShapeSourceStage')
      .mockImplementationOnce(async () => {})
      .mockImplementationOnce(async () => {
        await updateTask(db!, 'source-queued-drain-1', {
          status: 'completed',
          progress: 100,
          completedAt: Date.now(),
          message: 'completed on recovery pass',
          errorMessage: undefined,
        });
      });

    try {
      const stopAfterStage = await runShapeSourceStageSection({
        nodeId: NODE_ID,
        dataSource: 'geoboundaries',
        buildConfig: DEFAULT_BUILD_CONFIG,
        taskQueue: db,
        resumeExistingTasks: false,
        failureHandling: 'continue',
        buildContinuationPolicy: 'finish_all_stages',
        pipelineRunId: 'test-run-fresh-pending-drain',
      });
      expect(stopAfterStage).toBe(false);
      expect(runShapeSourceStageSpy).toHaveBeenCalledTimes(2);
      expect(runShapeSourceStageSpy.mock.calls[0]?.[0]?.resumeExistingTasks).toBe(false);
      expect(runShapeSourceStageSpy.mock.calls[1]?.[0]?.resumeExistingTasks).toBe(true);
    } finally {
      runShapeSourceStageSpy.mockRestore();
    }

    const [failed, completed, queued] = await Promise.all([
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'failed'),
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'completed'),
      listTasksByStageAndStatus(db, NODE_ID, 'source', 'queued'),
    ]);
    expect(failed).toHaveLength(0);
    expect(completed).toHaveLength(1);
    expect(queued).toHaveLength(0);
  });
});
