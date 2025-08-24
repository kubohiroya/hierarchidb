import type { Timestamp, TreeNode, NodeId, NodeType, WorkingCopy } from '@hierarchidb/common-core';
import { generateNodeId } from '@hierarchidb/common-core';
import type { CommandResult } from '../command/types';
import { WorkerErrorCode } from '../command/types';
import type { CoreDB } from '../db/CoreDB';
import type { EphemeralDB } from '../db/EphemeralDB';

/**
 * Create a new draft working copy for creating a new node
 * Working copy is a TreeNode stored in EphemeralDB
 */
export async function createNewDraftWorkingCopy(
  ephemeralDB: EphemeralDB,
  coreDB: CoreDB,
  parentId: NodeId,
  nodeType: NodeType,
  baseName: string
): Promise<NodeId> {
  // Get existing sibling names for uniqueness check
  const siblingNames = await getChildNames(coreDB, parentId);
  const uniqueName = createNewName(siblingNames, baseName);

  // Generate new ID for the draft (will be used as both treeNodeId and workingCopyOf)
  const newNodeId = generateNodeId() as NodeId;
  const now = Date.now() as Timestamp;

  const workingCopy: WorkingCopy = {
    // TreeNode properties
    id: newNodeId, // New node gets a new ID
    parentId: parentId,
    nodeType,
    name: uniqueName,
    createdAt: now,
    updatedAt: now,
    version: 1,

    // WorkingCopy properties
    copiedAt: now,

    // Draft property
    isDraft: true,
  };

  // Store in EphemeralDB with the same ID
  (await (ephemeralDB as any).createWorkingCopy?.(workingCopy)) ||
    (ephemeralDB as any).workingCopies?.set(newNodeId, workingCopy);

  return newNodeId;
}

/**
 * Create a working copy from an existing node for editing
 * Working copy uses the same treeNodeId as the original
 */
export async function createWorkingCopyFromNode(
  ephemeralDB: EphemeralDB,
  coreDB: CoreDB,
  nodeId: NodeId
): Promise<NodeId> {
  // Get the source node
  const node = (await (coreDB as any).getNode?.(nodeId)) || (coreDB as any).nodes?.get(nodeId);

  if (!node) {
    throw new Error('Node not found');
  }

  // Check if working copy already exists (same ID in EphemeralDB)
  const existingWc = await (ephemeralDB as any).getWorkingCopy?.(nodeId);
  if (existingWc) {
    throw new Error('Working copy already exists');
  }

  const now = Date.now() as Timestamp;

  const workingCopy: WorkingCopy = {
    // TreeNode properties (copied from original)
    id: nodeId, // SAME ID as original
    parentId: node.parentId,
    nodeType: node.nodeType,
    name: node.name,
    description: node.description,
    createdAt: node.createdAt,
    updatedAt: now,
    version: 1, // Working copy starts with version 1

    // WorkingCopy properties
    copiedAt: now,

    // Store original version for conflict detection
    originalVersion: node.version,
  } as WorkingCopy & { originalVersion: number };

  // Store in EphemeralDB with the SAME ID as original
  (await (ephemeralDB as any).createWorkingCopy?.(workingCopy)) ||
    (ephemeralDB as any).workingCopies?.set(nodeId, workingCopy);

  return nodeId;
}

/**
 * Commit working copy changes
 * Merges working copy TreeNode back to original or creates new node
 */
