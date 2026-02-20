import type { TreeQueryAPI } from '@hierarchidb/tree-api';
import type { NodeId, NodeType, Timestamp } from '@hierarchidb/core-types';
import type { ObserveNodePayload, TreeChangeEvent, TreeNode, TreeNodeEvent } from '@hierarchidb/tree-api';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../CoreDB';
import type { CommandEnvelope } from '../../command-types';
import { TreeSubscriptionService } from '../../TreeSubscriptionService';

function createCoreStub(
  initialNodes: TreeNode[] = []
): CoreDB & { __store: Map<NodeId, TreeNode> } {
  const changeSubject = new Subject<TreeChangeEvent>();
  const store = new Map<NodeId, TreeNode>(initialNodes.map((node) => [node.id, node]));

  const core = {
    changeSubject,
    listChildren: vi.fn(async (parentId: NodeId) =>
      Array.from(store.values()).filter((node) => node.parentId === parentId)
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

function createTreeQueryStub(core: CoreDB & { __store: Map<NodeId, TreeNode> }): TreeQueryAPI {
  const listAllNodes = () => Array.from(core.__store.values());

  const listDescendants = async (nodeId: NodeId): Promise<TreeNode[]> => {
    const out: TreeNode[] = [];
    const stack: NodeId[] = [nodeId];
    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;
      const children = listAllNodes().filter((node) => node.parentId === current);
      for (const child of children) {
        out.push(child);
        stack.push(child.id);
      }
    }
    return out;
  };

  return {
    getTree: vi.fn(async () => undefined),
    listTrees: vi.fn(async () => []),
    getNode: core.getNode as TreeQueryAPI['getNode'],
    listChildren: core.listChildren as TreeQueryAPI['listChildren'],
    listDescendants: vi.fn(listDescendants) as TreeQueryAPI['listDescendants'],
    listAncestors: vi.fn(async () => []),
    searchNodes: vi.fn(async () => listAllNodes()),
    searchNodesByType: vi.fn(async ({ nodeType }) =>
      listAllNodes().filter((node) => node.nodeType === nodeType)
    ),
    getNodePath: vi.fn(async (nodeId: NodeId) => {
      const node = await core.getNode(nodeId);
      return node ? [node] : [];
    }),
    queryNodes: vi.fn(async ({ predicate }) => listAllNodes().filter((node) => predicate(node))),
    searchNodesFulltext: vi.fn(async () => []),
  } as TreeQueryAPI;
}

describe('TreeSubscriptionService subscribe wrappers', () => {
  it('handles function observer subscribe/unsubscribe flow', async () => {
    const core = createCoreStub();
    const service = new TreeSubscriptionService(core, createTreeQueryStub(core));
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
    const service = new TreeSubscriptionService(core, createTreeQueryStub(core));
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
      metadata: { name: 'Root', description: '', tags: [] },
      draftMetadata: null,
      data: {},
      draftData: undefined,
      depth: 0,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const childNode: TreeNode = {
      id: childId,
      parentId: rootId,
      nodeType: 'folder' as NodeType,
      metadata: { name: 'Child', description: '', tags: [] },
      draftMetadata: null,
      data: {},
      draftData: undefined,
      depth: 1,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const otherNode: TreeNode = {
      id: otherId,
      parentId: 'other-parent' as NodeId,
      nodeType: 'folder' as NodeType,
      metadata: { name: 'Other', description: '', tags: [] },
      draftMetadata: null,
      data: {},
      draftData: undefined,
      depth: 0,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const core = createCoreStub([rootNode, childNode, otherNode]);
    const service = new TreeSubscriptionService(core, createTreeQueryStub(core));

    const received: TreeNodeEvent[] = [];
    await service.subscribeSubtree(rootId, (event) => {
      received.push(event);
    });

    // Update within subtree
    core.__store.set(childId, {
      ...childNode,
      metadata: { ...childNode.metadata, name: 'Child Updated' },
      updatedAt: (Date.now() + 1) as Timestamp,
    });
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

    expect(received.some((event) => event.nodeId === childId && event.type === 'updated')).toBe(
      true
    );
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

    expect(received.some((event) => event.nodeId === childId && event.type === 'deleted')).toBe(
      true
    );
  });
});
