/**
 * @file FolderEntity.ts
 * @description Folder entity definition for TreeEntity architecture
 */

import type { TreeEntity } from './TreeEntity';
import type { TreeNodeId } from '../nodes';

/**
 * Folder types
 */
export type FolderType = 'resource' | 'project';

/**
 * Folder metadata for future extensions
 */
export interface FolderMetadata {
  color?: string;
  icon?: string;
  sortOrder?: 'name' | 'created' | 'modified';
  defaultView?: 'grid' | 'list' | 'tree';
}

/**
 * Folder entity that extends TreeEntity
 *
 * Folders are special TreeEntities that:
 * - Act as containers for other nodes
 * - Have minimal data (mainly metadata)
 * - Support WorkingCopy pattern for draft editing
 */
export interface FolderEntity extends TreeEntity {
  /**
   * Type of folder (resource or project)
   */
  folderType: FolderType;

  /**
   * Folder name (duplicated from TreeNode for convenience)
   */
  name: string;

  /**
   * Folder description (duplicated from TreeNode for convenience)
   */
  description?: string;

  /**
   * Optional metadata for future extensions
   */
  metadata?: FolderMetadata;
}

/**
 * Check if a TreeEntity is a FolderEntity
 */
export function isFolderEntity(entity: TreeEntity): entity is FolderEntity {
  return 'folderType' in entity;
}

/**
 * Create a new FolderEntity
 */
export function createFolderEntity(
  nodeId: TreeNodeId,
  folderType: FolderType,
  name: string,
  description?: string
): FolderEntity {
  return {
    nodeId: nodeId as TreeNodeId,
    folderType,
    name,
    description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a working copy FolderEntity (for draft editing)
 * Both nodeId and workingCopyOf use the same UUID
 */
export function createFolderWorkingCopy(
  workingCopyId: TreeNodeId,
  folderType: FolderType,
  name: string,
  description?: string
): FolderEntity {
  return {
    nodeId: workingCopyId,
    workingCopyOf: workingCopyId, // Same UUID for both id and workingCopyOf
    folderType,
    name,
    description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    copiedAt: Date.now(),
  };
}
