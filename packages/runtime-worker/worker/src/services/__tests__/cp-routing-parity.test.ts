import { describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';

type CoreStub = {
  state: Record<string, TreeNode>;
  getNode: (id: NodeId) => Promise<TreeNode | undefined>;
  createNode: (node: TreeNode) => Promise<NodeId>;
  updateNode: (node: Partial<TreeNode> & { id: NodeId }) => Promise<void>;
  deleteNode: (id: NodeId) => Promise<void>;
  listChildren: (parentId: NodeId) => Promise<TreeNode[]>;
};

function makeCore(): CoreStub {
  const state: Record<string, TreeNode> = Object.create(null);
  return {
    state,
    getNode: vi.fn(async (id: NodeId) => state[id]),
    createNode: vi.fn(async (node: TreeNode) => {
      state[node.id] = { ...node };
      return node.id;
    }),
    updateNode: vi.fn(async (node: Partial<TreeNode> & { id: NodeId }) => {
      state[node.id] = { ...(state[node.id] as any), ...node } as TreeNode;
    }),
    deleteNode: vi.fn(async (id: NodeId) => {
      delete state[id];
    }),
    listChildren: vi.fn(async (parentId: NodeId) => Object.values(state).filter((n) => n.parentId === parentId)),
  } as CoreStub;
}

async function loadServices() {
  // Ensure module-level flags read current process.env
  vi.resetModules();
  const { CommandProcessor } = await import('~/services/CommandProcessor');
  const { TreeMutationService } = await import('~/services/TreeMutationService');
  return { CommandProcessor, TreeMutationService };
}

describe('Parity: WORKER_USE_CMDPROC_CREATE_UPDATE (OFF vs ON)', () => {
  it('create/update yield equivalent result contracts and state effects', async () => {
    // OFF
    delete (process as any).env.WORKER_USE_CMDPROC_CREATE_UPDATE;
    const coreOff = makeCore();
    let { CommandProcessor, TreeMutationService } = await loadServices();
    let offSvc = new TreeMutationService(coreOff as any, new CommandProcessor(coreOff as any));
    const parentId = 'p1' as NodeId;
    const createOff = await offSvc.createNode({
      nodeType: 'folder' as NodeType,
      treeId: 'r' as any,
      parentId,
      name: 'New',
    });
    expect(createOff.success).toBe(true);
    const createdOffId = (createOff as any).nodeId as NodeId;
    expect(coreOff.state[createdOffId]).toBeDefined();
    expect(coreOff.state[createdOffId].name).toBe('New');

    const updateOff = await offSvc.updateNode({ nodeId: createdOffId, name: 'Renamed' });
    expect(updateOff.success).toBe(true);
    expect(coreOff.state[createdOffId].name).toBe('Renamed');

    // ON
    (process as any).env.WORKER_USE_CMDPROC_CREATE_UPDATE = '1';
    const coreOn = makeCore();
    ;({ CommandProcessor, TreeMutationService } = await loadServices());
    const onSvc = new TreeMutationService(coreOn as any, new CommandProcessor(coreOn as any));
    const createOn = await onSvc.createNode({
      nodeType: 'folder' as NodeType,
      treeId: 'r' as any,
      parentId,
      name: 'New',
    });
    expect(createOn.success).toBe(true);
    const createdOnId = (createOn as any).nodeId as NodeId;
    expect(coreOn.state[createdOnId]).toBeDefined();
    expect(coreOn.state[createdOnId].name).toBe('New');

    const updateOn = await onSvc.updateNode({ nodeId: createdOnId, name: 'Renamed' });
    expect(updateOn.success).toBe(true);
    expect(coreOn.state[createdOnId].name).toBe('Renamed');
  });
});

describe('Parity: WORKER_USE_CMDPROC_MOVE_REMOVE (OFF vs ON)', () => {
  it('move/remove yield equivalent result contracts and state effects', async () => {
    const a = 'a' as NodeId;
    const root = 'root' as NodeId;
    const p2 = 'p2' as NodeId;

    // OFF
    delete (process as any).env.WORKER_USE_CMDPROC_MOVE_REMOVE;
    let coreOff = makeCore();
    coreOff.state[a] = {
      id: a,
      parentId: root,
      nodeType: 'folder' as NodeType,
      name: 'A',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as any;
    let { CommandProcessor, TreeMutationService } = await loadServices();
    let offSvc = new TreeMutationService(coreOff as any, new CommandProcessor(coreOff as any));
    const mOff = await offSvc.moveNodes({ nodeIds: [a], toParentId: p2 });
    expect(mOff.success).toBe(true);
    expect(coreOff.state[a].parentId).toBe(p2);
    const rOff = await offSvc.removeNodes([a]);
    expect(rOff.success).toBe(true);
    expect(coreOff.state[a]).toBeUndefined();

    // ON
    (process as any).env.WORKER_USE_CMDPROC_MOVE_REMOVE = '1';
    const coreOn = makeCore();
    coreOn.state[a] = {
      id: a,
      parentId: root,
      nodeType: 'folder' as NodeType,
      name: 'A',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as any;
    ;({ CommandProcessor, TreeMutationService } = await loadServices());
    const onSvc = new TreeMutationService(coreOn as any, new CommandProcessor(coreOn as any));
    const mOn = await onSvc.moveNodes({ nodeIds: [a], toParentId: p2 });
    expect(mOn.success).toBe(true);
    expect(coreOn.state[a].parentId).toBe(p2);
    const rOn = await onSvc.removeNodes([a]);
    expect(rOn.success).toBe(true);
    expect(coreOn.state[a]).toBeUndefined();
  });
});

