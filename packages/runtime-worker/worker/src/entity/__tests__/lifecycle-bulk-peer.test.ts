import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, Timestamp } from '@hierarchidb/common-type';
import { storeRegistry } from '../store-registry';

describe('Lifecycle uses bulkUpsert when available', () => {
  beforeEach(() => {
    vi.resetModules();
    (process as any).env.WORKER_ENTITY_UNIFIED = '1';
  });

  it('paste: calls store.bulkUpsert once for same nodeType', async () => {
    const core: any = {
      listChildren: vi.fn(async () => []),
      createNode: vi.fn(async () => {
      }),
      bulkCreateNodes: vi.fn(async () => {
      }),
    };
    const calls: any[] = [];
    const store = {
      async get(id: NodeId) {
        return { nodeId: id, data: { from: id } };
      },
      async put(_e: any) {
        throw new Error('should not be called in bulk path');
      },
      async delete(_id: NodeId) {
      },
      async bulkUpsert(entities: any[]) {
        calls.push(entities);
      },
    } as any;
    storeRegistry.registerPeer('folder', store);

    const { TreeMutationService } = await import('~/services/TreeMutationService');
    const svc = new TreeMutationService(core as any, { processCommand: vi.fn() } as any);
    const env = {
      commandId: 'c1',
      groupId: 'g1',
      kind: 'pasteNodes' as const,
      payload: {
        nodes: {
          s1: { id: 's1', parentId: 'x', name: 'A', nodeType: 'folder' },
          s2: { id: 's2', parentId: 'x', name: 'B', nodeType: 'folder' },
        } as any,
        nodeIds: ['s1' as NodeId, 's2' as NodeId],
        toParentId: 'p' as NodeId,
      },
      issuedAt: Date.now() as Timestamp,
      type: 'pasteNodes' as const,
    };
    const r = await svc.pasteNodes(env as any);
    expect(r.success).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].length).toBe(2);
  });
});
