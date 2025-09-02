import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/common-type';
import { CoreDB } from '~/services/CoreDB';
import { CommandProcessor } from '~/services/CommandProcessor';
import { encodeWorkingCopyHolderName } from '~/services/utils/holder-encoding';

describe('Headless E2E: Policy C with fake-indexeddb + CoreDB', () => {
  beforeEach(() => {
    (process as any).env.WORKER_POLICY_C = '1';
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
    } as any);
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
    } as any);

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
    } as any);

    const move = await cp.processCommand(
      cp.createEnvelope('moveNodes', { nodeIds: [aId], toParentId: p2 as NodeId })
    );
    expect(move.success).toBe(false);

    // Try remove A -> should be blocked
    const rem = await cp.processCommand(cp.createEnvelope('remove', { nodeIds: [aId] } as any));
    expect(rem.success).toBe(false);
  });

  it('allows move when subtree has no WC; blocks when WC references descendant', async () => {
    const core = await newCore('mixed');
    const cp = new CommandProcessor(core);

    // Create nodes: root -> A -> B
    const aId = ('A-' + Date.now()) as NodeId;
    const bId = ('B-' + Date.now()) as NodeId;
    await core.createNode({
      id: aId,
      parentId: 'r:root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'A',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as any);
    await core.createNode({
      id: bId,
      parentId: aId,
      nodeType: 'folder' as NodeType,
      name: 'B',
      depth: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as any);

    // Create new parent P3
    const p3 = await core.createNode({
      id: ('P3-' + Date.now()) as NodeId,
      parentId: 'r:root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'P3',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as any);

    // No WC yet: moving A should be allowed
    const okMove = await cp.processCommand(
      cp.createEnvelope('moveNodes', { nodeIds: [aId], toParentId: p3 as NodeId })
    );
    expect(okMove.success).toBe(true);

    // Move back under root
    await core.updateNode({ id: aId, parentId: 'r:root' as NodeId, updatedAt: Date.now(), version: 2 } as any);

    // Create WC for descendant B
    const holderId = ('wcH2-' + Date.now()) as NodeId;
    const holderName = encodeWorkingCopyHolderName(aId, bId);
    await core.createNode({
      id: holderId,
      parentId: 'r:workingCopy' as NodeId,
      nodeType: 'workingCopy' as NodeType,
      name: holderName,
      depth: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as any);
    await core.createNode({
      id: ('wcC2-' + Date.now()) as NodeId,
      parentId: holderId,
      nodeType: 'folder' as NodeType,
      name: 'DraftB',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as any);

    // Now moving A should be blocked because B (descendant) has WC
    const blocked = await cp.processCommand(
      cp.createEnvelope('moveNodes', { nodeIds: [aId], toParentId: p3 as NodeId })
    );
    expect(blocked.success).toBe(false);
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
    } as any);

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
    } as any);
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
    } as any);
    await core.createNode({ id: ('wcC3-' + Date.now()) as NodeId, parentId: holderId, nodeType: 'folder' as NodeType, name: 'Draft3', depth: 1, createdAt: Date.now(), updatedAt: Date.now(), version: 1 } as any);

    // Move PX within Projects should be allowed
    const p2 = await core.createNode({ id: ('p2-' + Date.now()) as NodeId, parentId: 'p:root' as NodeId, nodeType: 'folder' as NodeType, name: 'P2', depth: 1, createdAt: Date.now(), updatedAt: Date.now(), version: 1 } as any);
    const ok = await cp.processCommand(cp.createEnvelope('moveNodes', { nodeIds: [px], toParentId: p2 as NodeId }));
    expect(ok.success).toBe(true);
  });
});
