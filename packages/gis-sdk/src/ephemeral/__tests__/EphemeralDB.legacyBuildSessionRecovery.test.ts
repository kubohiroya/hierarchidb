import type { NodeId } from '@hierarchidb/core-types';
import {
  LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING,
  RESET_LEGACY_BUILD_SESSION_AND_TASKS,
  type ShapeBuildSessionRecoveryRequest,
} from '@hierarchidb/shape-api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EphemeralDB } from '../EphemeralDB';
import type { BuildStageStatus } from '../EphemeralDBRecordTypes';
import { getSessionWithDetails, probeBuildSession } from '../sessionHelpers';

describe('EphemeralDB legacy build session recovery', () => {
  let db: EphemeralDB;
  const nodeId = 'legacy-node' as NodeId;

  const query = () => ({
    getConfig: async (targetNodeId: NodeId) => db.buildSessionConfigs.get(targetNodeId),
    getHeartbeat: async (targetNodeId: NodeId) => db.buildSessionHeartbeats.get(targetNodeId),
    getStatus: async (targetNodeId: NodeId) => db.buildSessionStatuses.get(targetNodeId),
    getStageStatuses: async (targetNodeId: NodeId) =>
      db.buildStageStatuses.where('nodeId').equals(targetNodeId).toArray(),
    getTasks: async (targetNodeId: NodeId) =>
      db.buildTasks.where('nodeId').equals(targetNodeId).toArray(),
  });

  const seedLegacySession = async (): Promise<void> => {
    await db.buildSessionConfigs.put({
      nodeId,
      domainType: 'shape',
      startedAt: 1_000,
    });
    await db.buildSessionHeartbeats.put({ nodeId, lastHeartbeatAt: 1_200 });
    await db.buildSessionStatuses.put({ nodeId, status: 'running' });
    await db.buildStageStatuses.put({
      id: `${nodeId}:source`,
      nodeId,
      stage: 'source',
      status: 'running',
      startedAt: 1_100,
    });
    await db.buildTasks.put({
      taskId: 'legacy-task',
      nodeId,
      version: 1,
      stage: 'source',
      status: 'queued',
      index: 0,
      progress: 0,
    });
  };

  const seedPreservedData = async (): Promise<void> => {
    await db.transaction('rw', [db.sourceCache, db.sourceCacheMeta], async () => {
      await db.sourceCache.put({
        id: 'source-cache',
        nodeId,
        domainType: 'shape',
        sourceKey: 'source-key',
        data: new ArrayBuffer(8),
        featureCount: 1,
        bbox: [0, 0, 1, 1],
        downloadTime: 10,
        size: 8,
        timestamp: 900,
      });
    });
    await db.transaction('rw', [db.geometryCache, db.geometryCacheMeta], async () => {
      await db.geometryCache.put({
        id: 'geometry-cache',
        nodeId,
        domainType: 'shape',
        bandIndex: 0,
        sourceKey: 'source-key',
        data: new ArrayBuffer(8),
        featureCount: 1,
        vertexCount: 4,
        polygonCount: 1,
        extractionRatio: 1,
        tolerance: 0,
        timestamp: 950,
      });
    });
    await db.tileEmitBufferRelations.put({
      id: 'tile-relation',
      nodeId,
      domainType: 'shape',
      bandIndex: 0,
      tileId: '0/0/0',
      bufferId: 'geometry-cache',
      createdAt: 975,
    });
    await db.geometryErrors.put({
      id: 'geometry-error',
      nodeId,
      taskId: 'legacy-task',
      stage: 'geometry',
      polygonCount: 1,
      ringCount: 1,
      polygonErrorCount: 1,
      ringErrorCount: 1,
      createdAt: 980,
      lineFeatures: { type: 'FeatureCollection', features: [] },
    });
  };

  beforeEach(async () => {
    db = new EphemeralDB('test-legacy-build-session-recovery');
    await db.open();
  });

  afterEach(async () => {
    await db.close();
    await db.delete();
  });

  it('reports missing stage inactiveMs as a typed recoverable contract error', async () => {
    await seedLegacySession();

    await expect(getSessionWithDetails(nodeId, query())).rejects.toMatchObject({
      name: 'ShapeBuildSessionContractError',
      details: {
        code: LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING,
        nodeId,
        fieldPath: 'buildStageStatuses.inactiveMs',
        stageStatusId: `${nodeId}:source`,
        stage: 'source',
        received: 'undefined',
      },
    });

    await expect(probeBuildSession(nodeId, query())).resolves.toMatchObject({
      kind: 'recoverable-contract-error',
      error: {
        code: LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING,
        nodeId,
      },
    });
  });

  it('does not classify other inactiveMs contract violations as recoverable', async () => {
    await seedLegacySession();
    await db.buildStageStatuses.update(`${nodeId}:source`, { inactiveMs: -1 });

    await expect(probeBuildSession(nodeId, query())).rejects.toThrow(
      'stageStatuses[0].inactiveMs must be a finite non-negative number, received -1'
    );
  });

  it('requires confirmation and atomically deletes only session rows and build tasks', async () => {
    await seedLegacySession();
    await seedPreservedData();
    const otherNodeId = 'other-node' as NodeId;
    await db.buildSessionConfigs.put({
      nodeId: otherNodeId,
      domainType: 'shape',
      startedAt: 1_500,
    });
    await db.buildTasks.put({
      taskId: 'other-task',
      nodeId: otherNodeId,
      version: 1,
      stage: 'source',
      status: 'queued',
      index: 0,
      progress: 0,
    });
    const probe = await probeBuildSession(nodeId, query());
    if (probe.kind !== 'recoverable-contract-error') {
      throw new Error(`Expected recoverable contract error, received ${probe.kind}`);
    }

    const unconfirmedRequest = {
      nodeId,
      confirmation: 'NOT_CONFIRMED',
      error: probe.error,
    } as unknown as ShapeBuildSessionRecoveryRequest;
    await expect(db.recoverLegacyBuildSession(unconfirmedRequest)).rejects.toThrow(
      'requires explicit confirmation'
    );
    expect(await db.buildSessionConfigs.get(nodeId)).toBeDefined();
    expect(await db.buildTasks.where('nodeId').equals(nodeId).count()).toBe(1);

    await expect(
      db.recoverLegacyBuildSession({
        nodeId,
        confirmation: RESET_LEGACY_BUILD_SESSION_AND_TASKS,
        error: {
          ...probe.error,
          stageStatusId: `${nodeId}:geometry`,
        },
      })
    ).rejects.toThrow('build session recovery error changed');
    expect(await db.buildSessionConfigs.get(nodeId)).toBeDefined();
    expect(await db.buildTasks.where('nodeId').equals(nodeId).count()).toBe(1);

    const result = await db.recoverLegacyBuildSession({
      nodeId,
      confirmation: RESET_LEGACY_BUILD_SESSION_AND_TASKS,
      error: probe.error,
    });

    expect(result).toEqual({
      nodeId,
      deletedRowCounts: {
        buildSessionConfigs: 1,
        buildSessionHeartbeats: 1,
        buildSessionStatuses: 1,
        buildStageStatuses: 1,
        buildTasks: 1,
      },
    });
    expect(await db.buildSessionConfigs.get(nodeId)).toBeUndefined();
    expect(await db.buildSessionHeartbeats.get(nodeId)).toBeUndefined();
    expect(await db.buildSessionStatuses.get(nodeId)).toBeUndefined();
    expect(await db.buildStageStatuses.where('nodeId').equals(nodeId).count()).toBe(0);
    expect(await db.buildTasks.where('nodeId').equals(nodeId).count()).toBe(0);
    expect(await db.buildSessionConfigs.get(otherNodeId)).toBeDefined();
    expect(await db.buildTasks.get('other-task')).toBeDefined();

    expect(await db.sourceCache.get('source-cache')).toBeDefined();
    expect(await db.sourceCacheMeta.get('source-cache')).toBeDefined();
    expect(await db.geometryCache.get('geometry-cache')).toBeDefined();
    expect(await db.geometryCacheMeta.get('geometry-cache')).toMatchObject({ tolerance: 0 });
    expect(await db.tileEmitBufferRelations.get('tile-relation')).toBeDefined();
    expect(await db.geometryErrors.get('geometry-error')).toBeDefined();

    await db.buildSessionConfigs.put({ nodeId, domainType: 'shape', startedAt: 2_000 });
    await db.buildSessionStatuses.put({ nodeId, status: 'running' });
    const freshStage: BuildStageStatus = {
      id: `${nodeId}:source`,
      nodeId,
      stage: 'source',
      status: 'running',
      startedAt: 2_000,
      inactiveMs: 0,
    };
    await db.buildStageStatuses.put(freshStage);

    await expect(getSessionWithDetails(nodeId, query())).resolves.toMatchObject({
      nodeId,
      startedAt: 2_000,
      stageInactiveMs: 0,
    });
  });
});
