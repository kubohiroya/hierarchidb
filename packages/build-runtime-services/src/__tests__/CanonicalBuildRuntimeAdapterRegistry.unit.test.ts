import type {
  BuildSessionRuntimeRecord,
  CanonicalBuildRuntimeAdapter,
} from '@hierarchidb/build-api';
import { CanonicalBuildRuntimeError } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import {
  AbstractBuildSession,
  CanonicalBuildRuntimeAdapterRegistry,
  CanonicalBuildRuntimeRevisionTracker,
  CanonicalBuildSessionManager,
  createBuildSessionRuntimeRecord,
  createCanonicalBuildRuntimeAdapter,
  resolveRuntimeStatusFromBuildSessionStatus,
} from '../index.js';

const shapeNodeType = 'shape' as NodeType;
const nodeId = 'node-1' as NodeId;

const createAdapter = (
  override: Partial<CanonicalBuildRuntimeAdapter> = {}
): CanonicalBuildRuntimeAdapter => ({
  nodeType: shapeNodeType,
  getSession: vi.fn(async () =>
    createBuildSessionRuntimeRecord({
      nodeType: shapeNodeType,
      nodeId,
      status: 'running',
      revision: 1,
    })
  ),
  listSessions: vi.fn(async () => [
    createBuildSessionRuntimeRecord({
      nodeType: shapeNodeType,
      nodeId,
      status: 'completed',
      revision: 2,
    }),
  ]),
  subscribeSessions: vi.fn(() => () => undefined),
  deleteSession: vi.fn(async () => undefined),
  ...override,
});

class TestCanonicalSession extends AbstractBuildSession {
  getCanonicalStageSnapshot(): null {
    return null;
  }

  takeCanonicalTaskProgressUpdates(): [] {
    return [];
  }

  protected async processBatch(): Promise<void> {}
}

class TestCanonicalBuildSessionManager extends CanonicalBuildSessionManager {
  readonly deletedRuntimeSessions: NodeId[] = [];
  cleanupError: Error | null = null;

  async startBuildSession(_nodeId: NodeId): Promise<never> {
    throw new Error('Not implemented for this unit test');
  }

  register(session: TestCanonicalSession): void {
    this.registerSession(session);
  }

  protected override async cleanupDeletedBuildSessionRuntime(nodeId: NodeId): Promise<void> {
    this.deletedRuntimeSessions.push(nodeId);
    if (this.cleanupError) throw this.cleanupError;
  }
}

describe('CanonicalBuildRuntimeAdapterRegistry', () => {
  it('registers and requires adapters by node type', () => {
    const adapter = createAdapter();
    const registry = new CanonicalBuildRuntimeAdapterRegistry([adapter]);

    expect(registry.require(shapeNodeType)).toBe(adapter);
    expect(registry.listNodeTypes()).toEqual([shapeNodeType]);
  });

  it('rejects duplicate node type registrations', () => {
    const registry = new CanonicalBuildRuntimeAdapterRegistry([createAdapter()]);

    expect(() => registry.register(createAdapter())).toThrow(CanonicalBuildRuntimeError);
  });

  it('throws typed errors for unregistered node types', () => {
    const registry = new CanonicalBuildRuntimeAdapterRegistry();

    expect(() => registry.require(shapeNodeType)).toThrow(CanonicalBuildRuntimeError);
  });

  it('validates runtime records returned by adapters', async () => {
    const invalidRecord: BuildSessionRuntimeRecord = {
      nodeType: 'location' as NodeType,
      nodeId,
      status: 'running',
      isActive: true,
      revision: 1,
    };
    const registry = new CanonicalBuildRuntimeAdapterRegistry([
      createAdapter({
        getSession: vi.fn(async () => invalidRecord),
      }),
    ]);

    await expect(registry.getSession(shapeNodeType, nodeId)).rejects.toThrow(
      CanonicalBuildRuntimeError
    );
  });

  it('dispatches delete to the registered adapter', async () => {
    const deleteSession = vi.fn(async () => undefined);
    const registry = new CanonicalBuildRuntimeAdapterRegistry([createAdapter({ deleteSession })]);

    await registry.deleteSession(shapeNodeType, nodeId);

    expect(deleteSession).toHaveBeenCalledWith(nodeId);
  });
});

describe('CanonicalBuildRuntimeRevisionTracker', () => {
  it('increments revisions per node type and node id', () => {
    const tracker = new CanonicalBuildRuntimeRevisionTracker();

    expect(tracker.next(shapeNodeType, nodeId)).toBe(1);
    expect(tracker.next(shapeNodeType, nodeId)).toBe(2);
    expect(tracker.current(shapeNodeType, nodeId)).toBe(2);
  });

  it('rejects backwards revisions', () => {
    const tracker = new CanonicalBuildRuntimeRevisionTracker();
    tracker.accept(shapeNodeType, nodeId, 3);

    expect(() => tracker.accept(shapeNodeType, nodeId, 2)).toThrow(CanonicalBuildRuntimeError);
  });
});

