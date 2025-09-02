import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';
import { CoreDB } from '~/services/CoreDB';
import { CommandProcessor } from '~/services/CommandProcessor';
import { encodeWorkingCopyHolderName } from '~/services/utils/holder-encoding';

describe('Headless: Policy C load (moderate subtree)', () => {
  beforeEach(() => {
    (process as any).env.WORKER_POLICY_C = '1';
  });

  async function newCore(name: string): Promise<CoreDB> {
    return await CoreDB.getSingleton(`pc-load-${name}-${Date.now()}-${Math.random()}`);
  }

  it('blocks move on subtree with 200 descendants when WC exists (under threshold time)', async () => {
    const core = await newCore('200');
    const cp = new CommandProcessor(core);

    // Build a moderate tree: root -> A -> 200 children B_i
    const aId = ('A-' + Date.now()) as NodeId;
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

    const toCreate: TreeNode[] = [];
    for (let i = 0; i < 200; i++) {
      toCreate.push({
        id: (`B-${i}-` + Date.now()) as NodeId,
        parentId: aId,
        nodeType: 'folder' as NodeType,
        name: `B-${i}`,
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      } as any);
    }
    await (core as any).bulkCreateNodes?.(toCreate);

    const targetChild = toCreate[199];
    // Create WC holder for the deepest child
    const holderId = ('wcH-load-' + Date.now()) as NodeId;
    const holderName = encodeWorkingCopyHolderName(aId, targetChild.id);
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
      id: ('wcC-load-' + Date.now()) as NodeId,
      parentId: holderId,
      nodeType: 'folder' as NodeType,
      name: 'Draft-load',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as any);

    // Create new parent
    const p2 = await core.createNode({
      id: ('P-load-' + Date.now()) as NodeId,
      parentId: 'r:root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'P-load',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as any);

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

