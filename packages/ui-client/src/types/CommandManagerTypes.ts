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
import type { TreeNodeId, TreeNodeType } from '@hierarchidb/core';

// Local type definitions to avoid circular dependency
export interface TreeNodeEntity {
  id: TreeNodeId;
  type: TreeNodeType;
  name: string;
  parentId: TreeNodeId;
  description?: string;
  createdAt: number;
  updatedAt: number;
  isDraft: boolean;
  workingCopyOf?: TreeNodeId;
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
  parentId: TreeNodeId;
  name: string;
  type: TreeNodeType;
  description?: string;
  isDraft?: boolean;
}

export interface UpdateNodeParams {
  id: TreeNodeId;
  name?: string;
  description?: string;
}

export interface DuplicateNodesParams {
  ids: TreeNodeId[];
}

export interface RestoreNodesParams {
  nodeIds: TreeNodeId[];
  targetParentId: TreeNodeId;
  trashRootNodeId: TreeNodeId;
  restoreMode?: string;
}

export interface EmptyTrashParams {
  trashRootNodeId: TreeNodeId;
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
 * This allows components to work with either implementation
 */
export interface ICommandManager {
  // Node operations
  getNode(id: TreeNodeId): Promise<TreeNodeEntity | undefined>;
  createNode(
    params: CreateNodeParams & { id?: string },
    ...args: unknown[]
  ): Promise<{ nodeId: TreeNodeId; createdNode?: TreeNodeEntity } | undefined>;
  updateNode(params: UpdateNodeParams, ...args: unknown[]): Promise<boolean>;
  moveToTrash(nodeIds: TreeNodeId[], trashRootNodeId?: TreeNodeId): Promise<unknown>;
  duplicateNodes(params: DuplicateNodesParams, trashRootNodeId?: TreeNodeId): Promise<unknown>;
  moveNode(sourceId: TreeNodeId, targetParentId: TreeNodeId): Promise<TreeNodeEntity>;

  // Undo/Redo
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): Promise<void>;
  redo(): Promise<void>;
  peekUndo(): unknown;
  peekRedo(): unknown;
  clearHistory(): void;

  // Copy/Paste
  copy(nodeIds: TreeNodeId[]): Promise<void>;
  copyNodes(nodeIds: TreeNodeId[]): Promise<void>;
  paste(
    targetParentId: TreeNodeId,
    trashRootNodeId: TreeNodeId
  ): Promise<{ pastedNodeIds: TreeNodeId[] }>;
  pasteNodes(
    targetParentId: TreeNodeId,
    trashRootNodeId: TreeNodeId
  ): Promise<{ pastedNodeIds: TreeNodeId[] }>;
  hasCopyBuffer(): boolean;
  clearCopyBuffer(): void;

  // Import/Export
  importNodes(
    parentId: TreeNodeId,
    json: DescendantNodeJson[],
    trashRootNodeId?: TreeNodeId
  ): Promise<unknown>;

  // Trash operations
  recoverFromTrash(
    nodeIds: TreeNodeId[],
    targetParentId: TreeNodeId,
    trashRootNodeId: TreeNodeId,
    restoreMode?: string
  ): Promise<unknown>;
  emptyTrash(params: EmptyTrashParams): Promise<void>;

  // Working copy operations
  createWorkingCopy(params: {
    originalNodeId?: TreeNodeId;
    parentId?: TreeNodeId;
    nodeType?: TreeNodeType;
    template?: Partial<TreeNodeEntity>;
  }): Promise<TreeNodeEntityWithChildren>;
  commitWorkingCopy(
    workingCopyId: TreeNodeId,
    nodeType: TreeNodeType,
    keepDraft?: boolean
  ): Promise<TreeNodeId>;
  discardWorkingCopy(workingCopyId: TreeNodeId, resourceType: string): Promise<void>;

  // Project operations
  restoreProjectsWithCleanup(
    nodeIds: TreeNodeId[],
    targetParentId: TreeNodeId,
    trashRootNodeId: TreeNodeId
  ): Promise<unknown>;
  previewProjectRestoreCleanup(projectIds?: TreeNodeId[]): Promise<unknown>;
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
