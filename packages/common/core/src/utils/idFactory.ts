/**
 * @file idFactory.ts
 * @description Type-safe ID factory functions
 * Improves type safety by providing validation and proper casting
 */

import type { NodeId, TreeId, EntityId } from '../types/ids';

/**
 * UUID v4 pattern validation
 */
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Basic ID format validation (non-empty string)
 */
const BASIC_ID_PATTERN = /^.+$/;

/**
 * NodeId format validation
 * Currently accepts any non-empty string, can be made stricter if needed
 */
export function isValidNodeIdString(id: string): boolean {
  return BASIC_ID_PATTERN.test(id) && id.length <= 255; // Reasonable length limit
}

/**
 * TreeId format validation  
 * Currently accepts any non-empty string, can be made stricter if needed
 */
export function isValidTreeIdString(id: string): boolean {
  return BASIC_ID_PATTERN.test(id) && id.length <= 255;
}

/**
 * EntityId format validation
 * Expects UUID v4 format for entities
 */
export function isValidEntityIdString(id: string): boolean {
  return UUID_V4_PATTERN.test(id);
}

/**
 * Create a validated NodeId from string
 * Throws error if the string format is invalid
 */
export function createNodeId(id: string): NodeId {
  if (!id || typeof id !== 'string') {
    throw new Error('NodeId must be a non-empty string');
  }
  
  if (!isValidNodeIdString(id)) {
    throw new Error(`Invalid NodeId format: ${id}`);
  }
  
  return id as NodeId;
}

/**
 * Create a validated TreeId from string
 * Throws error if the string format is invalid
 */
export function createTreeId(id: string): TreeId {
  if (!id || typeof id !== 'string') {
    throw new Error('TreeId must be a non-empty string');
  }
  
  if (!isValidTreeIdString(id)) {
    throw new Error(`Invalid TreeId format: ${id}`);
  }
  
  return id as TreeId;
}

/**
 * Create a validated EntityId from string
 * Throws error if the string format is invalid
 */
export function createEntityId(id?: string): EntityId {
  if (id) {
    if (typeof id !== 'string') {
      throw new Error('EntityId must be a string');
    }
    
    if (!isValidEntityIdString(id)) {
      throw new Error(`Invalid EntityId format (must be UUID v4): ${id}`);
    }
    
    return id as EntityId;
  }
  
  // Generate new UUID v4 if no ID provided
  return generateEntityId();
}

/**
 * Generate a new NodeId
 * Uses crypto.randomUUID() for uniqueness
 */
export function generateNodeId(): NodeId {
  return crypto.randomUUID() as NodeId;
}

/**
 * Generate a new TreeId
 * Uses crypto.randomUUID() for uniqueness
 */
export function generateTreeId(): TreeId {
  return crypto.randomUUID() as TreeId;
}

/**
 * @deprecated Use generateEntityId from types/ids instead
 * Generate a new EntityId
 * Uses crypto.randomUUID() for uniqueness
 */
export function generateEntityId(): EntityId {
  return crypto.randomUUID() as EntityId;
}

/**
 * Safe conversion from unknown to NodeId with validation
 */
export function toNodeId(value: unknown): NodeId {
  if (typeof value !== 'string') {
    throw new Error('NodeId must be a string');
  }
  return createNodeId(value);
}

/**
 * Safe conversion from unknown to TreeId with validation
 */
export function toTreeId(value: unknown): TreeId {
  if (typeof value !== 'string') {
    throw new Error('TreeId must be a string');
  }
  return createTreeId(value);
}

/**
 * Safe conversion from unknown to EntityId with validation
 */
export function toEntityId(value: unknown): EntityId {
  if (typeof value !== 'string') {
    throw new Error('EntityId must be a string');
  }
  return createEntityId(value);
}

/**
 * Type-safe array filtering for NodeIds
 */
export function filterValidNodeIds(values: unknown[]): NodeId[] {
  return values.filter((value): value is NodeId => {
    return typeof value === 'string' && isValidNodeIdString(value);
  }) as NodeId[];
}

/**
 * Type-safe array filtering for TreeIds
 */
export function filterValidTreeIds(values: unknown[]): TreeId[] {
  return values.filter((value): value is TreeId => {
    return typeof value === 'string' && isValidTreeIdString(value);
  }) as TreeId[];
}

/**
 * Type-safe array filtering for EntityIds
 */
export function filterValidEntityIds(values: unknown[]): EntityId[] {
  return values.filter((value): value is EntityId => {
    return typeof value === 'string' && isValidEntityIdString(value);
  }) as EntityId[];
}

/**
 * Batch validation for multiple NodeIds
 */
export function validateNodeIds(ids: string[]): NodeId[] {
  const result: NodeId[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < ids.length; i++) {
    try {
      const id = ids[i];
      if (id !== undefined) {
        result.push(createNodeId(id));
      } else {
        errors.push(`Index ${i}: ID is undefined`);
      }
    } catch (error) {
      errors.push(`Index ${i}: ${error instanceof Error ? error.message : 'Invalid format'}`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`NodeId validation failed:\n${errors.join('\n')}`);
  }
  
  return result;
}

/**
 * Check if a value is a valid NodeId without throwing
 */
export function isNodeId(value: unknown): value is NodeId {
  return typeof value === 'string' && isValidNodeIdString(value);
}

/**
 * Check if a value is a valid TreeId without throwing
 */
export function isTreeId(value: unknown): value is TreeId {
  return typeof value === 'string' && isValidTreeIdString(value);
}

/**
 * Check if a value is a valid EntityId without throwing
 */
export function isEntityId(value: unknown): value is EntityId {
  return typeof value === 'string' && isValidEntityIdString(value);
}

/**
 * Create NodeIds from string array with error collection
 */
export function createNodeIds(ids: string[]): { valid: NodeId[]; errors: { index: number; id: string; error: string }[] } {
  const valid: NodeId[] = [];
  const errors: { index: number; id: string; error: string }[] = [];
  
  for (let i = 0; i < ids.length; i++) {
    try {
      const id = ids[i];
      if (id !== undefined) {
        valid.push(createNodeId(id));
      } else {
        errors.push({
          index: i,
          id: 'undefined',
          error: 'ID is undefined'
        });
      }
    } catch (error) {
      const id = ids[i] || 'undefined';
      errors.push({
        index: i,
        id: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return { valid, errors };
}

/**
 * Constants for special IDs that are used throughout the system
 */
export const SYSTEM_IDS = {
  // Reserved NodeIds for system use
  SUPER_ROOT_PREFIX: 'SuperRoot',
  ROOT_SUFFIX: 'Root', 
  TRASH_SUFFIX: 'Trash',
} as const;

/**
 * Check if a NodeId is a system-reserved ID
 */
export function isSystemNodeId(nodeId: NodeId): boolean {
  const id = nodeId as string;
  return id.includes(SYSTEM_IDS.SUPER_ROOT_PREFIX) || 
         id.endsWith(SYSTEM_IDS.ROOT_SUFFIX) || 
         id.endsWith(SYSTEM_IDS.TRASH_SUFFIX);
}