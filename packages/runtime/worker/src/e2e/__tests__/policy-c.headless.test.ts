import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { CoreDB } from '../../services/CoreDB.js';
import { CommandProcessor } from '../../services/CommandProcessor.js';
import { encodeWorkingCopyHolderName } from '../../services/utils/holder-encoding.js';

describe('Headless E2E: Policy C with fake-indexeddb + CoreDB', () => {
  beforeEach(async () => {
    CoreDB.resetInstance();
    // Ensure fake-indexeddb storage is cleared between tests
    const request = indexedDB.deleteDatabase('core-db');
    if (request?.onsuccess !== undefined) {
      await new Promise<void>((resolve) => {
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      });
    }
  });

  async function newCore(name: string): Promise<CoreDB> {
    return await CoreDB.getSingleton(`pc-${name}-${Date.now()}-${Math.random()}`);
  }

  it('blocks move/remove when WC holder exists under subtree', async () => {
    const core = await newCore('on');
    const cp = new CommandProcessor(core);

    // Create a parent and a node 'a' under r:root
    const aId = ('a-' + Date.now()) as NodeId;
    const aNode: TreeNode = {
      id: aId,
      parentId: 'r:root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'A',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    await core.createNode(aNode);

    // Create a WC holder under r:workingCopy referring to node A
    const holderId = ('wcH-' + Date.now()) as NodeId;
    const holderName = encodeWorkingCopyHolderName('r:root' as NodeId, aId);
    await core.createNode({
      id: holderId,
      parentId: 'r:workingCopy' as NodeId,
      nodeType: 'workingCopy' as NodeType,
      name: holderName,
      depth: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
    // Create WC child under holder
    await core.createNode({
      id: ('wcC-' + Date.now()) as NodeId,
      parentId: holderId,
      nodeType: 'folder' as NodeType,
      name: 'Draft',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    // Try move A to a new parent -> should be blocked
    const p2 = await core.createNode({
      id: ('p2-' + Date.now()) as NodeId,
      parentId: 'r:root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'P2',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    const move = await cp.processCommand(
      cp.createEnvelope('moveNodes', { nodeIds: [aId], toParentId: p2 as NodeId }),
    );
    expect(move.success).toBe(false);

    // Try remove A -> should be blocked
    const rem = await cp.processCommand(cp.createEnvelope('remove', { nodeIds: [aId] }));
    expect(rem.success).toBe(false);
  });

  it('WC in another tree does not block current tree operations', async () => {
    const core = await newCore('multitree');
    const cp = new CommandProcessor(core);

    // create node in Projects tree (p)
    const px = ('px-' + Date.now()) as NodeId;
    await core.createNode({
      id: px,
      parentId: 'p:root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'PX',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    // create WC holder that references a node in Resources tree (r)
    const aId = ('Ar-' + Date.now()) as NodeId;
    await core.createNode({
      id: aId,
      parentId: 'r:root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'Ar',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
    const holderId = ('wcH3-' + Date.now()) as NodeId;
    const holderName = encodeWorkingCopyHolderName('r:root' as NodeId, aId);
    await core.createNode({
      id: holderId,
      parentId: 'r:workingCopy' as NodeId,
      nodeType: 'workingCopy' as NodeType,
      name: holderName,
      depth: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
    await core.createNode({
      id: ('wcC3-' + Date.now()) as NodeId,
      parentId: holderId,
      nodeType: 'folder' as NodeType,
      name: 'Draft3',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    // Move PX within Projects should be allowed
    const p2 = await core.createNode({
      id: ('p2-' + Date.now()) as NodeId,
      parentId: 'p:root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'P2',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
    const ok = await cp.processCommand(cp.createEnvelope('moveNodes', { nodeIds: [px], toParentId: p2 as NodeId }));
    expect(ok.success).toBe(true);
  });
});
