/**
 * @file CommandManagerTypes.ts
 * @description Type definitions for CommandManager internal methods
 * @module features/tree-data/types
 */

// Define Command and UndoCommand types locally
interface Command<T = unknown, R = unknown> {
  execute(): Promise<R>;
  undo?(): Promise<void>;
  data?: T;
}

interface UndoCommand extends Command {
  id: string;
  undo(): Promise<void>;
}
import type { NodeId, TreeNodeType } from '@hierarchidb/00-core';

// Local type definitions to avoid circular dependency
export interface TreeNodeEntity {
  id: NodeId;
  type: TreeNodeType;
  name: string;
  parentId: NodeId;
  description?: string;
  createdAt: number;
  updatedAt: number;
  isDraft: boolean;
  workingCopyOf?: NodeId;
}

export interface TreeNodeEntityWithChildren extends TreeNodeEntity {
  children?: TreeNodeEntityWithChildren[];
}

export interface DescendantNodeJson {
  name: string;
  description?: string;
  type: TreeNodeType;
  isDraft?: boolean;
  hasChildren?: boolean;
  children?: DescendantNodeJson[];
}

// Parameter types for command operations
export interface CreateNodeParams {
  parentId: NodeId;
  name: string;
  type: TreeNodeType;
  description?: string;
  isDraft?: boolean;
}

export interface UpdateNodeParams {
  id: NodeId;
  name?: string;
  description?: string;
}

export interface DuplicateNodesParams {
  ids: NodeId[];
}

export interface RestoreNodesParams {
  nodeIds: NodeId[];
  targetParentId: NodeId;
  trashRootNodeId: NodeId;
  restoreMode?: string;
}

export interface EmptyTrashParams {
  trashRootNodeId: NodeId;
}

/**
 * Extended CommandManager interface with internal methods
 * Used for accessing protected methods in specific contexts
 */
export interface CommandManagerInternal {
  peekUndo(): Command<unknown, unknown> | undefined;
  peekRedo(): Command<unknown, unknown> | undefined;
}

/**
 * Common interface that both CommandManager and WorkerCommandManager implement
 * This allows containers to work with either implementation
 */
export interface ICommandManager {
  // Node operations
  getNode(id: NodeId): Promise<TreeNodeEntity | undefined>;
  createNode(
    params: CreateNodeParams & { id?: string },
    ...args: unknown[]
  ): Promise<{ nodeId: NodeId; createdNode?: TreeNodeEntity } | undefined>;
  updateNode(params: UpdateNodeParams, ...args: unknown[]): Promise<boolean>;
  moveToTrash(nodeIds: NodeId[], trashRootNodeId?: NodeId): Promise<unknown>;
  duplicateNodes(params: DuplicateNodesParams, trashRootNodeId?: NodeId): Promise<unknown>;
  moveNode(sourceId: NodeId, targetParentId: NodeId): Promise<TreeNodeEntity>;

  // Undo/Redo
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): Promise<void>;
  redo(): Promise<void>;
  peekUndo(): unknown;
  peekRedo(): unknown;
  clearHistory(): void;

  // Copy/Paste
  copy(nodeIds: NodeId[]): Promise<void>;
  copyNodes(nodeIds: NodeId[]): Promise<void>;
  paste(
    targetParentId: NodeId,
    trashRootNodeId: NodeId
  ): Promise<{ pastedNodeIds: NodeId[] }>;
  pasteNodes(
    targetParentId: NodeId,
    trashRootNodeId: NodeId
  ): Promise<{ pastedNodeIds: NodeId[] }>;
  hasCopyBuffer(): boolean;
  clearCopyBuffer(): void;

  // Import/Export
  importNodes(
    parentId: NodeId,
    json: DescendantNodeJson[],
    trashRootNodeId?: NodeId
  ): Promise<unknown>;

  // Trash operations
  recoverFromTrash(
    nodeIds: NodeId[],
    targetParentId: NodeId,
    trashRootNodeId: NodeId,
    restoreMode?: string
  ): Promise<unknown>;
  emptyTrash(params: EmptyTrashParams): Promise<void>;

  // Working copy operations
  createWorkingCopy(params: {
    originalNodeId?: NodeId;
    parentId?: NodeId;
    nodeType?: TreeNodeType;
    template?: Partial<TreeNodeEntity>;
  }): Promise<TreeNodeEntityWithChildren>;
  commitWorkingCopy(
    workingCopyId: NodeId,
    nodeType: TreeNodeType,
    keepDraft?: boolean
  ): Promise<NodeId>;
  discardWorkingCopy(workingCopyId: NodeId, resourceType: string): Promise<void>;

  // Project operations
  restoreProjectsWithCleanup(
    nodeIds: NodeId[],
    targetParentId: NodeId,
    trashRootNodeId: NodeId
  ): Promise<unknown>;
  previewProjectRestoreCleanup(projectIds?: NodeId[]): Promise<unknown>;
}

/**
 * Type guard to check if a command has an id property
 */
export function hasCommandId(command: unknown): command is UndoCommand {
  return (
    typeof command === 'object' &&
    command !== null &&
    'id' in command &&
    typeof (command as Record<string, unknown>).id === 'string'
  );
}
