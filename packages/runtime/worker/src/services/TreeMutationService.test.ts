import type {
  CommandEnvelope,
  Timestamp,
  TreeNode,
  NodeId,
  NodeType,
  WorkingCopy,
} from '@hierarchidb/common-core';
import { generateNodeId } from '@hierarchidb/common-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProcessor } from '../command/CommandProcessor';
import { NodeLifecycleManager } from '../lifecycle/NodeLifecycleManager';
import {
  commitWorkingCopy,
  createNewDraftWorkingCopy,
  createWorkingCopyFromNode,
} from '../operations/WorkingCopyOperations';
import { TreeMutationService } from './TreeMutationService';

// Mock implementations
vi.mock('../operations/WorkingCopyOperations');
vi.mock('../command/CommandProcessor');
vi.mock('../lifecycle/NodeLifecycleManager');

// Mock types for testing
type MockCoreDB = {
  treeNodes: Map<NodeId, TreeNode>;
  getNode: any;
  updateNode: any;
  createNode: any;
  deleteNode: any;
  getChildren: any;
};

type MockEphemeralDB = {
  workingCopies: Map<string, WorkingCopy>;
  createWorkingCopy: any;
  getWorkingCopy: any;
  deleteWorkingCopy: any;
};

describe('TreeMutationService', () => {
  let service: TreeMutationService;
  let coreDB: MockCoreDB;
  let ephemeralDB: MockEphemeralDB;
  let commandProcessor: CommandProcessor;
  let lifecycleManager: NodeLifecycleManager;

  beforeEach(() => {
    // Create mock databases
    coreDB = {
      treeNodes: new Map<NodeId, TreeNode>(),
      getNode: vi.fn(),
      updateNode: vi.fn(async (id: NodeId, data: Partial<TreeNode>) => {
        const node = coreDB.treeNodes.get(id);
        if (node) {
          coreDB.treeNodes.set(id, { ...node, ...data });
        }
      }),
      createNode: vi.fn(async (node: TreeNode) => {
        coreDB.treeNodes.set(node.id, node);
        return node.id;
      }),
      deleteNode: vi.fn(async (id: NodeId) => {
        coreDB.treeNodes.delete(id);
      }),
      getChildren: vi.fn(async (parentId: NodeId) => {
        return Array.from(coreDB.treeNodes.values()).filter((n) => n.parentId === parentId);
      }),
    };

    // Configure getNode mock to return from the map
    coreDB.getNode.mockImplementation((id: NodeId) => {
      return Promise.resolve(coreDB.treeNodes.get(id));
    });

    ephemeralDB = {
      workingCopies: new Map<string, WorkingCopy>(),
      createWorkingCopy: vi.fn(async (wc: WorkingCopy) => {
        ephemeralDB.workingCopies.set(wc.id, wc);
      }),
      getWorkingCopy: vi.fn((id: string) => ephemeralDB.workingCopies.get(id)),
      deleteWorkingCopy: vi.fn(async (id: string) => {
        ephemeralDB.workingCopies.delete(id);
      }),
    };

    commandProcessor = new CommandProcessor();
    lifecycleManager = new NodeLifecycleManager({} as any, {} as any, {} as any);

    service = new TreeMutationService(
      coreDB as any,
      ephemeralDB as any,
      commandProcessor,
      lifecycleManager
    );
  });

  describe('Working Copy Operations', () => {
    describe('createWorkingCopyForCreate', () => {
      it('should create a draft working copy for new node', async () => {
        const workingCopyId = generateNodeId();
        const parentId = 'parent-1' as NodeId;

        const cmd: CommandEnvelope<'createWorkingCopyForCreate', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: 'createWorkingCopyForCreate',
          payload: {
            workingCopyId,
            parentId: parentId,
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
        coreDB.treeNodes.set('existing-1' as NodeId, {
          id: 'existing-1' as NodeId,
          parentId: 'parent-1' as NodeId,
          name: 'Document',
          nodeType: 'folder' as NodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const workingCopyId = generateNodeId();
        const cmd: CommandEnvelope<'createWorkingCopyForCreate', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: 'createWorkingCopyForCreate',
          payload: {
            workingCopyId,
            parentId: 'parent-1' as NodeId,
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
        const nodeId = 'node-1' as NodeId;
        const workingCopyId = generateNodeId();

        // Add source node
        coreDB.treeNodes.set(nodeId, {
          id: nodeId,
          parentId: 'parent-1' as NodeId,
          name: 'Existing Node',
          nodeType: 'folder' as NodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'createWorkingCopy', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: 'createWorkingCopy',
          payload: {
            workingCopyId,
            sourceNodeId: nodeId,
          },
          issuedAt: Date.now() as Timestamp,
        };

        vi.mocked(createWorkingCopyFromNode).mockResolvedValue(workingCopyId);

        await service.createWorkingCopy(cmd);

        expect(createWorkingCopyFromNode).toHaveBeenCalledWith(ephemeralDB, coreDB, nodeId);
      });

      it('should fail if source node does not exist', async () => {
        const cmd: CommandEnvelope<'createWorkingCopy', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: 'createWorkingCopy',
          payload: {
            workingCopyId: generateNodeId(),
            sourceNodeId: 'non-existent' as NodeId,
          },
          issuedAt: Date.now() as Timestamp,
        };

        vi.mocked(createWorkingCopyFromNode).mockRejectedValue(new Error('Node not found'));

        await expect(service.createWorkingCopy(cmd)).rejects.toThrow('Node not found');
      });
    });

    describe('commitWorkingCopyForCreate', () => {
      it('should commit draft working copy as new node', async () => {
        const workingCopyId = generateNodeId();

        vi.mocked(commitWorkingCopy).mockResolvedValue({
          success: true,
          seq: 1,
          nodeId: 'new-node-1' as NodeId,
        });

        const cmd: CommandEnvelope<'commitWorkingCopyForCreate', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
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
        const workingCopyId = generateNodeId();

        vi.mocked(commitWorkingCopy).mockResolvedValue({
          success: false,
          error: 'Name conflict',
          code: 'NAME_NOT_UNIQUE' as const,
        });

        const cmd: CommandEnvelope<'commitWorkingCopyForCreate', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
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
        const workingCopyId = generateNodeId();
        const expectedUpdatedAt = Date.now() as Timestamp;

        vi.mocked(commitWorkingCopy).mockResolvedValue({
          success: true,
          seq: 2,
          nodeId: 'node-1' as NodeId,
        });

        const cmd: CommandEnvelope<'commitWorkingCopy', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
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
        const workingCopyId = generateNodeId();

        vi.mocked(commitWorkingCopy).mockResolvedValue({
          success: false,
          error: 'Version conflict',
          code: 'STALE_VERSION' as const,
        });

        const cmd: CommandEnvelope<'commitWorkingCopy', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
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
        const workingCopyId = generateNodeId();

        ephemeralDB.workingCopies.set(workingCopyId, {
          id: workingCopyId as NodeId,
          parentId: 'parent-1' as NodeId,
          nodeType: 'folder' as NodeType,
          name: 'Test',
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
          copiedAt: Date.now() as Timestamp,
        });

        const cmd: CommandEnvelope<'discardWorkingCopy', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
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
        const nodeIds = ['node-1', 'node-2'] as NodeId[];
        const toParentId = 'new-parent' as NodeId;

        // Setup nodes
        nodeIds.forEach((id) => {
          coreDB.treeNodes.set(id, {
            id: id,
            parentId: 'old-parent' as NodeId,
            name: `Node ${id}`,
            nodeType: 'folder' as NodeType,
            createdAt: Date.now() as Timestamp,
            updatedAt: Date.now() as Timestamp,
            version: 1,
          });
        });

        const cmd: CommandEnvelope<'moveNodes', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: 'moveNodes',
          payload: {
            nodeIds,
            toParentId,
            onNameConflict: 'auto-rename',
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.moveNodes(cmd.payload);

        expect(result.success).toBe(true);
        // Verify nodes were updated
        nodeIds.forEach((id) => {
          expect(coreDB.updateNode).toHaveBeenCalledWith(
            id,
            expect.objectContaining({ parentId: toParentId })
          );
        });
      });

      it('should detect circular reference', async () => {
        const parentId = 'parent-1' as NodeId;
        const childId = 'child-1' as NodeId;

        // Setup parent-child relationship
        coreDB.treeNodes.set(parentId, {
          id: parentId,
          parentId: 'root' as NodeId,
          name: 'Parent',
          nodeType: 'folder' as NodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        coreDB.treeNodes.set(childId, {
          id: childId,
          parentId: parentId,
          name: 'Child',
          nodeType: 'folder' as NodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'moveNodes', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: 'moveNodes',
          payload: {
            nodeIds: [parentId],
            toParentId: childId, // Try to move parent under its child
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.moveNodes(cmd.payload);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('ILLEGAL_RELATION');
        }
      });
    });

    describe('duplicateNodes', () => {
      it('should duplicate nodes with new IDs', async () => {
        const sourceId = 'source-1' as NodeId;
        const toParentId = 'parent-1' as NodeId;

        coreDB.treeNodes.set(sourceId, {
          id: sourceId,
          parentId: 'old-parent' as NodeId,
          name: 'Original',
          nodeType: 'folder' as NodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'duplicateNodes', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: 'duplicateNodes',
          payload: {
            nodeIds: [sourceId],
            toParentId,
            onNameConflict: 'auto-rename',
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.duplicateNodes(cmd.payload);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.nodeIds).toHaveLength(1);
          // Verify new node was created
          expect(coreDB.createNode).toHaveBeenCalledWith(
            expect.objectContaining({
              parentId: toParentId,
              name: 'Original (Copy)',
            })
          );
        }
      });

      it('should duplicate node with all descendants', async () => {
        const parentId = 'parent-1' as NodeId;
        const childId = 'child-1' as NodeId;
        const toParentId = 'new-parent' as NodeId;

        // Setup parent-child structure
        coreDB.treeNodes.set(parentId, {
          id: parentId,
          parentId: 'root' as NodeId,
          name: 'Parent',
          nodeType: 'folder' as NodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        coreDB.treeNodes.set(childId, {
          id: childId,
          parentId: parentId,
          name: 'Child',
          nodeType: 'folder' as NodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'duplicateNodes', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: 'duplicateNodes',
          payload: {
            nodeIds: [parentId],
            toParentId,
          },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.duplicateNodes(cmd.payload);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.nodeIds).toHaveLength(2); // Parent + child
        }
      });
    });

    describe('moveToTrash', () => {
      it('should move nodes to trash', async () => {
        const nodeId = 'node-1' as NodeId;
        const originalParentId = 'parent-1' as NodeId;

        coreDB.treeNodes.set(nodeId, {
          id: nodeId,
          parentId: originalParentId,
          name: 'To Remove',
          nodeType: 'folder' as NodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'moveToTrash', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: 'moveToTrash',
          payload: { nodeIds: [nodeId] },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.moveNodesToTrash(cmd.payload.nodeIds);

        expect(result.success).toBe(true);
        expect(coreDB.updateNode).toHaveBeenCalledWith(
          nodeId,
          expect.objectContaining({
            originalParentNodeId: originalParentId,
            originalName: 'To Remove',
          })
        );
      });
    });

    describe('recoverFromTrash', () => {
      it('should restore nodes from trash', async () => {
        const nodeId = 'node-1' as NodeId;
        const originalParentId = 'parent-1' as NodeId;

        coreDB.treeNodes.set(nodeId, {
          id: nodeId,
          parentId: 'trash' as NodeId,
          name: 'Trashed Node',
          originalParentId: originalParentId,
          originalName: 'Original Name',
          removedAt: Date.now() as Timestamp,
          nodeType: 'folder' as NodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'recoverFromTrash', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
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
            parentId: originalParentId,
            name: 'Original Name',
          })
        );
      });

      it('should restore to specified parent', async () => {
        const nodeId = 'node-1' as NodeId;
        const newParentId = 'new-parent' as NodeId;

        coreDB.treeNodes.set(nodeId, {
          id: nodeId,
          parentId: 'trash' as NodeId,
          name: 'Trashed Node',
          originalParentId: 'old-parent' as NodeId,
          originalName: 'Original Name',
          removedAt: Date.now() as Timestamp,
          nodeType: 'folder' as NodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'recoverFromTrash', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
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
            parentId: newParentId,
          })
        );
      });
    });

    describe('remove', () => {
      it('should remove nodes', async () => {
        const nodeId = 'node-1' as NodeId;

        coreDB.treeNodes.set(nodeId, {
          id: nodeId,
          parentId: 'trash' as NodeId,
          name: 'To Delete',
          nodeType: 'folder' as NodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'remove', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: 'remove',
          payload: { nodeIds: [nodeId] },
          issuedAt: Date.now() as Timestamp,
        };

        const result = await service.remove(cmd);

        expect(result.success).toBe(true);
        expect(coreDB.deleteNode).toHaveBeenCalledWith(nodeId);
      });

      it('should delete descendants recursively', async () => {
        const parentId = 'parent-1' as NodeId;
        const childId = 'child-1' as NodeId;

        coreDB.treeNodes.set(parentId, {
          id: parentId,
          parentId: 'trash' as NodeId,
          name: 'Parent',
          nodeType: 'folder' as NodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        coreDB.treeNodes.set(childId, {
          id: childId,
          parentId: parentId,
          name: 'Child',
          nodeType: 'folder' as NodeType,
          createdAt: Date.now() as Timestamp,
          updatedAt: Date.now() as Timestamp,
          version: 1,
        });

        const cmd: CommandEnvelope<'remove', any> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
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
        const groupId = generateNodeId();

        commandProcessor.undo = vi.fn().mockResolvedValue({
          success: true,
          seq: 10,
        });

        const cmd: CommandEnvelope<'undo', any> = {
          commandId: generateNodeId(),
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
        const groupId = generateNodeId();

        commandProcessor.redo = vi.fn().mockResolvedValue({
          success: true,
          seq: 11,
        });

        const cmd: CommandEnvelope<'redo', any> = {
          commandId: generateNodeId(),
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