export async function commitWorkingCopy(
  ephemeralDB: EphemeralDB,
  coreDB: CoreDB,
  workingCopyNodeId: NodeId,
  isDraft: boolean,
  onNameConflict: 'error' | 'auto-rename' = 'error'
): Promise<CommandResult> {
  const workingCopy = await getWorkingCopy(ephemeralDB, workingCopyNodeId);

  if (!workingCopy) {
    return {
      success: false,
      error: 'Working copy not found',
      code: WorkerErrorCode.WORKING_COPY_NOT_FOUND,
    };
  }

  try {
    if (isDraft) {
      // Create new node from draft - use the working copy's treeNodeId
      const nodeId = workingCopy.id;
      const now = Date.now() as Timestamp;

      // Check for name conflict
      const siblingNames = await getChildNames(coreDB, workingCopy.parentId);
      let finalName = workingCopy.name;

      if (siblingNames.includes(workingCopy.name)) {
        if (onNameConflict === 'error') {
          return {
            success: false,
            error: `Name "${workingCopy.name}" already exists`,
            code: WorkerErrorCode.VALIDATION_ERROR,
          };
        } else {
          finalName = createNewName(siblingNames, workingCopy.name);
        }
      }

      const newNode: TreeNode = {
        id: nodeId,
        parentId: workingCopy.parentId,
        nodeType: workingCopy.nodeType,
        name: finalName,
        description: workingCopy.description,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };

      (await (coreDB as any).createNode?.(newNode)) || (coreDB as any).nodes?.set(nodeId, newNode);

      // Delete working copy
      await discardWorkingCopy(ephemeralDB, workingCopyNodeId);

      return {
        success: true,
        seq: 1 as any,
        nodeId,
      };
    } else {
      // Update existing node - use the working copy's treeNodeId (same as original)
      const nodeId = workingCopy.id;
      const currentNode =
        (await (coreDB as any).getNode?.(nodeId)) || (coreDB as any).nodes?.get(nodeId);

      if (!currentNode) {
        return {
          success: false,
          error: 'Target node not found',
          code: WorkerErrorCode.NODE_NOT_FOUND,
        };
      }

      // Check for version conflict (optimistic locking)
      const originalVersion = (workingCopy as any).originalVersion || 1;
      if (currentNode.version > originalVersion) {
        return {
          success: false,
          error: 'Node was modified by another user',
          code: WorkerErrorCode.COMMIT_CONFLICT,
        };
      }

      // Check for name conflict if name changed
      if (workingCopy.name !== currentNode.name) {
        const siblingNames = await getChildNames(coreDB, workingCopy.parentId);
        if (siblingNames.includes(workingCopy.name)) {
          if (onNameConflict === 'error') {
            return {
              success: false,
              error: `Name "${workingCopy.name}" already exists`,
              code: WorkerErrorCode.VALIDATION_ERROR,
            };
          } else {
            workingCopy.name = createNewName(siblingNames, workingCopy.name);
          }
        }
      }

      // Update node
      const updates: Partial<TreeNode> = {
        name: workingCopy.name,
        description: workingCopy.description,
        updatedAt: Date.now() as Timestamp,
        version: currentNode.version + 1,
      };

      await (coreDB as any).updateNode?.(nodeId, updates);

      // Delete working copy
      await discardWorkingCopy(ephemeralDB, workingCopyNodeId);

      return {
        success: true,
        seq: 1 as any,
        nodeId,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: WorkerErrorCode.UNKNOWN_ERROR,
    };
  }
}

/**
 * Discard a working copy
 * Removes the working copy TreeNode from EphemeralDB
 */
export async function discardWorkingCopy(
  ephemeralDB: EphemeralDB,
  workingCopyNodeId: NodeId
): Promise<void> {
  (await (ephemeralDB as any).deleteWorkingCopy?.(workingCopyNodeId)) ||
    (ephemeralDB as any).workingCopies?.delete(workingCopyNodeId);
}

/**
 * Get a working copy by TreeNode ID
 */
export async function getWorkingCopy(
  ephemeralDB: EphemeralDB,
  nodeId: NodeId
): Promise<WorkingCopy | undefined> {
  return (
    (await (ephemeralDB as any).getWorkingCopy?.(nodeId)) ||
    (ephemeralDB as any).workingCopies?.get(nodeId)
  );
}

/**
 * Update working copy properties
 */
export async function updateWorkingCopy(
  ephemeralDB: EphemeralDB,
  nodeId: NodeId,
  updates: Partial<WorkingCopy>
): Promise<void> {
  const existing = await getWorkingCopy(ephemeralDB, nodeId);
  if (!existing) {
    throw new Error('Working copy not found');
  }

  const updated: WorkingCopy = {
    ...existing,
    ...updates,
    updatedAt: Date.now() as Timestamp,
  };

  (await (ephemeralDB as any).updateWorkingCopy?.(nodeId, updated)) ||
    (ephemeralDB as any).workingCopies?.set(nodeId, updated);
}

/**
 * Check if a working copy has conflicts with the current node version
 */
export async function checkWorkingCopyConflict(
  ephemeralDB: EphemeralDB,
  coreDB: CoreDB,
  nodeId: NodeId
): Promise<boolean> {
  const workingCopy = await getWorkingCopy(ephemeralDB, nodeId);
  if (!workingCopy) {
    return false;
  }

  // Draft working copies have no conflict
  if (workingCopy.isDraft) {
    return false;
  }

  const currentNode =
    (await (coreDB as any).getNode?.(nodeId)) || (coreDB as any).nodes?.get(nodeId);

  if (!currentNode) {
    return false;
  }

  const originalVersion = (workingCopy as any).originalVersion || 1;
  return currentNode.version > originalVersion;
}

/**
 * Get names of all children of a parent node
 * 🟢 Utility function from eria-cartograph
 */
export async function getChildNames(coreDB: CoreDB, parentId: NodeId): Promise<string[]> {
  const children = (await (coreDB as any).getChildren?.(parentId)) || [];
  return children.map((child: TreeNode) => child.name);
}

/**
 * Create a unique name by adding (n) suffix if needed
 * 🟢 Based on user requirements and eria-cartograph pattern
 */
export function createNewName(siblingNames: string[], baseName: string): string {
  if (!siblingNames.includes(baseName)) {
    return baseName;
  }

  // Extract existing numbers for this base name
  const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedBase}\\s*\\((\\d+)\\)$`);

  const existingNumbers = siblingNames
    .map((name) => {
      const match = pattern.exec(name);
      return match && match[1] ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;

  return `${baseName} (${nextNumber})`;
}
