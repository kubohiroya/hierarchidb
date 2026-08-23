import type {
  BuildSessionRuntimeRecord,
  CanonicalBuildRuntimeAdapter,
} from '@hierarchidb/build-api';
import { CanonicalBuildRuntimeError } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import {
  CanonicalBuildRuntimeAdapterRegistry,
  CanonicalBuildRuntimeRevisionTracker,
  createBuildSessionRuntimeRecord,
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
