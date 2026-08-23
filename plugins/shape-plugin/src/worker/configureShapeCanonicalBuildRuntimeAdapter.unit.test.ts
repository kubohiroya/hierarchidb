import type { NodeId } from '@hierarchidb/core-types';
import type {
  ShapeBuildSessionRecord,
  ShapeMutationAPI,
  ShapeQueryAPI,
} from '@hierarchidb/shape-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canonicalBuildRuntimeAdapter,
  clearShapeBuildRuntimeTransientStatus,
  configureShapeCanonicalBuildRuntimeAdapter,
  setShapeBuildRuntimeInputSource,
  setShapeBuildRuntimeTransientStatus,
} from './configureShapeCanonicalBuildRuntimeAdapter.js';

const nodeId = 'shape-runtime-adapter-node' as NodeId;

const createSession = (
  overrides: Partial<ShapeBuildSessionRecord> = {}
): ShapeBuildSessionRecord => ({
  nodeId,
  status: 'completed',
  startedAt: 100,
  updatedAt: 200,
  completedAt: 300,
  progress: {
    total: 1,
    completed: 1,
    failed: 0,
    skipped: 0,
    percentage: 100,
  },
  stages: {},
  ...overrides,
});

describe('shape canonical build runtime adapter', () => {
  const getBuildSessionRecord = vi.fn();
  const listBuildSessionRecordsByStatus = vi.fn();
  const deleteBuildSession = vi.fn();

  beforeEach(() => {
    getBuildSessionRecord.mockReset();
    listBuildSessionRecordsByStatus.mockReset();
    deleteBuildSession.mockReset();
    configureShapeCanonicalBuildRuntimeAdapter({
      queryAPI: {
        getBuildSessionRecord,
        listBuildSessionRecordsByStatus,
      } as unknown as ShapeQueryAPI,
      mutationAPI: {
        deleteBuildSession,
      } as unknown as ShapeMutationAPI,
    });
    clearShapeBuildRuntimeTransientStatus(nodeId);
  });

  it('projects persisted shape sessions to canonical runtime records', async () => {
    getBuildSessionRecord.mockResolvedValue(createSession());

    await expect(canonicalBuildRuntimeAdapter.getSession(nodeId)).resolves.toMatchObject({
      nodeType: 'shape',
      nodeId,
      status: 'completed',
      isActive: false,
      revision: expect.any(Number),
      progress: { percentage: 100 },
    });
  });

  it('applies transient runtime status and input source', async () => {
    getBuildSessionRecord.mockResolvedValue(null);
    setShapeBuildRuntimeInputSource(nodeId, 'working-copy');
    setShapeBuildRuntimeTransientStatus(nodeId, 'starting');

    await expect(canonicalBuildRuntimeAdapter.getSession(nodeId)).resolves.toMatchObject({
      nodeType: 'shape',
      nodeId,
      status: 'starting',
      isActive: true,
      inputSource: 'working-copy',
    });
  });

  it('rejects running session deletion and deletes inactive sessions through mutation API', async () => {
    getBuildSessionRecord.mockResolvedValueOnce(createSession({ status: 'running' }));

    await expect(canonicalBuildRuntimeAdapter.deleteSession(nodeId)).rejects.toThrow(
      'Cannot delete a running build session.'
    );
    expect(deleteBuildSession).not.toHaveBeenCalled();

    getBuildSessionRecord.mockResolvedValueOnce(createSession({ status: 'paused' }));
    deleteBuildSession.mockResolvedValue(undefined);

    await expect(canonicalBuildRuntimeAdapter.deleteSession(nodeId)).resolves.toBeUndefined();
    expect(deleteBuildSession).toHaveBeenCalledWith(nodeId);
  });

  it('lists sessions with runtime filters', async () => {
    listBuildSessionRecordsByStatus.mockResolvedValue([
      createSession({ nodeId: 'shape-a' as NodeId, status: 'paused', updatedAt: 2 }),
      createSession({ nodeId: 'shape-b' as NodeId, status: 'running', updatedAt: 3 }),
    ]);

    await expect(canonicalBuildRuntimeAdapter.listSessions({ activeOnly: true })).resolves.toEqual([
      expect.objectContaining({ nodeId: 'shape-b', status: 'running', isActive: true }),
    ]);
  });
});
