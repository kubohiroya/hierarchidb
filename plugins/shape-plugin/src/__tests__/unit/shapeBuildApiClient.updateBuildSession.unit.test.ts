import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { shapeMutationAPIImpl } from '../../services/build/ShapeBuildAPIClient';

const nodeId = 'shape-update-session-test' as NodeId;

const deleteSessionRows = async (): Promise<void> => {
  await Promise.all([
    ephemeralDB.buildSessionConfigs.delete(nodeId),
    ephemeralDB.buildSessionHeartbeats.delete(nodeId),
    ephemeralDB.buildSessionStatuses.delete(nodeId),
    ephemeralDB.buildStageStatuses.where('nodeId').equals(nodeId).delete(),
  ]);
};

describe('ShapeBuildAPIClient.updateBuildSession', () => {
  beforeEach(async () => {
    await ephemeralDB.open();
    await deleteSessionRows();
    await Promise.all([
      ephemeralDB.buildSessionConfigs.put({ nodeId, startedAt: 1_000 }),
      ephemeralDB.buildSessionStatuses.put({ nodeId, status: 'running' }),
    ]);
  });

  afterEach(async () => {
    await deleteSessionRows();
  });

  it('rejects a partial normalized session when the status row is missing', async () => {
    await ephemeralDB.buildSessionStatuses.delete(nodeId);

    await expect(shapeMutationAPIImpl.updateBuildSession(nodeId, {
      status: 'paused',
      stopReason: 'user-pause',
    } as never)).rejects.toThrow('build session status is missing');

    expect(await ephemeralDB.buildSessionStatuses.get(nodeId)).toBeUndefined();
  });

  it('persists the canonical running stage with explicit timing', async () => {
    await shapeMutationAPIImpl.updateBuildSession(nodeId, {
      stages: {
        source: { status: 'running' },
      },
      stageId: 'source:run-1',
      stageStartedAt: 1_100,
      stageInactiveMs: 25,
    } as never);

    expect(await ephemeralDB.buildStageStatuses.get(`${nodeId}:source`)).toEqual({
      id: `${nodeId}:source`,
      nodeId,
      stage: 'source',
      status: 'running',
      startedAt: 1_100,
      inactiveMs: 25,
      stageId: 'source:run-1',
      completedAt: undefined,
    });
  });

  it('rejects a new running stage without explicit timing', async () => {
    await expect(shapeMutationAPIImpl.updateBuildSession(nodeId, {
      stages: {
        geometry: { status: 'running' },
      },
      stageId: 'geometry:run-1',
    } as never)).rejects.toThrow('stageStartedAt must be a finite non-negative number');

    expect(await ephemeralDB.buildStageStatuses.get(`${nodeId}:geometry`)).toBeUndefined();
  });

  it('persists session inactive time in the normalized status row', async () => {
    await shapeMutationAPIImpl.updateBuildSession(nodeId, {
      inactiveMs: 75,
    } as never);

    expect(await ephemeralDB.buildSessionStatuses.get(nodeId)).toEqual({
      nodeId,
      status: 'running',
      stopReason: undefined,
      completedAt: undefined,
      inactiveMs: 75,
      canResume: undefined,
    });
  });

  it('rejects an invalid heartbeat before writing any normalized row', async () => {
    await expect(shapeMutationAPIImpl.updateBuildSession(nodeId, {
      lastHeartbeatAt: Number.NaN,
      status: 'paused',
    } as never)).rejects.toThrow('lastHeartbeatAt must be a finite non-negative number');

    expect(await ephemeralDB.buildSessionHeartbeats.get(nodeId)).toBeUndefined();
    expect(await ephemeralDB.buildSessionStatuses.get(nodeId)).toEqual({
      nodeId,
      status: 'running',
    });
  });

  it('does not create an orphan heartbeat when the session config is missing', async () => {
    await ephemeralDB.buildSessionConfigs.delete(nodeId);

    await expect(shapeMutationAPIImpl.updateBuildSession(nodeId, {
      lastHeartbeatAt: 1_200,
    } as never)).rejects.toThrow('build session config is missing');

    expect(await ephemeralDB.buildSessionHeartbeats.get(nodeId)).toBeUndefined();
  });
});
