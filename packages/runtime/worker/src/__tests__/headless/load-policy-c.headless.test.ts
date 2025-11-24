import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it } from 'vitest';
import { CommandProcessor } from '../../services/CommandProcessor.js';
import { CoreDB } from '../../services/CoreDB.js';
const encodeDraftHolderName = (parentId: NodeId, nodeId: NodeId) =>
  `${parentId}::${nodeId}`;

describe('Headless: Policy C load (moderate subtree)', () => {
  beforeEach(async () => {
    CoreDB.resetInstance();
    const request = indexedDB.deleteDatabase('core-db');
    if (request?.onsuccess !== undefined) {
      await new Promise<void>((resolve) => {
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      });
    }
  });

  async function newCore(name: string): Promise<CoreDB> {
    return await CoreDB.getSingleton(`pc-load-${name}-${Date.now()}-${Math.random()}`);
  }

  const withPayload = (
    node: Omit<TreeNode, 'data' | 'draftData' | 'metadata' | 'draftMetadata'> &
      Partial<TreeNode> & { name?: string }
  ): TreeNode => ({
    data: {},
    draftData: null,
    metadata: { name: node.name ?? 'Untitled', description: undefined, tags: [] },
    draftMetadata: null,
    ...node,
  });

  it('blocks move on subtree with 200 descendants when WC exists (under threshold time)', async () => {
    const core = await newCore('200');
    const cp = new CommandProcessor(core);

    // Build a moderate console: root -> A -> 200 children B_i
    const aId = `A-${Date.now()}` as NodeId;
    await core.createNode(
      withPayload({
        id: aId,
        parentId: 'r:root' as NodeId,
        nodeType: 'folder' as NodeType,
        name: 'A',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      })
    );

    const toCreate: TreeNode[] = [];
    for (let i = 0; i < 200; i++) {
      toCreate.push(
        withPayload({
          id: `B-${i}-${Date.now()}` as NodeId,
          parentId: aId,
          nodeType: 'folder' as NodeType,
          name: `B-${i}`,
          depth: 2,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        })
      );
    }
    await core.bulkCreateNodes(toCreate);

    const targetChild = toCreate[199];
    // Create WC holder for the deepest child
    const holderId = `wcH-load-${Date.now()}` as NodeId;
    const holderName = encodeDraftHolderName(aId, targetChild.id);
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
        id: `wcC-load-${Date.now()}` as NodeId,
        parentId: holderId,
        nodeType: 'folder' as NodeType,
        name: 'Draft-load',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      })
    );

    // Create new parent
    const p2 = await core.createNode(
      withPayload({
        id: `P-load-${Date.now()}` as NodeId,
        parentId: 'r:root' as NodeId,
        nodeType: 'folder' as NodeType,
        name: 'P-load',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      })
    );

    // Measure
    const start = performance.now();
    const res = await cp.processCommand(
      cp.createEnvelope('moveNodes', { nodeIds: [aId], toParentId: p2 as NodeId })
    );
    const dur = performance.now() - start;
    expect(res.success).toBe(false);
    // Heuristic threshold for this environment; adjust if needed
    expect(dur).toBeLessThan(300);
  });
});
