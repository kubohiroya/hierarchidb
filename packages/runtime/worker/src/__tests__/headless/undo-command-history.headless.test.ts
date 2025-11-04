import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/common-types';
import { describe, expect, it } from 'vitest';
import { CommandProcessor } from '../../services/CommandProcessor.js';
import { CoreDB } from '../../services/CoreDB.js';

describe('Headless E2E (Node + fake-indexeddb): Undo/Redo representative flow', () => {
  const rTree = 'r' as TreeId;

  async function newCore(name: string): Promise<CoreDB> {
    return await CoreDB.getSingleton(`e2e-undo-redo-${name}-${Date.now()}-${Math.random()}`);
  }

  it('create → rename → move → undo x2 → redo x2', async () => {
    const core = await newCore('flow');
    const cp = new CommandProcessor(core);

    // create parent P2
    const parentNode: TreeNode = {
      id: `p2-${Date.now()}` as NodeId,
      parentId: 'r:root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'P2',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    const p2 = await core.createNode(parentNode);

    // create A
    const createResult = await cp.processCommand(
      cp.createEnvelope('createNode', {
        nodeType: 'folder' as NodeType,
        treeId: rTree,
        parentId: 'r:root' as NodeId,
        name: 'A',
      })
    );
    expect(createResult.success).toBe(true);
    if (!createResult.success || !createResult.nodeId) {
      throw new Error('Expected createNode to succeed with nodeId');
    }
    const aId = createResult.nodeId;

    // rename A -> A1
    const u1 = await cp.processCommand(
      cp.createEnvelope('updateNode', { nodeId: aId, name: 'A1' })
    );
    expect(u1.success).toBe(true);

    // move A1 -> P2
    const m1 = await cp.processCommand(
      cp.createEnvelope('moveNodes', { nodeIds: [aId], toParentId: p2 })
    );
    expect(m1.success).toBe(true);

    // undo: move back
    const undo1 = await cp.processCommand(cp.createEnvelope('undo', { groupId: 'default-group' }));
    expect(undo1.success).toBe(true);
    // undo: rename back
    const undo2 = await cp.processCommand(cp.createEnvelope('undo', { groupId: 'default-group' }));
    expect(undo2.success).toBe(true);

    // redo: rename A -> A1
    const redo1 = await cp.processCommand(cp.createEnvelope('redo', { groupId: 'default-group' }));
    expect(redo1.success).toBe(true);
    // redo: move under P2
    const redo2 = await cp.processCommand(cp.createEnvelope('redo', { groupId: 'default-group' }));
    expect(redo2.success).toBe(true);

    // final assertions
    const qa = await core.getNode(aId);
    expect(qa?.name).toBe('A1');
    expect(qa?.parentId).toBe(p2);
  });
});
