import type {
  CommandEnvelope,
  Timestamp,
  TreeNode,
  TreeNodeId,
  TreeNodeType,
  UUID,
  WorkingCopy,
} from '@hierarchidb/core';
import { generateUUID } from '@hierarchidb/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProcessor } from '../command/CommandProcessor';
import { NodeLifecycleManager } from '../lifecycle/NodeLifecycleManager';
import {
  commitWorkingCopy,
  createNewDraftWorkingCopy,
  createWorkingCopyFromNode,
} from '../operations/WorkingCopyOperations';
import { TreeMutationServiceImpl } from './TreeMutationServiceImpl';

// Mock implementations
vi.mock('../operations/WorkingCopyOperations');
vi.mock('../command/CommandProcessor');
vi.mock('../lifecycle/NodeLifecycleManager');

// Mock types for testing
type MockCoreDB = {
  treeNodes: Map<TreeNodeId, TreeNode>;
  getNode: any;
  updateNode: any;
  createNode: any;
  deleteNode: any;
  getChildren: any;
};

type MockEphemeralDB = {
  workingCopies: Map<UUID, WorkingCopy>;
  createWorkingCopy: any;
  getWorkingCopy: any;
  deleteWorkingCopy: any;
};

describe('TreeMutationService', () => {
  let service: TreeMutationServiceImpl;
  let coreDB: MockCoreDB;
  let ephemeralDB: MockEphemeralDB;
  let commandProcessor: CommandProcessor;
  let lifecycleManager: NodeLifecycleManager;

  beforeEach(() => {
    // Create mock databases
    coreDB = {
      treeNodes: new Map<TreeNodeId, TreeNode>(),
      getNode: vi.fn(),
      updateNode: vi.fn(async (id: TreeNodeId, data: Partial<TreeNode>) => {
        const node = coreDB.treeNodes.get(id);
        if (node) {
          coreDB.treeNodes.set(id, { ...node, ...data });
        }
      }),
      createNode: vi.fn(async (node: TreeNode) => {
        coreDB.treeNodes.set(node.treeNodeId, node);
        return node.treeNodeId;
      }),
      deleteNode: vi.fn(async (id: TreeNodeId) => {
        coreDB.treeNodes.delete(id);
      }),
      getChildren: vi.fn(async (parentId: TreeNodeId) => {
        return Array.from(coreDB.treeNodes.values()).filter((n) => n.parentTreeNodeId === parentId);
      }),
    };

    // Configure getNode mock to return from the map
    coreDB.getNode.mockImplementation((id: TreeNodeId) => {
      return Promise.resolve(coreDB.treeNodes.get(id));
    });

    ephemeralDB = {
      workingCopies: new Map<UUID, WorkingCopy>(),
      createWorkingCopy: vi.fn(async (wc: WorkingCopy) => {
        ephemeralDB.workingCopies.set(wc.workingCopyId, wc);
      }),
      getWorkingCopy: vi.fn((id: UUID) => ephemeralDB.workingCopies.get(id)),
      deleteWorkingCopy: vi.fn(async (id: UUID) => {
        ephemeralDB.workingCopies.delete(id);
      }),
    };

    commandProcessor = new CommandProcessor();
    lifecycleManager = new NodeLifecycleManager({} as any, {} as any, {} as any);

    service = new TreeMutationServiceImpl(
      coreDB as any,
      ephemeralDB as any,
      commandProcessor,
      lifecycleManager
    );
  });

  describe('Working Copy Operations', () => {
    describe('createWorkingCopyForCreate', () => {
      it('should create a draft working copy for new node', async () => {
        const workingCopyId = generateUUID();
        const parentId = 'parent-1' as TreeNodeId;

        const cmd: CommandEnvelope<'createWorkingCopyForCreate', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'createWorkingCopyForCreate',
          payload: {
            workingCopyId,
            parentTreeNodeId: parentId,
            name: 'New Node',
            description: 'Test description',
          },
          issuedAt: Date.now() as Timestamp,
        };

        vi.mocked(createNewDraftWorkingCopy).mockResolvedValue(workingCopyId);

        await service.createWorkingCopyForCreate(cmd);

        expect(createNewDraftWorkingCopy).toHaveBeenCalledWith(
          ephemeralDB,
          coreDB,
          parentId,
          expect.any(String),
          'New Node'
        );
      });

      it('should handle name conflicts with auto-rename', async () => {
        // Add existing nodes
        coreDB.treeNodes.set('existing-1' as TreeNodeId, {
          treeNodeId: 'existing-1' as TreeNodeId,
          parentTreeNodeId: 'parent-1' as TreeNodeId,
          name: 'Document',
          treeNodeType: 'folder' as TreeNodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const workingCopyId = generateUUID();
        const cmd: CommandEnvelope<'createWorkingCopyForCreate', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'createWorkingCopyForCreate',
          payload: {
            workingCopyId,
            parentTreeNodeId: 'parent-1' as TreeNodeId,
            name: 'Document',
          },
          issuedAt: Date.now() as Timestamp,
        };

        vi.mocked(createNewDraftWorkingCopy).mockResolvedValue(workingCopyId);

        await service.createWorkingCopyForCreate(cmd);

        expect(createNewDraftWorkingCopy).toHaveBeenCalled();
      });
    });

    describe('createWorkingCopy', () => {
      it('should create a working copy from existing node', async () => {
        const nodeId = 'node-1' as TreeNodeId;
        const workingCopyId = generateUUID();

        // Add source node
        coreDB.treeNodes.set(nodeId, {
          treeNodeId: nodeId,
          parentTreeNodeId: 'parent-1' as TreeNodeId,
          name: 'Existing Node',
          treeNodeType: 'folder' as TreeNodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'createWorkingCopy', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'createWorkingCopy',
          payload: {
            workingCopyId,
            sourceTreeNodeId: nodeId,
          },
          issuedAt: Date.now() as Timestamp,
        };

        vi.mocked(createWorkingCopyFromNode).mockResolvedValue(workingCopyId);

        await service.createWorkingCopy(cmd);

        expect(createWorkingCopyFromNode).toHaveBeenCalledWith(ephemeralDB, coreDB, nodeId);
      });

      it('should fail if source node does not exist', async () => {
        const cmd: CommandEnvelope<'createWorkingCopy', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'createWorkingCopy',
          payload: {
            workingCopyId: generateUUID(),
            sourceTreeNodeId: 'non-existent' as TreeNodeId,
          },
          issuedAt: Date.now() as Timestamp,
        };

        vi.mocked(createWorkingCopyFromNode).mockRejectedValue(new Error('Node not found'));

        await expect(service.createWorkingCopy(cmd)).rejects.toThrow('Node not found');
      });
    });

    describe('commitWorkingCopyForCreate', () => {
      it('should commit draft working copy as new node', async () => {
        const workingCopyId = generateUUID();

        vi.mocked(commitWorkingCopy).mockResolvedValue({
          success: true,
          seq: 1,
          nodeId: 'new-node-1' as TreeNodeId,
        });

        const cmd: CommandEnvelope<'commitWorkingCopyForCreate', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'commitWorkingCopyForCreate',
          payload: {
            workingCopyId,
            onNameConflict: 'auto-rename',
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.commitWorkingCopyForCreate(cmd);

        expect(result.success).toBe(true);
        expect(commitWorkingCopy).toHaveBeenCalledWith(
          ephemeralDB,
          coreDB,
          workingCopyId,
          true,
          'auto-rename'
        );
      });

      it('should handle name conflicts', async () => {
        const workingCopyId = generateUUID();

        vi.mocked(commitWorkingCopy).mockResolvedValue({
          success: false,
          error: 'Name conflict',
          code: 'NAME_NOT_UNIQUE' as const,
        });

        const cmd: CommandEnvelope<'commitWorkingCopyForCreate', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'commitWorkingCopyForCreate',
          payload: {
            workingCopyId,
            onNameConflict: 'error',
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.commitWorkingCopyForCreate(cmd);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.code).toBe('NAME_NOT_UNIQUE');
        }
      });
    });

    describe('commitWorkingCopy', () => {
      it('should commit working copy with optimistic lock check', async () => {
        const workingCopyId = generateUUID();
        const expectedUpdatedAt = Date.now() as Timestamp;

        vi.mocked(commitWorkingCopy).mockResolvedValue({
          success: true,
          seq: 2,
          nodeId: 'node-1' as TreeNodeId,
        });

        const cmd: CommandEnvelope<'commitWorkingCopy', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'commitWorkingCopy',
          payload: {
            workingCopyId,
            expectedUpdatedAt,
            onNameConflict: 'auto-rename',
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.commitWorkingCopy(cmd);

        expect(result.success).toBe(true);
        expect(commitWorkingCopy).toHaveBeenCalledWith(
          ephemeralDB,
          coreDB,
          workingCopyId,
          false,
          'auto-rename'
        );
      });

      it('should detect version conflicts', async () => {
        const workingCopyId = generateUUID();

        vi.mocked(commitWorkingCopy).mockResolvedValue({
          success: false,
          error: 'Version conflict',
          code: 'STALE_VERSION' as const,
        });

        const cmd: CommandEnvelope<'commitWorkingCopy', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'commitWorkingCopy',
          payload: {
            workingCopyId,
            expectedUpdatedAt: Date.now() as Timestamp,
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.commitWorkingCopy(cmd);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.code).toBe('STALE_VERSION');
        }
      });
    });

    describe('discardWorkingCopy', () => {
      it('should discard working copy', async () => {
        const workingCopyId = generateUUID();

        ephemeralDB.workingCopies.set(workingCopyId, {
          workingCopyId,
          parentTreeNodeId: 'parent-1' as TreeNodeId,
          treeNodeType: 'folder' as TreeNodeType,
          name: 'Test',
          updatedAt: Date.now() as Timestamp,
        });

        const cmd: CommandEnvelope<'discardWorkingCopy', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'discardWorkingCopy',
          payload: { workingCopyId },
          issuedAt: Date.now() as Timestamp,
        };

        await service.discardWorkingCopy(cmd);

        expect(ephemeralDB.deleteWorkingCopy).toHaveBeenCalledWith(workingCopyId);
      });
    });
  });

  describe('Physical Operations', () => {
    describe('moveNodes', () => {
      it('should move nodes to new parent', async () => {
        const nodeIds = ['node-1', 'node-2'] as TreeNodeId[];
        const toParentId = 'new-parent' as TreeNodeId;

        // Setup nodes
        nodeIds.forEach((id) => {
          coreDB.treeNodes.set(id, {
            treeNodeId: id,
            parentTreeNodeId: 'old-parent' as TreeNodeId,
            name: `Node ${id}`,
            treeNodeType: 'folder' as TreeNodeType,
            createdAt: Date.now() as Timestamp,
            updatedAt: Date.now() as Timestamp,
            version: 1,
          });
        });

        const cmd: CommandEnvelope<'moveNodes', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'moveNodes',
          payload: {
            nodeIds,
            toParentId,
            onNameConflict: 'auto-rename',
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.moveNodes(cmd);

        expect(result.success).toBe(true);
        // Verify nodes were updated
        nodeIds.forEach((id) => {
          expect(coreDB.updateNode).toHaveBeenCalledWith(
            id,
            expect.objectContaining({ parentTreeNodeId: toParentId })
          );
        });
      });

      it('should detect circular reference', async () => {
        const parentId = 'parent-1' as TreeNodeId;
        const childId = 'child-1' as TreeNodeId;

        // Setup parent-child relationship
        coreDB.treeNodes.set(parentId, {
          treeNodeId: parentId,
          parentTreeNodeId: 'root' as TreeNodeId,
          name: 'Parent',
          treeNodeType: 'folder' as TreeNodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        coreDB.treeNodes.set(childId, {
          treeNodeId: childId,
          parentTreeNodeId: parentId,
          name: 'Child',
          treeNodeType: 'folder' as TreeNodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'moveNodes', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'moveNodes',
          payload: {
            nodeIds: [parentId],
            toParentId: childId, // Try to move parent under its child
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.moveNodes(cmd);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.code).toBe('ILLEGAL_RELATION');
        }
      });
    });

    describe('duplicateNodes', () => {
      it('should duplicate nodes with new IDs', async () => {
        const sourceId = 'source-1' as TreeNodeId;
        const toParentId = 'parent-1' as TreeNodeId;

        coreDB.treeNodes.set(sourceId, {
          treeNodeId: sourceId,
          parentTreeNodeId: 'old-parent' as TreeNodeId,
          name: 'Original',
          treeNodeType: 'folder' as TreeNodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'duplicateNodes', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'duplicateNodes',
          payload: {
            nodeIds: [sourceId],
            toParentId,
            onNameConflict: 'auto-rename',
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.duplicateNodes(cmd);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.newNodeIds).toHaveLength(1);
          // Verify new node was created
          expect(coreDB.createNode).toHaveBeenCalledWith(
            expect.objectContaining({
              parentTreeNodeId: toParentId,
              name: 'Original (Copy)',
            })
          );
        }
      });

      it('should duplicate node with all descendants', async () => {
        const parentId = 'parent-1' as TreeNodeId;
        const childId = 'child-1' as TreeNodeId;
        const toParentId = 'new-parent' as TreeNodeId;

        // Setup parent-child structure
        coreDB.treeNodes.set(parentId, {
          treeNodeId: parentId,
          parentTreeNodeId: 'root' as TreeNodeId,
          name: 'Parent',
          treeNodeType: 'folder' as TreeNodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        coreDB.treeNodes.set(childId, {
          treeNodeId: childId,
          parentTreeNodeId: parentId,
          name: 'Child',
          treeNodeType: 'folder' as TreeNodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'duplicateNodes', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'duplicateNodes',
          payload: {
            nodeIds: [parentId],
            toParentId,
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.duplicateNodes(cmd);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.newNodeIds).toHaveLength(2); // Parent + child
        }
      });
    });

    describe('moveToTrash', () => {
      it('should move nodes to trash', async () => {
        const nodeId = 'node-1' as TreeNodeId;
        const originalParentId = 'parent-1' as TreeNodeId;

        coreDB.treeNodes.set(nodeId, {
          treeNodeId: nodeId,
          parentTreeNodeId: originalParentId,
          name: 'To Remove',
          treeNodeType: 'folder' as TreeNodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'moveToTrash', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'moveToTrash',
          payload: { nodeIds: [nodeId] },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.moveToTrash(cmd);

        expect(result.success).toBe(true);
        expect(coreDB.updateNode).toHaveBeenCalledWith(
          nodeId,
          expect.objectContaining({
            originalParentTreeNodeId: originalParentId,
            originalName: 'To Remove',
          })
        );
      });
    });

    describe('recoverFromTrash', () => {
      it('should restore nodes from trash', async () => {
        const nodeId = 'node-1' as TreeNodeId;
        const originalParentId = 'parent-1' as TreeNodeId;

        coreDB.treeNodes.set(nodeId, {
          treeNodeId: nodeId,
          parentTreeNodeId: 'trash' as TreeNodeId,
          name: 'Trashed Node',
          originalParentTreeNodeId: originalParentId,
          originalName: 'Original Name',
          removedAt: Date.now() as Timestamp,
          treeNodeType: 'folder' as TreeNodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'recoverFromTrash', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'recoverFromTrash',
          payload: {
            nodeIds: [nodeId],
            // Remove onNameConflict to avoid auto-rename logic
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.recoverFromTrash(cmd);

        expect(result.success).toBe(true);
        expect(coreDB.updateNode).toHaveBeenCalledWith(
          nodeId,
          expect.objectContaining({
            parentTreeNodeId: originalParentId,
            name: 'Original Name',
          })
        );
      });

      it('should restore to specified parent', async () => {
        const nodeId = 'node-1' as TreeNodeId;
        const newParentId = 'new-parent' as TreeNodeId;

        coreDB.treeNodes.set(nodeId, {
          treeNodeId: nodeId,
          parentTreeNodeId: 'trash' as TreeNodeId,
          name: 'Trashed Node',
          originalParentTreeNodeId: 'old-parent' as TreeNodeId,
          originalName: 'Original Name',
          removedAt: Date.now() as Timestamp,
          treeNodeType: 'folder' as TreeNodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'recoverFromTrash', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'recoverFromTrash',
          payload: {
            nodeIds: [nodeId],
            toParentId: newParentId,
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.recoverFromTrash(cmd);

        expect(result.success).toBe(true);
        expect(coreDB.updateNode).toHaveBeenCalledWith(
          nodeId,
          expect.objectContaining({
            parentTreeNodeId: newParentId,
          })
        );
      });
    });

    describe('remove', () => {
      it('should remove nodes', async () => {
        const nodeId = 'node-1' as TreeNodeId;

        coreDB.treeNodes.set(nodeId, {
          treeNodeId: nodeId,
          parentTreeNodeId: 'trash' as TreeNodeId,
          name: 'To Delete',
          treeNodeType: 'folder' as TreeNodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'remove', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'remove',
          payload: { nodeIds: [nodeId] },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.remove(cmd);

        expect(result.success).toBe(true);
        expect(coreDB.deleteNode).toHaveBeenCalledWith(nodeId);
      });

      it('should delete descendants recursively', async () => {
        const parentId = 'parent-1' as TreeNodeId;
        const childId = 'child-1' as TreeNodeId;

        coreDB.treeNodes.set(parentId, {
          treeNodeId: parentId,
          parentTreeNodeId: 'trash' as TreeNodeId,
          name: 'Parent',
          treeNodeType: 'folder' as TreeNodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        coreDB.treeNodes.set(childId, {
          treeNodeId: childId,
          parentTreeNodeId: parentId,
          name: 'Child',
          treeNodeType: 'folder' as TreeNodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'remove', any> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'remove',
          payload: { nodeIds: [parentId] },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.remove(cmd);

        expect(result.success).toBe(true);
        expect(coreDB.deleteNode).toHaveBeenCalledWith(parentId);
        expect(coreDB.deleteNode).toHaveBeenCalledWith(childId);
      });
    });
  });

  describe('Undo/Redo Operations', () => {
    describe('undo', () => {
      it('should undo last operation', async () => {
        const groupId = generateUUID();

        commandProcessor.undo = vi.fn().mockResolvedValue({
          success: true,
          seq: 10,
        });

        const cmd: CommandEnvelope<'undo', any> = {
          commandId: generateUUID(),
          groupId,
          kind: 'undo',
          payload: { groupId },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.undo(cmd);

        expect(result.success).toBe(true);
        expect(commandProcessor.undo).toHaveBeenCalledWith(groupId);
      });
    });

    describe('redo', () => {
      it('should redo last undone operation', async () => {
        const groupId = generateUUID();

        commandProcessor.redo = vi.fn().mockResolvedValue({
          success: true,
          seq: 11,
        });

        const cmd: CommandEnvelope<'redo', any> = {
          commandId: generateUUID(),
          groupId,
          kind: 'redo',
          payload: { groupId },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.redo(cmd);

        expect(result.success).toBe(true);
        expect(commandProcessor.redo).toHaveBeenCalledWith(groupId);
      });
    });
  });
});
