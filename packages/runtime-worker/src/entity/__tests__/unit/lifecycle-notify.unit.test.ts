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
import { CommandProcessor } from '../../../services/CommandProcessor';
import { CoreDB } from '../../../services/CoreDB';

const createCoreStub = () => {
  const core = CoreDB.createForTest('runtime-worker-lifecycle-notify');
  core.getNode = vi.fn(async (id: NodeId) => undefined) as CoreDB['getNode'];
  core.listChildren = vi.fn(async () => []) as CoreDB['listChildren'];
  core.duplicateSubtreeWithMap = vi.fn(async (src: NodeId, _dst: NodeId) => {
    const newRoot = `${String(src)}-copy` as NodeId;
    return { newRootId: newRoot, idMap: new Map<NodeId, NodeId>([[src, newRoot]]) };
  }) as CoreDB['duplicateSubtreeWithMap'];
  core.createNode = vi.fn(async (node: { id: NodeId }) => node.id) as CoreDB['createNode'];
  core.bulkCreateNodes = vi.fn(async () => undefined) as CoreDB['bulkCreateNodes'];
  return core;
};

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

    const core = createCoreStub();
    core.getNode = vi.fn(async (id: NodeId) => nodeMap.get(id)) as CoreDB['getNode'];

    const { EntityLifecycleManager } = await import('../../EntityLifecycleManager');
    Reflect.set(EntityLifecycleManager, 'instance', undefined);
    const lifecycleManager = EntityLifecycleManager.getSingleton(core);
    const handleCommandSpy = vi.spyOn(lifecycleManager, 'handleCommand').mockResolvedValue(undefined);

    const { TreeMutationService } = await import('../../../services/TreeMutationService');
    const commandStub = new CommandProcessor(core);
    const svc = new TreeMutationService(core, commandStub);
    const duplicatePayload: DuplicateNodesPayload = { nodeIds: [sourceId], toParentId: parentId };
    const result = await svc.duplicateNodes(duplicatePayload);
    expect(result.success).toBe(true);
    expect(handleCommandSpy).toHaveBeenCalled();

    handleCommandSpy.mockRestore();
  });

  it('pasteNodes notifies lifecycle when flag ON', async () => {
    const folderType = toNodeType('folder');
    const core = createCoreStub();
    core.listChildren = vi.fn(async () => []) as CoreDB['listChildren'];
    core.createNode = vi.fn(async (node: TreeNode) => node.id) as CoreDB['createNode'];
    core.bulkCreateNodes = vi.fn(async () => undefined) as CoreDB['bulkCreateNodes'];
    core.getNode = vi.fn(async () => undefined) as CoreDB['getNode'];
    const { EntityLifecycleManager } = await import('../../EntityLifecycleManager');
    Reflect.set(EntityLifecycleManager, 'instance', undefined);
    const lifecycleManager = EntityLifecycleManager.getSingleton(core);
    const handleCommandSpy = vi.spyOn(lifecycleManager, 'handleCommand').mockResolvedValue(undefined);

    const { TreeMutationService } = await import('../../../services/TreeMutationService');
    const commandStub = new CommandProcessor(core);
    const svc = new TreeMutationService(core, commandStub);
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
    expect(handleCommandSpy).toHaveBeenCalled();

    handleCommandSpy.mockRestore();
  });

  it('importNodes notifies lifecycle when flag ON', async () => {
    const bulkCreated: NodeId[] = [];
    const coreBase = CoreDB.createForTest('runtime-worker-lifecycle-notify-import');
    coreBase.getNode = vi.fn(async () => undefined) as CoreDB['getNode'];
    coreBase.bulkCreateNodes = vi.fn(async () => undefined) as CoreDB['bulkCreateNodes'];
    coreBase.listChildren = vi.fn(async () => []) as CoreDB['listChildren'];
    const core: ImportExportDBPort & { getCoreDB: () => CoreDB } = {
      listVectorTileRecords: vi.fn(async () => []) as ImportExportDBPort['listVectorTileRecords'],
      bulkCreateNodes: vi.fn(async (nodes: TreeNode[]) => {
        nodes.forEach((node) => {
          bulkCreated.push(node.id);
        });
      }) as ImportExportDBPort['bulkCreateNodes'],
      getNode: coreBase.getNode as ImportExportDBPort['getNode'],
      listChildren: coreBase.listChildren as ImportExportDBPort['listChildren'],
      getCoreDB: () => coreBase,
    };
    const { EntityLifecycleManager } = await import('../../EntityLifecycleManager');
    Reflect.set(EntityLifecycleManager, 'instance', undefined);
    const handleCommandSpy = vi
      .spyOn(EntityLifecycleManager.prototype, 'handleCommand')
      .mockResolvedValue(undefined);

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
    expect(handleCommandSpy).toHaveBeenCalled();

    handleCommandSpy.mockRestore();
  });
});
