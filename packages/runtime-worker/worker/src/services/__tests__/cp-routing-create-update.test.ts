import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreeMutationService } from '~/services/TreeMutationService';
import { CommandProcessor } from '~/services/CommandProcessor';
import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/common-type';

describe('Feature flag: WORKER_USE_CMDPROC_CREATE_UPDATE', () => {
  const coreDBStub: any = {
    createNode: vi.fn(async (node: TreeNode) => node.id),
    getNode: vi.fn(async (_id: NodeId) => ({
      id: _id,
      parentId: 'p' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'x',
      depth: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } satisfies Partial<TreeNode> as TreeNode)),
    updateNode: vi.fn(async (_node: Partial<TreeNode>) => {}),
    listChildren: vi.fn(async (_id: NodeId) => []),
  };

  beforeEach(() => {
    // Ensure flag is ON for this test
    (process as any).env.WORKER_USE_CMDPROC_CREATE_UPDATE = '1';
    (process as any).env.WORKER_WC_COMMIT_V2 = '1';
    vi.clearAllMocks();
  });

  it('routes createNode via CommandProcessor when flag ON', async () => {
    const cp = new CommandProcessor(coreDBStub);
    const svc = new TreeMutationService(coreDBStub, cp);

    const res = await svc.createNode({
      nodeType: 'folder' as NodeType,
      treeId: 'r' as TreeId,
      parentId: 'r:root' as NodeId,
      name: 'New',
    });

    expect(res.success).toBe(true);
    expect(coreDBStub.createNode).toHaveBeenCalledTimes(1);
  });

  it('routes updateNode via CommandProcessor when flag ON', async () => {
    const cp = new CommandProcessor(coreDBStub);
    const svc = new TreeMutationService(coreDBStub, cp);

    const res = await svc.updateNode({ nodeId: 'n1' as NodeId, name: 'Renamed' });

    expect(res.success).toBe(true);
    expect(coreDBStub.updateNode).toHaveBeenCalledTimes(1);
  });

  it('routes recoverFromTrash via CommandProcessor when flag ON', async () => {
    const cp = new CommandProcessor(coreDBStub);
    const svc = new TreeMutationService(coreDBStub, cp);

    const res = await svc.recoverNodesFromTrash({ nodeIds: ['n1' as NodeId], toParentId: 'p' as NodeId });
    expect(res.success).toBe(true);
    expect(coreDBStub.updateNode).toHaveBeenCalled();
  });

  it('commitWorkingCopy uses V2 flow when flag ON', async () => {
    // Arrange a minimal WC: holder(parentId=treeId:workingCopy) -> wc child
    const holderId = 'wc_holder_1' as NodeId;
    const wcId = 'wc_child_1' as NodeId;
    coreDBStub.getNode = vi.fn(async (id: NodeId) => ({
      id,
      parentId: id === wcId ? holderId : ('r:workingCopy' as NodeId),
      nodeType: 'folder' as NodeType,
      name: 'Draft',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    }));
    coreDBStub.listChildren = vi.fn(async (_id: NodeId) => []);
    const cp = new CommandProcessor(coreDBStub);
    const env = cp.createEnvelope('commitWorkingCopy', { workingCopyId: wcId });
    const res = await cp.processCommand(env as any);
    expect(res.success).toBe(true);
  });
});

describe('Feature flag: WORKER_USE_CMDPROC_MOVE_REMOVE', () => {
  const coreDBStub: any = {
    createNode: vi.fn(async (node: TreeNode) => node.id),
    getNode: vi.fn(async (_id: NodeId) => ({
      id: _id,
      parentId: 'p' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'x',
      depth: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as TreeNode)),
    updateNode: vi.fn(async (_node: Partial<TreeNode>) => {}),
    listChildren: vi.fn(async (_id: NodeId) => []),
    deleteNode: vi.fn(async (_id: NodeId) => {}),
  };

  beforeEach(() => {
    (process as any).env.WORKER_USE_CMDPROC_MOVE_REMOVE = '1';
    vi.clearAllMocks();
  });

  it('routes moveNodes via CommandProcessor when flag ON', async () => {
    const cp = new CommandProcessor(coreDBStub);
    const svc = new TreeMutationService(coreDBStub, cp);
    const res = await svc.moveNodes({ nodeIds: ['n1' as NodeId], toParentId: 'p2' as NodeId });
    expect(res.success).toBe(true);
    expect(coreDBStub.updateNode).toHaveBeenCalledTimes(1);
  });

  it('routes removeNodes via CommandProcessor when flag ON', async () => {
    const cp = new CommandProcessor(coreDBStub);
    const svc = new TreeMutationService(coreDBStub, cp);
    const res = await svc.removeNodes(['n1' as NodeId]);
    expect(res.success).toBe(true);
    expect(coreDBStub.deleteNode).toHaveBeenCalledTimes(1);
  });
});
