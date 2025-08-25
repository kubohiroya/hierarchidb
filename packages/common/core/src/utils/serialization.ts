/**
 * @file serialization.ts
 * @description Type-safe JSON serialization and deserialization utilities
 * Prevents type information loss during JSON operations
 */

import type { TreeNode, Tree } from '../types';
import { createNodeId, createTreeId, isNodeId, isTreeId, isEntityId } from './idFactory';

/**
 * Validation schema for TreeNode
 */
interface TreeNodeSchema {
  id: unknown;
  parentId: unknown;
  nodeType: unknown;
  name: unknown;
  description?: unknown;
  createdAt: unknown;
  updatedAt: unknown;
  version: unknown;
  // Optional properties
  hasChildren?: unknown;
  descendantCount?: unknown;
  isEstimated?: unknown;
  references?: unknown[];
  originalName?: unknown;
  originalParentNodeId?: unknown;
  removedAt?: unknown;
  isRemoved?: unknown;
  isDraft?: unknown;
}

/**
 * Validation schema for Tree
 */
interface TreeSchema {
  id: unknown;
  name: unknown;
  rootId: unknown;
  trashRootId: unknown;
  superRootId: unknown;
}

/**
 * Generic validation error
 */
export class ValidationError extends Error {
  constructor(field: string, expected: string, received: unknown) {
    super(
      `Validation failed for field '${field}': expected ${expected}, received ${typeof received} (${received})`
    );
    this.name = 'ValidationError';
  }
}

/**
 * Validate and convert unknown data to TreeNode
 */
export function deserializeTreeNode(data: unknown): TreeNode {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('root', 'object', data);
  }

  const obj = data as TreeNodeSchema;

  // Required fields validation
  if (typeof obj.id !== 'string') {
    throw new ValidationError('id', 'string', obj.id);
  }
  if (typeof obj.parentId !== 'string') {
    throw new ValidationError('parentId', 'string', obj.parentId);
  }
  if (typeof obj.nodeType !== 'string') {
    throw new ValidationError('nodeType', 'string', obj.nodeType);
  }
  if (typeof obj.name !== 'string') {
    throw new ValidationError('name', 'string', obj.name);
  }
  if (typeof obj.createdAt !== 'number') {
    throw new ValidationError('createdAt', 'number', obj.createdAt);
  }
  if (typeof obj.updatedAt !== 'number') {
    throw new ValidationError('updatedAt', 'number', obj.updatedAt);
  }
  if (typeof obj.version !== 'number') {
    throw new ValidationError('version', 'number', obj.version);
  }

  // Create validated TreeNode with proper types
  const treeNode: TreeNode = {
    id: createNodeId(obj.id),
    parentId: createNodeId(obj.parentId),
    nodeType: obj.nodeType,
    name: obj.name,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    version: obj.version,
  };

  // Optional fields
  if (obj.description !== undefined && typeof obj.description === 'string') {
    treeNode.description = obj.description;
  }
  if (obj.hasChildren !== undefined && typeof obj.hasChildren === 'boolean') {
    treeNode.hasChildren = obj.hasChildren;
  }
  if (obj.descendantCount !== undefined && typeof obj.descendantCount === 'number') {
    treeNode.descendantCount = obj.descendantCount;
  }
  if (obj.isEstimated !== undefined && typeof obj.isEstimated === 'boolean') {
    treeNode.isEstimated = obj.isEstimated;
  }
  if (obj.isDraft !== undefined && typeof obj.isDraft === 'boolean') {
    treeNode.isDraft = obj.isDraft;
  }
  if (obj.isRemoved !== undefined && typeof obj.isRemoved === 'boolean') {
    treeNode.isRemoved = obj.isRemoved;
  }
  if (obj.removedAt !== undefined && typeof obj.removedAt === 'number') {
    treeNode.removedAt = obj.removedAt;
  }

  // Array fields
  if (obj.references !== undefined) {
    if (!Array.isArray(obj.references)) {
      throw new ValidationError('references', 'array', obj.references);
    }
    treeNode.references = obj.references.filter((ref) => typeof ref === 'string').map(createNodeId);
  }

  // Trash-related fields
  if (obj.originalName !== undefined && typeof obj.originalName === 'string') {
    treeNode.originalName = obj.originalName;
  }
  if (obj.originalParentNodeId !== undefined && typeof obj.originalParentNodeId === 'string') {
    treeNode.originalParentId = createNodeId(obj.originalParentNodeId);
  }

  return treeNode;
}

/**
 * Validate and convert unknown data to Tree
 */
export function deserializeTree(data: unknown): Tree {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('root', 'object', data);
  }

  const obj = data as TreeSchema;

  // Required fields validation
  if (typeof obj.id !== 'string') {
    throw new ValidationError('id', 'string', obj.id);
  }
  if (typeof obj.name !== 'string') {
    throw new ValidationError('name', 'string', obj.name);
  }
  if (typeof obj.rootId !== 'string') {
    throw new ValidationError('rootNodeId', 'string', obj.rootId);
  }
  if (typeof obj.trashRootId !== 'string') {
    throw new ValidationError('trashRootNodeId', 'string', obj.trashRootId);
  }
  if (typeof obj.superRootId !== 'string') {
    throw new ValidationError('superRootNodeId', 'string', obj.superRootId);
  }

  return {
    id: createTreeId(obj.id),
    name: obj.name,
    rootId: createNodeId(obj.rootId),
    trashRootId: createNodeId(obj.trashRootId),
    superRootId: createNodeId(obj.superRootId),
  };
}

