import { describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import type {
  NodeId,
  NodeType,
  ObserveNodePayload,
  TreeChangeEvent,
  TreeNode,
  TreeNodeEvent,
  Timestamp,
} from '@hierarchidb/common-types';
import type { CommandEnvelope } from '../command-types.js';
import { TreeSubscriptionService } from '../TreeSubscriptionService.js';
import type { CoreDB } from '../CoreDB.js';

function createCoreStub(initialNodes: TreeNode[] = []): CoreDB & { __store: Map<NodeId, TreeNode> } {
  const changeSubject = new Subject<TreeChangeEvent>();
  const store = new Map<NodeId, TreeNode>(initialNodes.map((node) => [node.id, node]));

  const core = {
    changeSubject,
    listChildren: vi.fn(async (parentId: NodeId) =>
      Array.from(store.values()).filter((node) => node.parentId === parentId),
    ),
    getNode: vi.fn(async (id: NodeId) => store.get(id)),
    nodes: {
      get: vi.fn(async (id: NodeId) => store.get(id)),
    } as unknown,
  } as Partial<CoreDB> & { changeSubject: Subject<TreeChangeEvent> };

  return Object.assign(core, { __store: store }) as unknown as CoreDB & {
    __store: Map<NodeId, TreeNode>;
  };
}

describe('TreeSubscriptionService subscribe wrappers', () => {
  it('handles function observer subscribe/unsubscribe flow', async () => {
    const core = createCoreStub();
    const service = new TreeSubscriptionService(core);
    const nodeId = 'node-1' as NodeId;

    const cmd = {
      commandId: 'cmd-1',
      groupId: 'grp-1',
      kind: 'subscribeNode',
      payload: { nodeId, includeInitialValue: false } as ObserveNodePayload,
      issuedAt: Date.now() as Timestamp,
    } satisfies CommandEnvelope<'subscribeNode', ObserveNodePayload>;

    const observable = service.subscribeNodeCommand(cmd);
    const next = vi.fn();
    const subscription = observable.subscribe(next);

    expect(await service.getActiveSubscriptions()).toBe(1);

    const event: TreeChangeEvent = {
      type: 'node-updated',
      nodeId,
      timestamp: Date.now() as Timestamp,
    };

    core.changeSubject.next(event);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ nodeId }));

    subscription.unsubscribe();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await service.getActiveSubscriptions()).toBe(0);

    core.changeSubject.next(event);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('supports observer object argument for subscribe', async () => {
    const core = createCoreStub();
    const service = new TreeSubscriptionService(core);
    const nodeId = 'node-2' as NodeId;

    const cmd = {
      commandId: 'cmd-2',
      groupId: 'grp-2',
      kind: 'subscribeNode',
      payload: { nodeId, includeInitialValue: false } as ObserveNodePayload,
      issuedAt: Date.now() as Timestamp,
    } satisfies CommandEnvelope<'subscribeNode', ObserveNodePayload>;

    const observable = service.subscribeNodeCommand(cmd);
    const observer = { next: vi.fn(), error: vi.fn(), complete: vi.fn() };
    const subscription = observable.subscribe(observer);

    const event: TreeChangeEvent = {
      type: 'node-updated',
      nodeId,
      timestamp: Date.now() as Timestamp,
    };

    core.changeSubject.next(event);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(observer.next).toHaveBeenCalledWith(expect.objectContaining({ nodeId }));

    subscription.unsubscribe();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(observer.next).toHaveBeenCalledTimes(1);
    expect(await service.getActiveSubscriptions()).toBe(0);
  });

  it('routes subtree events using node and previousNode metadata', async () => {
    const rootId = 'root-1' as NodeId;
    const childId = 'child-1' as NodeId;
    const otherId = 'other-1' as NodeId;
    const now = Date.now() as Timestamp;

    const rootNode: TreeNode = {
      id: rootId,
      parentId: 'root-parent' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'Root',
      depth: 0,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const childNode: TreeNode = {
      id: childId,
      parentId: rootId,
      nodeType: 'folder' as NodeType,
      name: 'Child',
      depth: 1,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const otherNode: TreeNode = {
      id: otherId,
      parentId: 'other-parent' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'Other',
      depth: 0,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const core = createCoreStub([rootNode, childNode, otherNode]);
    const service = new TreeSubscriptionService(core);

    const received: TreeNodeEvent[] = [];
    await service.subscribeSubtree(rootId, (event) => {
      received.push(event);
    });

    // Update within subtree
    core.__store.set(childId, { ...childNode, name: 'Child Updated', updatedAt: (Date.now() + 1) as Timestamp });
    core.changeSubject.next({
      type: 'node-updated',
      nodeId: childId,
      node: core.__store.get(childId),
      previousNode: childNode,
      parentId: rootId,
      previousParentId: rootId,
      timestamp: (Date.now() + 2) as Timestamp,
    });

    // Update outside subtree should be ignored
    core.changeSubject.next({
      type: 'node-updated',
      nodeId: otherId,
      node: otherNode,
      parentId: otherNode.parentId,
      timestamp: (Date.now() + 3) as Timestamp,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(received.some((event) => event.nodeId === childId && event.type === 'updated')).toBe(true);
    expect(received.some((event) => event.nodeId === otherId)).toBe(false);

    // Deletion uses previousNode metadata
    core.__store.delete(childId);
    core.changeSubject.next({
      type: 'node-deleted',
      nodeId: childId,
      previousNode: childNode,
      previousParentId: rootId,
      timestamp: (Date.now() + 4) as Timestamp,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(received.some((event) => event.nodeId === childId && event.type === 'deleted')).toBe(true);
  });
});
