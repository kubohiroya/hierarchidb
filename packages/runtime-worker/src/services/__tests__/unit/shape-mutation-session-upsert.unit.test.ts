import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShapeMutationService } from '../../ShapeMutationService';

const openMock = vi.hoisted(() => vi.fn(async () => undefined));
const heartbeatPutMock = vi.hoisted(() => vi.fn(async () => undefined));
const statusGetMock = vi.hoisted(() => vi.fn(async () => undefined));
const statusPutMock = vi.hoisted(() => vi.fn(async () => undefined));
const stageGetMock = vi.hoisted(() => vi.fn(async () => undefined));
const stagePutMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@hierarchidb/gis-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hierarchidb/gis-sdk')>();
  return {
    ...actual,
    ephemeralDB: {
      ...actual.ephemeralDB,
      open: openMock,
      buildSessionHeartbeats: {
        ...actual.ephemeralDB.buildSessionHeartbeats,
        put: heartbeatPutMock,
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-04T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('upserts session status row when status row is missing', async () => {
    const service = new ShapeMutationService({ open: openMock } as never);
    statusGetMock.mockResolvedValue(undefined);

    await service.updateBuildSession(asNodeId('shape-1'), {
      status: 'paused',
      stopReason: 'user-pause',
    } as never);

    expect(statusPutMock).toHaveBeenCalledWith({
      nodeId: asNodeId('shape-1'),
      status: 'paused',
      stopReason: 'user-pause',
      completedAt: undefined,
    });
  });

  it('upserts stage row when stage row is missing', async () => {
    const service = new ShapeMutationService({ open: openMock } as never);
    stageGetMock.mockResolvedValue(undefined);

    await service.updateBuildSession(asNodeId('shape-1'), {
      stages: {
        geometry: { status: 'running' },
      },
      stageId: 'geometry:run',
    } as never);

    expect(stagePutMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'shape-1:geometry',
      nodeId: asNodeId('shape-1'),
      stage: 'geometry',
      status: 'running',
      stageId: 'geometry:run',
    }));
  });
});
