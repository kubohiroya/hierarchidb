import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShapeMutationService } from '../../ShapeMutationService';

const openMock = vi.hoisted(() => vi.fn(async () => undefined));
const heartbeatPutMock = vi.hoisted(() => vi.fn(async () => undefined));
const configGetMock = vi.hoisted(() =>
  vi.fn(async () => ({
    nodeId: 'shape-1',
    startedAt: 1_000,
  }))
);
const statusGetMock = vi.hoisted(() => vi.fn(async () => undefined));
const statusPutMock = vi.hoisted(() => vi.fn(async () => undefined));
const stageGetMock = vi.hoisted(() => vi.fn(async () => undefined));
const stagePutMock = vi.hoisted(() => vi.fn(async () => undefined));
const transactionMock = vi.hoisted(() =>
  vi.fn(async (_mode: string, _tables: unknown[], callback: () => Promise<unknown>) => callback())
);

vi.mock('@hierarchidb/gis-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hierarchidb/gis-sdk')>();
  return {
    ...actual,
    ephemeralDB: {
      ...actual.ephemeralDB,
      open: openMock,
      transaction: transactionMock,
      buildSessionHeartbeats: {
        ...actual.ephemeralDB.buildSessionHeartbeats,
        put: heartbeatPutMock,
      },
      buildSessionConfigs: {
        ...actual.ephemeralDB.buildSessionConfigs,
        get: configGetMock,
      },
      buildSessionStatuses: {
        ...actual.ephemeralDB.buildSessionStatuses,
        get: statusGetMock,
        put: statusPutMock,
      },
      buildStageStatuses: {
        ...actual.ephemeralDB.buildStageStatuses,
        get: stageGetMock,
        put: stagePutMock,
      },
    },
  };
});

const asNodeId = (value: string): NodeId => value as NodeId;

describe('ShapeMutationService.updateBuildSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configGetMock.mockResolvedValue({
      nodeId: asNodeId('shape-1'),
      startedAt: 1_000,
    });
    statusGetMock.mockResolvedValue({
      nodeId: asNodeId('shape-1'),
      status: 'running',
    });
    stageGetMock.mockResolvedValue(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-04T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects a partial normalized session when the status row is missing', async () => {
    const service = new ShapeMutationService({ open: openMock } as never);
    statusGetMock.mockResolvedValue(undefined);

    await expect(
      service.updateBuildSession(asNodeId('shape-1'), {
        status: 'paused',
        stopReason: 'user-pause',
      } as never)
    ).rejects.toThrow('build session status is missing');

    expect(statusPutMock).not.toHaveBeenCalled();
  });

  it('upserts stage row when stage row is missing', async () => {
    const service = new ShapeMutationService({ open: openMock } as never);
    stageGetMock.mockResolvedValue(undefined);

    await service.updateBuildSession(asNodeId('shape-1'), {
      stages: {
        geometry: { status: 'running' },
      },
      stageId: 'geometry:run',
      stageStartedAt: 1_100,
      stageInactiveMs: 25,
    } as never);

    expect(stagePutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'shape-1:geometry',
        nodeId: asNodeId('shape-1'),
        stage: 'geometry',
        status: 'running',
        startedAt: 1_100,
        inactiveMs: 25,
        stageId: 'geometry:run',
      })
    );
  });

  it('rejects a new stage row when persisted timing is missing', async () => {
    const service = new ShapeMutationService({ open: openMock } as never);
    stageGetMock.mockResolvedValue(undefined);

    await expect(
      service.updateBuildSession(asNodeId('shape-1'), {
        stages: {
          source: { status: 'running' },
        },
      } as never)
    ).rejects.toThrow('stageStartedAt must be a finite non-negative number');

    expect(stagePutMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid heartbeat before writing any normalized row', async () => {
    const service = new ShapeMutationService({ open: openMock } as never);

    await expect(
      service.updateBuildSession(asNodeId('shape-1'), {
        lastHeartbeatAt: -1,
        status: 'paused',
      } as never)
    ).rejects.toThrow('lastHeartbeatAt must be a finite non-negative number');

    expect(heartbeatPutMock).not.toHaveBeenCalled();
    expect(statusPutMock).not.toHaveBeenCalled();
  });

  it('does not create an orphan heartbeat when the session config is missing', async () => {
    const service = new ShapeMutationService({ open: openMock } as never);
    configGetMock.mockResolvedValue(undefined);

    await expect(
      service.updateBuildSession(asNodeId('shape-1'), {
        lastHeartbeatAt: 1_200,
      } as never)
    ).rejects.toThrow('build session config is missing');

    expect(heartbeatPutMock).not.toHaveBeenCalled();
  });
});
