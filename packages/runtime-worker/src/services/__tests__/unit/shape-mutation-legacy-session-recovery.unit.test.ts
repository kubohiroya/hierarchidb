import type { NodeId } from '@hierarchidb/core-types';
import { RESET_LEGACY_BUILD_SESSION_AND_TASKS } from '@hierarchidb/shape-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  open: vi.fn(async () => undefined),
  recoverLegacyBuildSession: vi.fn(),
  publishBuildSessionUpdate: vi.fn(),
}));

vi.mock('@hierarchidb/gis-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hierarchidb/gis-sdk')>();
  return {
    ...actual,
    ephemeralDB: {
      ...actual.ephemeralDB,
      open: mocks.open,
      recoverLegacyBuildSession: mocks.recoverLegacyBuildSession,
    },
  };
});

vi.mock('../../buildSessionBroadcastUtils.js', () => ({
  publishBuildSessionUpdate: mocks.publishBuildSessionUpdate,
}));

import { ShapeMutationService } from '../../ShapeMutationService';

describe('ShapeMutationService.recoverLegacyBuildSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recoverLegacyBuildSession.mockResolvedValue({
      nodeId: 'node-1',
      deletedRowCounts: {
        buildSessionConfigs: 1,
        buildSessionHeartbeats: 1,
        buildSessionStatuses: 1,
        buildStageStatuses: 1,
        buildTasks: 1,
      },
    });
  });

  it('delegates the exact confirmed request and publishes deletion only after success', async () => {
    const nodeId = 'node-1' as NodeId;
    const request = {
      nodeId,
      confirmation: RESET_LEGACY_BUILD_SESSION_AND_TASKS,
      error: {
        code: 'LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING' as const,
        recoverable: true as const,
        nodeId,
        table: 'buildStageStatuses' as const,
        field: 'inactiveMs' as const,
        fieldPath: 'buildStageStatuses.inactiveMs' as const,
        stageStatusId: 'node-1:source',
        stage: 'source' as const,
        received: 'undefined' as const,
        message: 'inactiveMs is missing',
      },
    };
    const service = new ShapeMutationService({ open: mocks.open } as never);

    await expect(service.recoverLegacyBuildSession(request)).resolves.toEqual(
      expect.objectContaining({ nodeId })
    );

    expect(mocks.recoverLegacyBuildSession).toHaveBeenCalledWith(request);
    expect(mocks.publishBuildSessionUpdate).toHaveBeenCalledWith({
      nodeId,
      status: 'deleted',
    });
  });

  it('does not publish deletion when the transactional recovery rejects', async () => {
    mocks.recoverLegacyBuildSession.mockRejectedValue(new Error('confirmation changed'));
    const nodeId = 'node-1' as NodeId;
    const service = new ShapeMutationService({ open: mocks.open } as never);

    await expect(
      service.recoverLegacyBuildSession({
        nodeId,
        confirmation: RESET_LEGACY_BUILD_SESSION_AND_TASKS,
        error: {
          code: 'LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING',
          recoverable: true,
          nodeId,
          table: 'buildStageStatuses',
          field: 'inactiveMs',
          fieldPath: 'buildStageStatuses.inactiveMs',
          stageStatusId: 'node-1:source',
          stage: 'source',
          received: 'undefined',
          message: 'inactiveMs is missing',
        },
      })
    ).rejects.toThrow('confirmation changed');

    expect(mocks.publishBuildSessionUpdate).not.toHaveBeenCalled();
  });
});
