import {
  Timestamp,
  TreeNode,
  NodeId,
  NodeType,
  TreeId,
  generateNodeId,
  NodeBase,
} from '@hierarchidb/common-type';
import type { CommandResult } from './command-types';
import { WorkerErrorCode } from './command-types';
import type { CoreDB } from './CoreDB';

export function createWorkingCopyNodeHolderParentId(treeId: TreeId) {
  return [treeId, 'workingCopy'].join('\t') as NodeId;
}

export function createWorkingCopyNodeHolderName(parentId: NodeId, nodeId: NodeId) {
  return [parentId, nodeId].join('\t') as NodeId;
}

export function splitWorkingCopyNodeHolderParentIdAndNodeId(source: string): NodeId[] {
  const [parentId, nodeId] = source.split('\t');
  return [parentId, nodeId] as NodeId[];
}

/**
 * Create a new draft working copy for creating a new node
 * Working copy is a pair of parent-child TreeNodes stored in the WorkingCopy root node
 */
export async function createNewDraftWorkingCopy(
  coreDB: CoreDB,
  treeId: TreeId,
  parentId: NodeId,
  nodeType: NodeType,
  baseName: string
): Promise<NodeId> {
  const workingCopyNodeHolderParentId = createWorkingCopyNodeHolderParentId(treeId);

  // Get existing sibling names for uniqueness check
  const siblingNames = await getChildNames(coreDB, parentId);
  const uniqueName = createNewName(siblingNames, baseName);

  // Generate new ID for the draft
  const workingCopyNodeHolderId = generateNodeId();
  const workingCopyNodeId = generateNodeId();
  const now = Date.now() as Timestamp;

  const workingCopyNodeHolder: NodeBase = {
    parentId: workingCopyNodeHolderParentId, // New node gets a new ID
    id: workingCopyNodeHolderId,
    name: createWorkingCopyNodeHolderName(parentId, workingCopyNodeHolderId), // ☺️ this is a tricky hack
    nodeType,
    depth: 0, // Will be calculated by database operations
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const workingCopyNode: NodeBase = {
    // TreeNode properties
    parentId: workingCopyNodeHolderId,
    id: workingCopyNodeId, // New node gets a new ID
    nodeType,
    name: uniqueName,
    depth: 1, // Will be calculated by database operations
    createdAt: now,
    updatedAt: now,
    version: 1,
    // Draft property
    //isDraft: true,
  };

  coreDB.nodes.bulkPut([workingCopyNodeHolder, workingCopyNode]);

  return workingCopyNodeHolderId;
}

/**
 * Create a working copy from an existing node for editing
 * Working copy uses the same treeNodeId as the original
 */
export async function createWorkingCopyFromNode(
  coreDB: CoreDB,
  treeId: TreeId,
  nodeId: NodeId
): Promise<NodeId> {
  const workingCopyNodeHolderParentId = createWorkingCopyNodeHolderParentId(treeId);

  // Get the source node
  const sourceNode = await coreDB.getNode(nodeId);

  if (!sourceNode) {
    throw new Error('Node not found');
  }

  const workingCopyNodeHolderId = generateNodeId();
  const workingCopyNodeId = generateNodeId();
  const now = Date.now() as Timestamp;

  const workingCopyNodeHolder: NodeBase = {
    parentId: workingCopyNodeHolderParentId, // New node gets a new ID
    id: workingCopyNodeHolderId,
    name: createWorkingCopyNodeHolderName(sourceNode.parentId, workingCopyNodeHolderId), // ☺️ this is a tricky hack
    nodeType: sourceNode.nodeType,
    depth: 0, // Will be calculated by database operations
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const workingCopyNode: NodeBase = {
    ...sourceNode,
    parentId: workingCopyNodeHolderId,
    id: workingCopyNodeId,
  };

  coreDB.nodes.bulkPut([workingCopyNodeHolder, workingCopyNode]);

  return nodeId;
}

/**
 * Commit working copy changes
 * Merges working copy TreeNode back to original or creates new node
 */
export async function commitWorkingCopy(
  coreDB: CoreDB,
  workingCopyNodeId: NodeId,
  isDraft: boolean,
  onNameConflict: 'error' | 'auto-rename' = 'error'
): Promise<CommandResult> {
  try {
    const now = Date.now() as Timestamp;
    const workingCopyNode = await coreDB.nodes.get(workingCopyNodeId);

    if (!workingCopyNode) {
      return {
        success: false,
        error: 'Working copy not found',
        code: WorkerErrorCode.WORKING_COPY_NOT_FOUND,
      };
    }

    const workingCopyNodeHolder = await coreDB.nodes.get(workingCopyNode.parentId);

    if (!workingCopyNodeHolder) {
      return {
        success: false,
        error: 'Working copy holder not found',
        code: WorkerErrorCode.WORKING_COPY_NOT_FOUND,
      };
    }

    const [parentId, nodeId] = splitWorkingCopyNodeHolderParentIdAndNodeId(
      workingCopyNodeHolder.name
    );

    const parentNode = await coreDB.nodes.get(parentId);
    if (!parentNode) {
      return {
        success: false,
        error: 'Parent node not found',
        code: WorkerErrorCode.WORKING_COPY_NOT_FOUND,
      };
    }

    const originalNode = await coreDB.nodes.get(nodeId);
    if (!originalNode) {
      return {
        success: false,
        error: 'Original node not found',
        code: WorkerErrorCode.WORKING_COPY_NOT_FOUND,
      };
    }

    // Check for name conflict
    const siblingNames = await getChildNames(coreDB, parentId);
    let name = workingCopyNode.name;

    if (siblingNames.includes(name)) {
      if (onNameConflict === 'error') {
        return {
          success: false,
          error: `Name "${name}" already exists`,
          code: WorkerErrorCode.VALIDATION_ERROR,
        };
      } else {
        name = createNewName(siblingNames, name);
      }
    }

    // Check for version conflict (optimistic locking)
    const originalVersion = workingCopyNode.version || 1;
    if (originalNode.version > originalVersion) {
      return {
        success: false,
        error: 'Node was modified by another user',
        code: WorkerErrorCode.COMMIT_CONFLICT,
      };
    }

    await coreDB.updateNode({
      ...workingCopyNode,
      id: nodeId,
      parentId,
      isDraft,
      updatedAt: now,
      version: workingCopyNode.version + 1,
    });

    // Delete working copy
    await discardWorkingCopy(coreDB, [workingCopyNodeHolder.id, workingCopyNodeId]);

    return {
      success: true,
      seq: 1 as any,
      nodeId,
    };

    // Update node
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
 * Removes the pair of treeNodes; workging copy holder node and working copy node
 */
export async function discardWorkingCopy(
  coreDB: CoreDB,
  workingCopyNodeIdPair: NodeId[]
): Promise<void> {
  await coreDB.nodes.bulkDelete(workingCopyNodeIdPair);
}

/**
 * Get a working copy by original node ID
 */
export async function getWorkingCopy(
  coreDB: CoreDB,
  originalNodeId: NodeId
): Promise<NodeBase | undefined> {
  const nodes = await coreDB.nodes.where('workingCopyOf').equals(originalNodeId).toArray();
  if (nodes.length > 1) {
    throw new Error('Multiple working copies found for the same nodeId');
  }
  return nodes[0] as NodeBase | undefined;
}

/**
 * Update working copy properties
 */
export async function updateWorkingCopy(
  coreDB: CoreDB,
  nodeId: NodeId,
  updates: Partial<NodeBase>
): Promise<void> {
  const existing = await getWorkingCopy(coreDB, nodeId);
  if (!existing) {
    throw new Error('Working copy not found');
  }

  const updated: NodeBase = {
    ...existing,
    ...updates,
    updatedAt: Date.now() as Timestamp,
  };

  await coreDB.nodes.put(updated);
}

/**
 * Check if a working copy has conflicts with the current node version
 */
export async function checkWorkingCopyConflict(coreDB: CoreDB, nodeId: NodeId): Promise<boolean> {
  const workingCopy = await getWorkingCopy(coreDB, nodeId);
  if (!workingCopy) {
    return false;
  }

  const currentNode = await coreDB.getNode(nodeId);

  if (!currentNode) {
    return false;
  }

  const originalVersion = workingCopy.version || 1;
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