describe('createBuildSessionRuntimeRecord', () => {
  it('rejects invalid revisions when projecting runtime records', () => {
    expect(() =>
      createBuildSessionRuntimeRecord({
        nodeType: shapeNodeType,
        nodeId,
        status: 'running',
        revision: -1,
      })
    ).toThrow(CanonicalBuildRuntimeError);
  });
});

describe('createCanonicalBuildRuntimeAdapter', () => {
  it('projects manager statuses to runtime records with stable revisions', async () => {
    let status: BuildSessionRuntimeRecord['status'] | 'queued' = 'queued';
    const listeners = new Set<() => void>();
    const adapter = createCanonicalBuildRuntimeAdapter({
      nodeType: shapeNodeType,
      inventory: {
        getBuildSessionRuntimeStatus: vi.fn(async () => ({
          nodeId,
          status,
          progress: { total: 1, completed: 0, failed: 0, skipped: 0, percentage: 0 },
        })),
        listBuildSessionRuntimeStatuses: vi.fn(async () => [
          {
            nodeId,
            status,
            progress: { total: 1, completed: 0, failed: 0, skipped: 0, percentage: 0 },
          },
        ]),
        deleteBuildSessionRuntime: vi.fn(async () => undefined),
        subscribeBuildSessionRuntimeChanges: vi.fn((listener) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        }),
      },
    });

    await expect(adapter.getSession(nodeId)).resolves.toMatchObject({
      nodeType: shapeNodeType,
      nodeId,
      status: 'starting',
      isActive: true,
      revision: 1,
    });
    await expect(adapter.getSession(nodeId)).resolves.toMatchObject({ revision: 1 });

    status = 'completed';
    await expect(adapter.getSession(nodeId)).resolves.toMatchObject({
      status: 'completed',
      isActive: false,
      revision: 2,
    });
  });

  it('subscribes to inventory changes and applies runtime filters', async () => {
    let status: BuildSessionRuntimeRecord['status'] | 'queued' = 'paused';
    const listeners = new Set<() => void>();
    const callback = vi.fn();
    const adapter = createCanonicalBuildRuntimeAdapter({
      nodeType: shapeNodeType,
      inventory: {
        getBuildSessionRuntimeStatus: vi.fn(async () => null),
        listBuildSessionRuntimeStatuses: vi.fn(async () => [
          {
            nodeId,
            status,
            progress: { total: 1, completed: 0, failed: 0, skipped: 0, percentage: 0 },
          },
        ]),
        deleteBuildSessionRuntime: vi.fn(async () => undefined),
        subscribeBuildSessionRuntimeChanges: vi.fn((listener) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        }),
      },
    });

    const unsubscribe = await adapter.subscribeSessions({ activeOnly: true }, callback);
    await Promise.resolve();
    await Promise.resolve();
    expect(callback).toHaveBeenLastCalledWith([]);

    status = 'running';
    for (const listener of listeners) listener();

    await Promise.resolve();
    await Promise.resolve();
    expect(callback).toHaveBeenLastCalledWith([
      expect.objectContaining({ status: 'running', isActive: true }),
    ]);

    unsubscribe();
    expect(listeners.size).toBe(0);
  });

  it('throws a typed runtime error for recycled manager status', () => {
    expect(() => resolveRuntimeStatusFromBuildSessionStatus('recycled')).toThrow(
      CanonicalBuildRuntimeError
    );
  });
});

describe('CanonicalBuildSessionManager runtime inventory', () => {
  it('runs plugin cleanup before deleting an inactive runtime session', async () => {
    const manager = new TestCanonicalBuildSessionManager();
    manager.register(new TestCanonicalSession(nodeId, {}));

    const cleanupError = new Error('cleanup failed');
    manager.cleanupError = cleanupError;
    await expect(manager.deleteBuildSessionRuntime(nodeId)).rejects.toBe(cleanupError);
    await expect(manager.getBuildSessionRuntimeStatus(nodeId)).resolves.toMatchObject({ nodeId });

    manager.cleanupError = null;
    await expect(manager.deleteBuildSessionRuntime(nodeId)).resolves.toBeUndefined();

    expect(manager.deletedRuntimeSessions).toEqual([nodeId, nodeId]);
    await expect(manager.getBuildSessionRuntimeStatus(nodeId)).resolves.toBeNull();
  });
});
