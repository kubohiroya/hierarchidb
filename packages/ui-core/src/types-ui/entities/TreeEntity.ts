/**
 * @file TreeNodeEntity.ts
 * @description Common abstraction for all tree-bound entities (Resources and Projects)
 */

import type { TreeNodeId } from '@hierarchidb/core';

/**
 * Properties for working copy support
 */
export interface WorkingCopyProperties {
  workingCopyOf?: TreeNodeId; // ID of the original entity if this is a working copy
  copiedAt?: number; // Timestamp when the working copy was created
}

/**
 * Common abstraction for all entities managed within the tree structure
 * This includes both Resources (Shapes, StyleMap, etc.) and Projects
 */
export interface TreeEntity extends WorkingCopyProperties {
  nodeId: TreeNodeId; // Unique identifier for the entity within the tree
  createdAt: number;
  updatedAt: number;
}

/**
 * Type guard to check if an entity is a TreeEntity
 */
export function isTreeEntity(entity: unknown): entity is TreeEntity {
  return (
    entity !== null &&
    typeof entity === 'object' &&
    'nodeId' in entity &&
    typeof (entity as Record<string, unknown>).nodeId === 'string'
  );
}

/**
 * Type guard to check if an entity is a working copy
 */
export function isWorkingCopy(entity: TreeEntity): boolean {
  return !!entity.workingCopyOf;
}

/**
 * Create a working copy from an existing entity
 */
export function createWorkingCopyFrom<T extends TreeEntity>(
  original: T,
  workingCopyId: TreeNodeId
): T {
  return {
    ...original,
    nodeId: workingCopyId,
    workingCopyOf: original.nodeId,
    copiedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Strip working copy properties when committing
 */
export function stripWorkingCopyProperties<T extends TreeEntity>(
  entity: T
): Omit<T, 'workingCopyOf' | 'copiedAt'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { workingCopyOf, copiedAt, ...rest } = entity;
  return rest;
}
