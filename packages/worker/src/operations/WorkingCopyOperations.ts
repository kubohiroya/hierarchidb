import type {
  Timestamp,
  TreeNode,
  TreeNodeId,
  TreeNodeType,
  UUID,
  WorkingCopy,
} from '@hierarchidb/core';
import { generateUUID } from '@hierarchidb/core';
import type { CommandResult } from '../command/types';
import { WorkerErrorCode } from '../command/types';
import type { CoreDB } from '../db/CoreDB';
import type { EphemeralDB } from '../db/EphemeralDB';

/**
 * Create a new draft working copy for creating a new node
 * 🟢 Based on improved-working-copy-requirements.md
 */
export async function createNewDraftWorkingCopy(
  ephemeralDB: EphemeralDB,
  coreDB: CoreDB,
  parentTreeNodeId: TreeNodeId,
  treeNodeType: TreeNodeType,
  baseName: string
): Promise<UUID> {
  // Get existing sibling names for uniqueness check
  const siblingNames = await getChildNames(coreDB, parentTreeNodeId);
  const uniqueName = createNewName(siblingNames, baseName);

  // Create draft working copy
  const workingCopyId = generateUUID();
  const now = Date.now() as Timestamp;

  const workingCopy: WorkingCopy = {
    workingCopyId,
    parentTreeNodeId,
    treeNodeType,
    name: uniqueName,
    isDraft: true,
    workingCopyOf: undefined, // New creation, not editing existing
    copiedAt: now,
    updatedAt: now,
  };

  (await (ephemeralDB as any).createWorkingCopy?.(workingCopy)) ||
    (ephemeralDB as any).workingCopies?.set(workingCopyId, workingCopy);

  return workingCopyId;
}

/**
 * Create a working copy from an existing node for editing
 * 🟢 Based on improved-working-copy-requirements.md
 */
export async function createWorkingCopyFromNode(
  ephemeralDB: EphemeralDB,
  coreDB: CoreDB,
  nodeId: TreeNodeId
): Promise<UUID> {
  // Get the source node
  const node = (await (coreDB as any).getNode?.(nodeId)) || (coreDB as any).nodes?.get(nodeId);

  if (!node) {
    throw new Error('Node not found');
  }

  // Check if working copy already exists
  const existingWc = await (ephemeralDB as any).getWorkingCopyByNodeId?.(nodeId);
  if (existingWc) {
    throw new Error('Working copy already exists');
  }

  // Create working copy from node
  const workingCopyId = generateUUID();
  const now = Date.now() as Timestamp;

  const workingCopy: WorkingCopy = {
    workingCopyId,
    parentTreeNodeId: node.parentTreeNodeId,
    treeNodeType: node.treeNodeType,
    name: node.name,
    description: node.description,
    isDraft: false,
    workingCopyOf: nodeId,
    copiedAt: now,
    updatedAt: now,
  };

  // Store original version for conflict detection
  (workingCopy as any).originalVersion = node.version;

  (await (ephemeralDB as any).createWorkingCopy?.(workingCopy)) ||
    (ephemeralDB as any).workingCopies?.set(workingCopyId, workingCopy);

  return workingCopyId;
}

/**
 * Commit working copy changes
 * 🟢 Based on improved-working-copy-requirements.md and user requirements
 */
export async function commitWorkingCopy(
  ephemeralDB: EphemeralDB,
  coreDB: CoreDB,
  workingCopyId: UUID,
  isDraft: boolean,
  onNameConflict: 'error' | 'auto-rename' = 'error'
): Promise<CommandResult> {
  const workingCopy = await getWorkingCopy(ephemeralDB, workingCopyId);

  if (!workingCopy) {
    return {
      success: false,
      error: 'Working copy not found',
      code: WorkerErrorCode.WORKING_COPY_NOT_FOUND,
    };
  }

  try {
    if (isDraft) {
      // Create new node from draft
      const nodeId = generateUUID() as TreeNodeId;
      const now = Date.now() as Timestamp;

      // Check for name conflict
      const siblingNames = await getChildNames(coreDB, workingCopy.parentTreeNodeId);
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
        treeNodeId: nodeId,
        parentTreeNodeId: workingCopy.parentTreeNodeId,
        treeNodeType: workingCopy.treeNodeType,
        name: finalName,
        description: workingCopy.description,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };

      (await (coreDB as any).createNode?.(newNode)) || (coreDB as any).nodes?.set(nodeId, newNode);

      // Delete working copy
      await discardWorkingCopy(ephemeralDB, workingCopyId);

      return {
        success: true,
        seq: 1 as any,
        nodeId,
      };
    } else {
      // Update existing node
      const nodeId = workingCopy.workingCopyOf!;
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
        const siblingNames = await getChildNames(coreDB, workingCopy.parentTreeNodeId);
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
      await discardWorkingCopy(ephemeralDB, workingCopyId);

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
 * 🟢 Based on improved-working-copy-requirements.md
 */
export async function discardWorkingCopy(
  ephemeralDB: EphemeralDB,
  workingCopyId: UUID
): Promise<void> {
  (await (ephemeralDB as any).deleteWorkingCopy?.(workingCopyId)) ||
    (ephemeralDB as any).workingCopies?.delete(workingCopyId);
}

/**
 * Get a working copy by ID
 */
export async function getWorkingCopy(
  ephemeralDB: EphemeralDB,
  workingCopyId: UUID
): Promise<WorkingCopy | undefined> {
  return (
    (await (ephemeralDB as any).getWorkingCopy?.(workingCopyId)) ||
    (ephemeralDB as any).workingCopies?.get(workingCopyId)
  );
}

/**
 * Update working copy properties
 */
export async function updateWorkingCopy(
  ephemeralDB: EphemeralDB,
  workingCopyId: UUID,
  updates: Partial<WorkingCopy>
): Promise<void> {
  const existing = await getWorkingCopy(ephemeralDB, workingCopyId);
  if (!existing) {
    throw new Error('Working copy not found');
  }

  const updated: WorkingCopy = {
    ...existing,
    ...updates,
    updatedAt: Date.now() as Timestamp,
  };

  (await (ephemeralDB as any).updateWorkingCopy?.(workingCopyId, updated)) ||
    (ephemeralDB as any).workingCopies?.set(workingCopyId, updated);
}

/**
 * Check if a working copy has conflicts with the current node version
 * 🟢 Based on user requirements for optimistic locking
 */
export async function checkWorkingCopyConflict(
  ephemeralDB: EphemeralDB,
  coreDB: CoreDB,
  workingCopyId: UUID
): Promise<boolean> {
  const workingCopy = await getWorkingCopy(ephemeralDB, workingCopyId);
  if (!workingCopy) {
    return false;
  }

  // Draft working copies have no conflict
  if (workingCopy.isDraft) {
    return false;
  }

  const nodeId = workingCopy.workingCopyOf!;
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
export async function getChildNames(coreDB: CoreDB, parentId: TreeNodeId): Promise<string[]> {
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
