import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/common-type';
import { CoreDB } from '~/services/CoreDB';
import { CommandProcessor } from '/services/CommandProcessor';

describe('Headless E2E (Node + fake-indexeddb): Undo/Redo representative flow', () => {
const R: TreeId = 'r' as TreeId;

async function newCore(name: string): Promise {
    return await CoreDB.getSingleton(`e2e-undo-redo-\${name}-\${Date.now()}-\${Math.random()}`);
}

it('create → rename → move → undo×2 → redo×2', async () => {
    const core = await newCore('flow');
    const cp = new CommandProcessor(core);

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

    const cRes = await cp.processCommand(
      cp.createEnvelope('createNode', {
        nodeType: 'folder' as NodeType,
        treeId: R,
        parentId: 'r:root' as NodeId,
        name: 'A',
      })
    );
    expect(cRes.success).toBe(true);
    const aId = (cRes as any).nodeId as NodeId;

    const u1 = await cp.processCommand(cp.createEnvelope('updateNode', { nodeId: aId, name: 'A1' }));
    expect(u1.success).toBe(true);

    const m1 = await cp.processCommand(
      cp.createEnvelope('moveNodes', { nodeIds: [aId], toParentId: p2 })
    );
    expect(m1.success).toBe(true);

    const undo1 = await cp.processCommand(cp.createEnvelope('undo', { steps: 1 } as any));
    expect(undo1.success).toBe(true);
    const undo2 = await cp.processCommand(cp.createEnvelope('undo', { steps: 1 } as any));
    expect(undo2.success).toBe(true);

    const redo1 = await cp.processCommand(cp.createEnvelope('redo', { steps: 1 } as any));
    expect(redo1.success).toBe(true);
    const redo2 = await cp.processCommand(cp.createEnvelope('redo', { steps: 1 } as any));
    expect(redo2.success).toBe(true);

    const node = await core.getNode(aId);
    expect(node?.name).toBe('A1');
    expect(node?.parentId).toBe(p2);
});
});
