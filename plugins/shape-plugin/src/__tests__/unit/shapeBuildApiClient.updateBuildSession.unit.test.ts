import type { NodeId } from '@hierarchidb/core-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const statusGetMock = vi.hoisted(() => vi.fn(async () => undefined));
const statusPutMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@hierarchidb/gis-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hierarchidb/gis-sdk')>();
  return {
    ...actual,
    ephemeralDB: {
      ...actual.ephemeralDB,
      buildSessionStatuses: {
        ...actual.ephemeralDB.buildSessionStatuses,
        get: statusGetMock,
        put: statusPutMock,
      },
    },
  };
});

const asNodeId = (value: string): NodeId => value as NodeId;

describe('ShapeBuildAPIClient.updateBuildSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts status row when status row is missing', async () => {
    const { shapeMutationAPIImpl } = await import('../../services/build/ShapeBuildAPIClient');

    await shapeMutationAPIImpl.updateBuildSession(asNodeId('shape-1'), {
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
});
