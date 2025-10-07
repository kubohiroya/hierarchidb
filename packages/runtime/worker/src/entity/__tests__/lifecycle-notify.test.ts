import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType, Timestamp, TreeNode } from '@hierarchidb/common-types';
import type { CoreDB } from '../../services/CoreDB.js';
import type { CommandEnvelope, PasteNodesPayload } from '../../services/command-types.js';
import type { CommandProcessor } from '../../services/CommandProcessor.js';

describe('Entity lifecycle notifications from services', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('duplicateNodes notifies lifecycle when flag ON', async () => {
    const folderType = 'folder' as NodeType;
    const nodeMap = new Map<NodeId, TreeNode>();
    const sourceId = 'a' as NodeId;
    const parentId = 'p' as NodeId;
    nodeMap.set(sourceId, {
      id: sourceId,
      parentId,
      nodeType: folderType,
      name: 'X',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    const core: Pick<CoreDB, 'getNode' | 'listChildren' | 'duplicateSubtreeWithMap'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
      listChildren: vi.fn(async () => []),
      duplicateSubtreeWithMap: vi.fn(async (src: NodeId, dst: NodeId) => {
        const newRoot = `${String(src)}-copy` as NodeId;
        return {
          newRootId: newRoot,
          idMap: new Map<NodeId, NodeId>([[src, newRoot]]),
        };
      }),
    };

    const lifecycleMock = {
      handleCommand: vi.fn(async () => undefined),
    } satisfies Pick<InstanceType<typeof EntityLifecycleManager>, 'handleCommand'>;
    const { EntityLifecycleManager } = await import('~/entity/EntityLifecycleManager');
    const getSingletonSpy = vi
      .spyOn(EntityLifecycleManager, 'getSingleton')
      .mockReturnValue(lifecycleMock as unknown as EntityLifecycleManager);

    const commandStub: Pick<CommandProcessor, 'processCommand'> = {
      processCommand: vi.fn(),
    };

    const { TreeMutationService } = await import('~/services/TreeMutationService');
    const svc = new TreeMutationService(core as unknown as CoreDB, commandStub as CommandProcessor);
    const result = await svc.duplicateNodes({ nodeIds: [sourceId], toParentId: parentId });
    expect(result.success).toBe(true);
    expect(lifecycleMock.handleCommand).toHaveBeenCalled();

    getSingletonSpy.mockRestore();
  });

  it('pasteNodes notifies lifecycle when flag ON', async () => {
    const folderType = 'folder' as NodeType;
    const core: Pick<CoreDB, 'listChildren' | 'createNode' | 'bulkCreateNodes' | 'getNode'> = {
      listChildren: vi.fn(async () => []),
      createNode: vi.fn(async (node: TreeNode) => node.id),
      bulkCreateNodes: vi.fn(async () => undefined),
      getNode: vi.fn(async () => undefined),
    };
    const lifecycleMock = {
      handleCommand: vi.fn(async () => undefined),
    } satisfies Pick<InstanceType<typeof EntityLifecycleManager>, 'handleCommand'>;
    const { EntityLifecycleManager } = await import('~/entity/EntityLifecycleManager');
    const getSingletonSpy = vi
      .spyOn(EntityLifecycleManager, 'getSingleton')
      .mockReturnValue(lifecycleMock as unknown as EntityLifecycleManager);

    const commandStub: Pick<CommandProcessor, 'processCommand'> = {
      processCommand: vi.fn(),
    };

    const { TreeMutationService } = await import('~/services/TreeMutationService');
    const svc = new TreeMutationService(core as unknown as CoreDB, commandStub as CommandProcessor);
    const payload: PasteNodesPayload = {
      nodes: {
        a: {
          id: 'a' as NodeId,
          parentId: 'src-parent' as NodeId,
          nodeType: folderType,
          name: 'A',
          depth: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
        b: {
          id: 'b' as NodeId,
          parentId: 'src-parent' as NodeId,
          nodeType: folderType,
          name: 'B',
          depth: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
      },
      nodeIds: ['a' as NodeId, 'b' as NodeId],
      toParentId: 'p' as NodeId,
    };
    const envelope: CommandEnvelope<'pasteNodes', PasteNodesPayload> = {
      commandId: 'c1',
      groupId: 'g1',
      kind: 'pasteNodes',
      payload,
      issuedAt: Date.now() as Timestamp,
      type: 'pasteNodes',
    };
    const result = await svc.pasteNodes(envelope);
    expect(r.success).toBe(true);
    expect(result.success).toBe(true);
    expect(lifecycleMock.handleCommand).toHaveBeenCalled();

    getSingletonSpy.mockRestore();
  });

  it('importNodes notifies lifecycle when flag ON', async () => {
    const bulkCreated: NodeId[] = [];
    const core: Pick<CoreDB, 'bulkCreateNodes' | 'getNode'> = {
      bulkCreateNodes: vi.fn(async (nodes: TreeNode[]) => nodes.forEach((node) => bulkCreated.push(node.id))),
      getNode: vi.fn(async () => undefined),
    };
    const lifecycleMock = {
      handleCommand: vi.fn(async () => undefined),
    } satisfies Pick<InstanceType<typeof EntityLifecycleManager>, 'handleCommand'>;
    const { EntityLifecycleManager } = await import('~/entity/EntityLifecycleManager');
    const getSingletonSpy = vi
      .spyOn(EntityLifecycleManager, 'getSingleton')
      .mockReturnValue(lifecycleMock as unknown as EntityLifecycleManager);

    const { ImportExportService } = await import('~/services/ImportExportService');
    const svc = await ImportExportService.getSingleton(core as unknown as CoreDB);
    const result = await svc.importNodes({
      data: { nodes: [{ name: 'A' }, { name: 'B' }] },
      format: 'json',
      treeId: 'r' as NodeId,
      targetParentId: 'p' as NodeId,
      validateFirst: false,
    });
    expect(result.success).toBe(true);
    expect(bulkCreated.length).toBe(2);
    expect(lifecycleMock.handleCommand).toHaveBeenCalled();

    getSingletonSpy.mockRestore();
  });
});