/**
 * Serialize TreeNode to JSON-safe object
 * Preserves type information in the structure
 */
export function serializeTreeNode(node: TreeNode): Record<string, unknown> {
  return {
    id: node.id as string,
    parentId: node.parentId as string,
    nodeType: node.nodeType,
    name: node.name,
    description: node.description,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    version: node.version,
    hasChildren: node.hasChildren,
    descendantCount: node.descendantCount,
    isEstimated: node.isEstimated,
    references: node.references?.map((ref: any) => ref as string),
    originalName: node.originalName,
    originalParentNodeId: node.originalParentId as string | undefined,
    removedAt: node.removedAt,
    isRemoved: node.isRemoved,
    isDraft: node.isDraft,
  };
}

/**
 * Serialize Tree to JSON-safe object
 */
export function serializeTree(tree: Tree): Record<string, unknown> {
  return {
    id: tree.id as string,
    name: tree.name,
    rootNodeId: tree.rootId as string,
    trashRootNodeId: tree.trashRootId as string,
    superRootNodeId: tree.superRootId as string,
  };
}

/**
 * Safe JSON parsing with type validation
 */
export function parseTreeNode(json: string): TreeNode {
  try {
    const data = JSON.parse(json);
    return deserializeTreeNode(data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Safe JSON parsing for Tree
 */
export function parseTree(json: string): Tree {
  try {
    const data = JSON.parse(json);
    return deserializeTree(data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Batch deserialization for TreeNode arrays
 */
export function deserializeTreeNodes(dataArray: unknown[]): {
  valid: TreeNode[];
  errors: { index: number; error: string }[];
} {
  const valid: TreeNode[] = [];
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < dataArray.length; i++) {
    try {
      valid.push(deserializeTreeNode(dataArray[i]));
    } catch (error) {
      errors.push({
        index: i,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { valid, errors };
}

/**
 * Validate ID fields in raw data without full deserialization
 */
export function validateIds(data: unknown): {
  hasValidNodeIds: boolean;
  hasValidTreeIds: boolean;
  hasValidEntityIds: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let hasValidNodeIds = true;
  let hasValidTreeIds = true;
  let hasValidEntityIds = true;

  if (!data || typeof data !== 'object') {
    errors.push('Data is not an object');
    return { hasValidNodeIds: false, hasValidTreeIds: false, hasValidEntityIds: false, errors };
  }

  const obj = data as Record<string, unknown>;

  // Check common NodeId fields
  const nodeIdFields = ['id', 'parentId', 'nodeId', 'originalParentNodeId'];
  for (const field of nodeIdFields) {
    if (obj[field] !== undefined) {
      if (!isNodeId(obj[field])) {
        hasValidNodeIds = false;
        errors.push(`Invalid NodeId in field '${field}': ${obj[field]}`);
      }
    }
  }

  // Check TreeId fields
  const treeIdFields = ['treeId'];
  for (const field of treeIdFields) {
    if (obj[field] !== undefined) {
      if (!isTreeId(obj[field])) {
        hasValidTreeIds = false;
        errors.push(`Invalid TreeId in field '${field}': ${obj[field]}`);
      }
    }
  }

  // Check EntityId fields
  const entityIdFields = ['entityId'];
  for (const field of entityIdFields) {
    if (obj[field] !== undefined) {
      if (!isEntityId(obj[field])) {
        hasValidEntityIds = false;
        errors.push(`Invalid EntityId in field '${field}': ${obj[field]}`);
      }
    }
  }

  return { hasValidNodeIds, hasValidTreeIds, hasValidEntityIds, errors };
}

/**
 * Clean serialization - removes undefined values and ensures proper types
 */
export function cleanSerialize<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      // Convert branded types to strings
      if (isNodeId(value) || isTreeId(value) || isEntityId(value)) {
        cleaned[key] = value as string;
      } else if (Array.isArray(value)) {
        // Handle arrays of IDs
        cleaned[key] = value.map((item: any) =>
          isNodeId(item) || isTreeId(item) || isEntityId(item) ? (item as string) : item
        );
      } else {
        cleaned[key] = value;
      }
    }
  }

  return cleaned;
}

/**
 * Export data structure information for debugging
 */
export function analyzeDataStructure(data: unknown): {
  type: string;
  hasIds: boolean;
  idFields: string[];
  structure: Record<string, string>;
} {
  const result = {
    type: typeof data,
    hasIds: false,
    idFields: [] as string[],
    structure: {} as Record<string, string>,
  };

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    for (const [key, value] of Object.entries(obj)) {
      result.structure[key] = typeof value;

      // Check if field contains ID-like values
      if (
        typeof value === 'string' &&
        (key.toLowerCase().includes('id') ||
          isNodeId(value) ||
          isTreeId(value) ||
          isEntityId(value))
      ) {
        result.hasIds = true;
        result.idFields.push(key);
      }
    }
  }

  return result;
}
