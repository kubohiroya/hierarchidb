import 'fake-indexeddb/auto';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { beforeEach, describe, expect, it } from 'vitest';
import { CommandProcessor } from '../../services/CommandProcessor';
import { CoreDB } from '../../services/CoreDB';

const encodeDraftHolderName = (parentId: NodeId, nodeId: NodeId) => `${parentId}::${nodeId}`;

describe('Headless E2E: Policy C with fake-indexeddb + CoreDB', () => {
  beforeEach(async () => {
    CoreDB.resetInstance();
    // Ensure fake-indexeddb storage is cleared between tests
    const request = indexedDB.deleteDatabase('core');
    if (request?.onsuccess !== undefined) {
      await new Promise<void>((resolve) => {
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      });
    }
  });

  async function newCore(name: string): Promise<CoreDB> {
    return await CoreDB.getSingleton(`pc-${name}-${Date.now()}-${Math.random()}`);
  }

  const withPayload = (
    node: Omit<TreeNode, 'data' | 'draftData' | 'metadata' | 'draftMetadata' | 'visible'> &
      Partial<TreeNode> & {
        name?: string;
      }
  ): TreeNode => ({
    data: {},
    draftData: undefined,
    metadata: { name: node.name ?? 'Untitled', description: undefined, tags: [] },
    draftMetadata: null,
    visible: node.visible ?? true,
    ...node,
  });

  it('blocks move/remove when WC holder exists under subtree', async () => {
    const core = await newCore('on');
    const cp = new CommandProcessor(core);

    // Create a parent and a node 'a' under r:root
    const aId = `a-${Date.now()}` as NodeId;
    const aNode: TreeNode = {
      id: aId,
      parentId: 'r:root' as NodeId,
      nodeType: 'folder' as NodeType,
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      metadata: { name: 'A', description: undefined, tags: [] },
      draftMetadata: null,
      data: {},
      draftData: undefined,
      visible: true,
    };
    await core.createNode(aNode);

    // Create a WC holder under r:draft referring to node A
    const holderId = `wcH-${Date.now()}` as NodeId;
    const holderName = encodeDraftHolderName('r:root' as NodeId, aId);
    await core.createNode({
      id: holderId,
      parentId: 'r:draft' as NodeId,
      nodeType: 'draft' as NodeType,
      metadata: { name: holderName, description: undefined, tags: [] },
      draftMetadata: null,
      depth: 0,
      visible: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      data: {},
      draftData: undefined,
    });
    // Create WC child under holder
    await core.createNode({
      id: `wcC-${Date.now()}` as NodeId,
      parentId: holderId,
      nodeType: 'folder' as NodeType,
      metadata: { name: 'Draft', description: undefined, tags: [] },
      draftMetadata: null,
      depth: 1,
      visible: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      data: {},
      draftData: undefined,
    });

    // Try move A to a new parent -> should be blocked
    const p2 = await core.createNode(
      withPayload({
        id: `p2-${Date.now()}` as NodeId,
        parentId: 'r:root' as NodeId,
        nodeType: 'folder' as NodeType,
        name: 'P2',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      })
    );

    const move = await cp.processCommand(
      cp.createEnvelope('moveNodes', { nodeIds: [aId], toParentId: p2 as NodeId })
    );
    expect(move.success).toBe(false);

    // Try remove A -> should be blocked
    const rem = await cp.processCommand(cp.createEnvelope('remove', { nodeIds: [aId] }));
    expect(rem.success).toBe(false);
  });

  it('WC in another console does not block current console operations', async () => {
    const core = await newCore('multitree');
    const cp = new CommandProcessor(core);

    // create node in Projects console (p)
    const px = `px-${Date.now()}` as NodeId;
    await core.createNode(
      withPayload({
        id: px,
        parentId: 'p:root' as NodeId,
        nodeType: 'folder' as NodeType,
        name: 'PX',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      })
    );

    // create WC holder that references a node in Resources console (r)
    const aId = `Ar-${Date.now()}` as NodeId;
    await core.createNode(
      withPayload({
        id: aId,
        parentId: 'r:root' as NodeId,
        nodeType: 'folder' as NodeType,
        name: 'Ar',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      })
    );
    const holderId = `wcH3-${Date.now()}` as NodeId;
    const holderName = encodeDraftHolderName('r:root' as NodeId, aId);
    await core.createNode(
      withPayload({
        id: holderId,
        parentId: 'r:draft' as NodeId,
        nodeType: 'draft' as NodeType,
        name: holderName,
        depth: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      })
    );
    await core.createNode(
      withPayload({
        id: `wcC3-${Date.now()}` as NodeId,
        parentId: holderId,
        nodeType: 'folder' as NodeType,
        name: 'Draft3',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      })
    );

    // Move PX within Projects should be allowed
    const p2 = await core.createNode(
      withPayload({
        id: `p2-${Date.now()}` as NodeId,
        parentId: 'p:root' as NodeId,
        nodeType: 'folder' as NodeType,
        name: 'P2',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      })
    );
    const ok = await cp.processCommand(
      cp.createEnvelope('moveNodes', { nodeIds: [px], toParentId: p2 as NodeId })
    );
    expect(ok.success).toBe(true);
  });
});
