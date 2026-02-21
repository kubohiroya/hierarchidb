import { toNodeId, toNodeType } from '@hierarchidb/core-types';
import type { NodeId, Timestamp, TreeId } from '@hierarchidb/core-types';
import type {
  CommandEnvelope,
  DuplicateNodesPayload,
  ImportNodesPayload,
  PasteNodesPayload,
  TreeNode,
} from '@hierarchidb/tree-api';
import type { ImportExportDBPort } from '@hierarchidb/import-export';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandProcessor } from '../../../services/CommandProcessor';
import type { CoreDB } from '../../../services/CoreDB';

describe('Entity lifecycle notifications from services', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('duplicateNodes notifies lifecycle when flag ON', async () => {
    const folderType = toNodeType('folder');
    const nodeMap = new Map<NodeId, TreeNode>();
    const sourceId = 'a' as NodeId;
    const parentId = 'p' as NodeId;
    nodeMap.set(sourceId, {
      id: sourceId,
      parentId,
      nodeType: folderType,
      metadata: { name: 'X', description: undefined, tags: [] },
      draftMetadata: null,
      data: {},
      draftData: undefined,
      depth: 1,
      visible: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    const core: Pick<CoreDB, 'getNode' | 'listChildren' | 'duplicateSubtreeWithMap'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
      listChildren: vi.fn(async () => []),
      duplicateSubtreeWithMap: vi.fn(async (src: NodeId, _dst: NodeId) => {
        const newRoot = `${String(src)}-copy` as NodeId;
        return {
          newRootId: newRoot,
          idMap: new Map<NodeId, NodeId>([[src, newRoot]]),
        };
      }),
    };

    const lifecycleMock = {
      handleCommand: vi.fn(async () => undefined),
    };
    const { EntityLifecycleManager } = await import('../../EntityLifecycleManager');
    const getSingletonSpy = vi
      .spyOn(EntityLifecycleManager, 'getSingleton')
      .mockReturnValue(
        lifecycleMock as unknown as ReturnType<typeof EntityLifecycleManager.getSingleton>
      );

    const commandStub: Pick<CommandProcessor, 'processCommand'> = {
      processCommand: vi.fn(),
    };

    const { TreeMutationService } = await import('../../../services/TreeMutationService');
    const svc = new TreeMutationService(core as unknown as CoreDB, commandStub as CommandProcessor);
    const duplicatePayload: DuplicateNodesPayload = { nodeIds: [sourceId], toParentId: parentId };
    const result = await svc.duplicateNodes(duplicatePayload);
    expect(result.success).toBe(true);
    expect(lifecycleMock.handleCommand).toHaveBeenCalled();

    getSingletonSpy.mockRestore();
  });

  it('pasteNodes notifies lifecycle when flag ON', async () => {
    const folderType = toNodeType('folder');
    const core: Pick<CoreDB, 'listChildren' | 'createNode' | 'bulkCreateNodes' | 'getNode'> = {
      listChildren: vi.fn(async () => []),
      createNode: vi.fn(async (node: TreeNode) => node.id),
      bulkCreateNodes: vi.fn(async () => undefined),
      getNode: vi.fn(async () => undefined),
    };
    const lifecycleMock = {
      handleCommand: vi.fn(async () => undefined),
    };
    const { EntityLifecycleManager } = await import('../../EntityLifecycleManager');
    const getSingletonSpy = vi
      .spyOn(EntityLifecycleManager, 'getSingleton')
      .mockReturnValue(
        lifecycleMock as unknown as ReturnType<typeof EntityLifecycleManager.getSingleton>
      );

    const commandStub: Pick<CommandProcessor, 'processCommand'> = {
      processCommand: vi.fn(),
    };

    const { TreeMutationService } = await import('../../../services/TreeMutationService');
    const svc = new TreeMutationService(core as unknown as CoreDB, commandStub as CommandProcessor);
    const payload: PasteNodesPayload = {
      nodes: {
        [toNodeId('a')]: {
          id: toNodeId('a'),
          parentId: 'src-parent' as NodeId,
          nodeType: folderType,
          metadata: { name: 'A', description: undefined, tags: [] },
          draftMetadata: null,
          data: {},
          draftData: undefined,
          depth: 1,
          visible: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
        [toNodeId('b')]: {
          id: toNodeId('b'),
          parentId: 'src-parent' as NodeId,
          nodeType: folderType,
          metadata: { name: 'B', description: undefined, tags: [] },
          draftMetadata: null,
          data: {},
          draftData: undefined,
          depth: 1,
          visible: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
      },
      nodeIds: [toNodeId('a'), toNodeId('b')],
      toParentId: 'p' as NodeId,
    };
    const envelope: CommandEnvelope<'pasteNodes', PasteNodesPayload> = {
      commandId: 'c1',
      groupId: 'g1',
      kind: 'pasteNodes',
      payload,
      issuedAt: Date.now() as Timestamp,
    };
    const result = await svc.pasteNodes(envelope);
    expect(result.success).toBe(true);
    expect(lifecycleMock.handleCommand).toHaveBeenCalled();

    getSingletonSpy.mockRestore();
  });

  it('importNodes notifies lifecycle when flag ON', async () => {
    const bulkCreated: NodeId[] = [];
    const core: Pick<
      ImportExportDBPort,
      'bulkCreateNodes' | 'getNode' | 'listChildren' | 'listVectorTileRecords'
    > & {
      getCoreDB: () => CoreDB;
    } = {
      bulkCreateNodes: vi.fn(async (nodes: TreeNode[]) => {
        nodes.forEach((node) => {
          bulkCreated.push(node.id);
        });
      }),
      getNode: vi.fn(async () => undefined),
      listChildren: vi.fn(async () => []),
      listVectorTileRecords: vi.fn(async () => []),
      getCoreDB: () => core as unknown as CoreDB,
    };
    const lifecycleMock = {
      handleCommand: vi.fn(async () => undefined),
    };
    const { EntityLifecycleManager } = await import('../../EntityLifecycleManager');
    const getSingletonSpy = vi
      .spyOn(EntityLifecycleManager, 'getSingleton')
      .mockReturnValue(
        lifecycleMock as unknown as ReturnType<typeof EntityLifecycleManager.getSingleton>
      );

    const { ImportExportLifecycleService } = await import(
      '../../../services/ImportExportLifecycleService'
    );
    const svc = await ImportExportLifecycleService.getSingleton(core);
    const importPayload: ImportNodesPayload = {
      nodes: {},
      nodeIds: [],
      toParentId: 'p' as NodeId,
    };
    const result = await svc.importNodes({
      data: { nodes: [{ name: 'A' }, { name: 'B' }] },
      format: 'json',
      treeId: 'r' as TreeId,
      targetParentId: importPayload.toParentId,
      validateFirst: false,
    });
    expect(result.success).toBe(true);
    expect(bulkCreated.length).toBe(2);
    expect(lifecycleMock.handleCommand).toHaveBeenCalled();

    getSingletonSpy.mockRestore();
  });
});
