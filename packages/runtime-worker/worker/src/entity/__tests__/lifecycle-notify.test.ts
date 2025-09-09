import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, Timestamp } from '@hierarchidb/common-type';

describe('Entity lifecycle notifications from services', () => {
  beforeEach(() => {
    vi.resetModules();
    (process as any).env.WORKER_ENTITY_UNIFIED = '1';
  });

  it('duplicateNodes notifies lifecycle when flag ON', async () => {
    const core: any = {
      getNode: vi.fn(async (_id: NodeId) => ({
        id: _id,
        parentId: 'p' as NodeId,
        nodeType: 'folder',
        name: 'X',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      })),
      createNode: vi.fn(),
      listChildren: vi.fn(async () => []),
      duplicateSubtree: vi.fn(async (_src: NodeId, _dst: NodeId) => 'newRoot' as NodeId),
    };
    const { EntityLifecycleManager } = await import('~/entity/EntityLifecycleManager');
    const spy = vi.spyOn(EntityLifecycleManager, 'getSingleton');
    const mock = {
      handleCommand: vi.fn(async () => {
      }),
    } as any;
    spy.mockReturnValue(mock);

    const { TreeMutationService } = await import('~/services/TreeMutationService');
    const svc = new TreeMutationService(core as any, { processCommand: vi.fn() } as any);
    const r = await svc.duplicateNodes({ nodeIds: ['a' as NodeId], toParentId: 'p2' as NodeId });
    expect(r.success).toBe(true);
    expect(mock.handleCommand).toHaveBeenCalled();
  });

  it('pasteNodes notifies lifecycle when flag ON', async () => {
    const core: any = {
      listChildren: vi.fn(async () => []),
      createNode: vi.fn(),
      bulkCreateNodes: vi.fn(),
    };
    const { EntityLifecycleManager } = await import('~/entity/EntityLifecycleManager');
    const spy = vi.spyOn(EntityLifecycleManager, 'getSingleton');
    const mock = {
      handleCommand: vi.fn(async () => {
      }),
    } as any;
    spy.mockReturnValue(mock);

    const { TreeMutationService } = await import('~/services/TreeMutationService');
    const svc = new TreeMutationService(core as any, { processCommand: vi.fn() } as any);
    const env = {
      commandId: 'c1',
      groupId: 'g1',
      kind: 'pasteNodes' as const,
      payload: {
        nodes: { a: {} as any, b: {} as any },
        nodeIds: ['a' as NodeId, 'b' as NodeId],
        toParentId: 'p' as NodeId,
      },
      issuedAt: Date.now() as Timestamp,
    };
    const r = await svc.pasteNodes(env as any);
    expect(r.success).toBe(true);
    expect(mock.handleCommand).toHaveBeenCalled();
  });

  it('importNodes notifies lifecycle when flag ON', async () => {
    const bulkCreated: NodeId[] = [];
    const core: any = {
      bulkCreateNodes: vi.fn(async (nodes: any[]) => nodes.forEach((n) => bulkCreated.push(n.id))),
      getNode: vi.fn(),
    };
    const { EntityLifecycleManager } = await import('~/entity/EntityLifecycleManager');
    const spy = vi.spyOn(EntityLifecycleManager, 'getSingleton');
    const mock = {
      handleCommand: vi.fn(async () => {
      }),
    } as any;
    spy.mockReturnValue(mock);

    const { ImportExportService } = await import('~/services/ImportExportService');
    const svc = await ImportExportService.getSingleton(core as any);
    const r = await svc.importNodes({
      data: { nodes: [{ name: 'A' }, { name: 'B' }] as any },
      format: 'json',
      treeId: 'r' as any,
      targetParentId: 'p' as NodeId,
      validateFirst: false,
    });
    expect(r.success).toBe(true);
    expect(bulkCreated.length).toBe(2);
    expect(mock.handleCommand).toHaveBeenCalled();
  });
});

