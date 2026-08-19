import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '../../services/build/ShapeBuildAPIClient';

const asNodeId = (value: string): NodeId => value as NodeId;

const testNodeIds = [
  asNodeId('shape-round-trip-1'),
  asNodeId('shape-round-trip-2'),
  asNodeId('shape-round-trip-paused'),
  asNodeId('shape-round-trip-active-stage'),
  asNodeId('shape-round-trip-stage-conflict'),
];

const deleteTestSessions = async (): Promise<void> => {
  await ephemeralDB.open();
  for (const nodeId of testNodeIds) {
    await ephemeralDB.transaction(
      'rw',
      [
        ephemeralDB.buildSessionConfigs,
        ephemeralDB.buildSessionHeartbeats,
        ephemeralDB.buildSessionStatuses,
        ephemeralDB.buildStageStatuses,
        ephemeralDB.buildTasks,
      ],
      async () => {
        await Promise.all([
          ephemeralDB.buildSessionConfigs.delete(nodeId),
          ephemeralDB.buildSessionHeartbeats.delete(nodeId),
          ephemeralDB.buildSessionStatuses.delete(nodeId),
          ephemeralDB.buildStageStatuses.where('nodeId').equals(nodeId).delete(),
          ephemeralDB.buildTasks.where('nodeId').equals(nodeId).delete(),
        ]);
      }
    );
  }
};

describe('ShapeBuildAPIClient normalized session round trip', () => {
  beforeEach(async () => {
    await deleteTestSessions();
  });

  afterEach(async () => {
    await deleteTestSessions();
  });

  it('reconstructs persisted session and canonical stage timing', async () => {
    const nodeId = asNodeId('shape-round-trip-1');
    await shapeMutationAPIImpl.upsertBuildSession({
      nodeId,
      status: 'running',
      startedAt: 1_000,
      updatedAt: 1_000,
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
      stages: {},
    });

    await shapeMutationAPIImpl.updateBuildSession(nodeId, {
      inactiveMs: 50,
    });
    await shapeMutationAPIImpl.updateBuildSession(nodeId, {
      stages: {
        source: { status: 'running' },
      },
      stageId: 'source:opaque-run-id',
      stageStartedAt: 1_100,
      stageInactiveMs: 25,
    } as never);

    const session = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId);
    expect(session).toEqual(
      expect.objectContaining({
        nodeId,
        status: 'running',
        startedAt: 1_000,
        updatedAt: 1_100,
        inactiveMs: 50,
        stageId: 'source',
        stageStartedAt: 1_100,
        stageInactiveMs: 25,
      })
    );
  });

  it('persists a running stage from the stage map when progress has no stage', async () => {
    const nodeId = asNodeId('shape-round-trip-active-stage');
    await shapeMutationAPIImpl.upsertBuildSession({
      nodeId,
      status: 'running',
      startedAt: 2_000,
      updatedAt: 2_000,
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
      stages: {
        source: {
          status: 'running',
          progress: 0,
          tasksTotal: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
        },
      },
      stageId: 'source:opaque-run-id',
      stageStartedAt: 2_100,
      stageInactiveMs: 10,
    } as never);

    expect(await shapeQueryAPIImpl.getBuildSessionRecord(nodeId)).toEqual(
      expect.objectContaining({
        stageId: 'source',
        stageStartedAt: 2_100,
        stageInactiveMs: 10,
      })
    );
  });

  it('rejects a progress stage that contradicts the running stage map', async () => {
    const nodeId = asNodeId('shape-round-trip-stage-conflict');

    await expect(
      shapeMutationAPIImpl.upsertBuildSession({
        nodeId,
        status: 'running',
        startedAt: 3_000,
        updatedAt: 3_000,
        progress: {
          total: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          percentage: 0,
          stage: 'geometry',
        },
        stages: {
          source: {
            status: 'running',
            progress: 0,
            tasksTotal: 0,
            tasksCompleted: 0,
            tasksFailed: 0,
          },
        },
        stageStartedAt: 3_100,
        stageInactiveMs: 0,
      } as never)
    ).rejects.toThrow('progress stage must match the running stage');
  });

  it('clears stale stage timing when a new session replaces the previous session', async () => {
    const nodeId = asNodeId('shape-round-trip-2');
    const createSession = async (startedAt: number): Promise<void> => {
      await shapeMutationAPIImpl.upsertBuildSession({
        nodeId,
        status: 'running',
        startedAt,
        updatedAt: startedAt,
        progress: {
          total: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          percentage: 0,
        },
        stages: {},
      });
    };

    await createSession(1_000);
    await shapeMutationAPIImpl.updateBuildSession(nodeId, {
      stages: {
        geometry: { status: 'running' },
      },
      stageStartedAt: 1_100,
      stageInactiveMs: 0,
    } as never);
    await createSession(2_000);

    const session = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId);
    expect(session).toEqual(
      expect.objectContaining({
        startedAt: 2_000,
        updatedAt: 2_000,
        stageId: undefined,
        stageStartedAt: undefined,
        stageInactiveMs: undefined,
      })
    );
  });

  it('preserves resumability for a paused normalized session', async () => {
    const nodeId = asNodeId('shape-round-trip-paused');
    await shapeMutationAPIImpl.upsertBuildSession({
      nodeId,
      status: 'paused',
      canResume: true,
      startedAt: 1_000,
      updatedAt: 1_000,
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
      stages: {},
    });

    const session = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId);
    expect(session).toEqual(
      expect.objectContaining({
        status: 'paused',
        canResume: true,
      })
    );
  });
});
