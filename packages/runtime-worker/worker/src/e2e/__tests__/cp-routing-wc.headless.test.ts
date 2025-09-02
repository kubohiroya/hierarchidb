import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/common-type';
import { CoreDB } from '~/services/CoreDB';
import { CommandProcessor } from '~/services/CommandProcessor';

describe('Headless E2E (Node + fake-indexeddb): CP routing + WC flows', () => {
  beforeEach(() => {
    // Default: OFF（従来互換）
    delete (process as any).env.WORKER_USE_CMDPROC_CREATE_UPDATE;
    delete (process as any).env.WORKER_USE_CMDPROC_MOVE_REMOVE;
    delete (process as any).env.WORKER_TRASH_USE_HOLDER;
    delete (process as any).env.WORKER_WC_COMMIT_V2;
  });

  async function newCore(name: string): Promise<CoreDB> {
    // Unique DB per test run
    return await CoreDB.getSingleton(`e2e-${name}-${Date.now()}-${Math.random()}`);
  }

  it('OFF mode: create → update → move → moveToTrash → recover (legacy)', async () => {
    const core = await newCore('off');
    const cp = new CommandProcessor(core);

    // Create a new folder under r:root
    const createRes = await cp.processCommand(
      cp.createEnvelope('createNode', {
        nodeType: 'folder' as NodeType,
        treeId: 'r' as TreeId,
        parentId: 'r:root' as NodeId,
        name: 'FolderA',
      })
    );
    expect(createRes.success).toBe(true);
    const nodeId = (createRes as any).nodeId as NodeId;

    // Update name
    const updateRes = await cp.processCommand(
      cp.createEnvelope('updateNode', { nodeId, name: 'FolderA1' })
    );
    expect(updateRes.success).toBe(true);

    // Create target parent and move
    const parentId = await core.createNode({
      id: ('p2-' + Date.now()) as NodeId,
      parentId: 'r:root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'P2',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as any);
    const moveRes = await cp.processCommand(
      cp.createEnvelope('moveNodes', { nodeIds: [nodeId], toParentId: parentId })
    );
    expect(moveRes.success).toBe(true);

    // Trash and recover
    const mt = await cp.processCommand(cp.createEnvelope('moveToTrash', { nodeIds: [nodeId] } as any));
    expect(mt.success).toBe(true);

    const rec = await cp.processCommand(
      cp.createEnvelope('recoverFromTrash', { nodeIds: [nodeId], toParentId: 'r:root' as NodeId })
    );
    expect(rec.success).toBe(true);
  });

  it('ON mode: same flow with CP routing + holder trash', async () => {
    (process as any).env.WORKER_USE_CMDPROC_CREATE_UPDATE = '1';
    (process as any).env.WORKER_USE_CMDPROC_MOVE_REMOVE = '1';
    (process as any).env.WORKER_TRASH_USE_HOLDER = '1';

    const core = await newCore('on');
    const cp = new CommandProcessor(core);

    const createRes = await cp.processCommand(
      cp.createEnvelope('createNode', {
        nodeType: 'folder' as NodeType,
        treeId: 'r' as TreeId,
        parentId: 'r:root' as NodeId,
        name: 'FolderB',
      })
    );
    expect(createRes.success).toBe(true);
    const nodeId = (createRes as any).nodeId as NodeId;

    const updateRes = await cp.processCommand(
      cp.createEnvelope('updateNode', { nodeId, name: 'FolderB1' })
    );
    expect(updateRes.success).toBe(true);

    const parentId = await core.createNode({
      id: ('p3-' + Date.now()) as NodeId,
      parentId: 'r:root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'P3',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as any);
    const moveRes = await cp.processCommand(
      cp.createEnvelope('moveNodes', { nodeIds: [nodeId], toParentId: parentId })
    );
    expect(moveRes.success).toBe(true);

    const mt = await cp.processCommand(cp.createEnvelope('moveToTrash', { nodeIds: [nodeId] } as any));
    expect(mt.success).toBe(true);

    const rec = await cp.processCommand(
      cp.createEnvelope('recoverFromTrash', { nodeIds: [nodeId] })
    );
    expect(rec.success).toBe(true);
  });
});

