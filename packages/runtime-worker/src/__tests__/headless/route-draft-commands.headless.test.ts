import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { beforeEach, describe, expect, it } from 'vitest';
import { CommandProcessor } from '../../services/CommandProcessor.js';
import { CoreDB } from '../../services/CoreDB.js';

describe('Headless E2E (Node + fake-indexeddb): CP routing + WC flows', () => {
  beforeEach(async () => {
    CoreDB.resetInstance();
    const request = indexedDB.deleteDatabase('core');
    if (request?.onsuccess !== undefined) {
      await new Promise<void>((resolve) => {
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      });
    }
  });

  async function newCore(name: string): Promise<CoreDB> {
    // Unique DB per test run
    return await CoreDB.getSingleton(`e2e-${name}-${Date.now()}-${Math.random()}`);
  }

  const withPayload = (
    node: Omit<TreeNode, 'data' | 'draftData' | 'metadata' | 'draftMetadata' | 'visible'> &
      Partial<TreeNode> & { name?: string }
  ): TreeNode => ({
    data: {},
    draftData: undefined,
    metadata: { name: node.name ?? 'Untitled', description: undefined, tags: [] },
    draftMetadata: null,
    visible: node.visible ?? true,
    ...node,
  });

  it('create → update → move → trash → restore works via CommandProcessor default routing', async () => {
    const core = await newCore('on');
    const cp = new CommandProcessor(core);

    const createRes = await cp.processCommand(
      cp.createEnvelope('createNode', {
        nodeType: 'folder' as NodeType,
        treeId: 'r' as TreeId,
        parentId: 'r:root' as NodeId,
        metadata: { name: 'FolderB' },
      })
    );
    expect(createRes.success).toBe(true);
    if (!createRes.success || !createRes.nodeId) {
      throw new Error('createNode did not return nodeId');
    }
    const nodeId = createRes.nodeId;

    const updateRes = await cp.processCommand(
      cp.createEnvelope('updateNode', { nodeId, metadata: { name: 'FolderB1' } })
    );
    expect(updateRes.success).toBe(true);

    const parentId = await core.createNode(
      withPayload({
        id: `p3-${Date.now()}` as NodeId,
        parentId: 'r:root' as NodeId,
        nodeType: 'folder' as NodeType,
        name: 'P3',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      })
    );
    const moveRes = await cp.processCommand(
      cp.createEnvelope('moveNodes', { nodeIds: [nodeId], toParentId: parentId })
    );
    expect(moveRes.success).toBe(true);

    const mt = await cp.processCommand(cp.createEnvelope('moveToArchive', { nodeIds: [nodeId] }));
    expect(mt.success).toBe(true);

    const rec = await cp.processCommand(
      cp.createEnvelope('restoreFromArchive', { nodeIds: [nodeId] })
    );
    expect(rec.success).toBe(true);
  });
});
