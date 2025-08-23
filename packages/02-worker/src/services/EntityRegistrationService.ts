/**
 * @file EntityRegistrationService.ts
 * @description Service for registering and managing entity metadata for automatic lifecycle management
 */

import type { TreeNodeType } from '@hierarchidb/00-core';
import type { EntityMetadata, EntityType } from '@hierarchidb/00-core';

/**
 * Service for registering and retrieving entity metadata
 */
export class EntityRegistrationService {
  private registrations = new Map<string, EntityMetadata>();
  private nodeTypeToEntities = new Map<TreeNodeType, string[]>();

  /**
   * Register entity metadata for a node type
   */
  registerEntity(
    nodeType: TreeNodeType,
    entityKey: string,
    metadata: EntityMetadata
  ): void {
    // Check for duplicate registration
    if (this.registrations.has(entityKey)) {
      throw new Error(`Entity key already registered: ${entityKey}`);
    }

    // Validate metadata
    this.validateEntityMetadata(metadata);

    // Store metadata
    this.registrations.set(entityKey, metadata);

    // Update node type index
    const entities = this.nodeTypeToEntities.get(nodeType) || [];
    entities.push(entityKey);
    this.nodeTypeToEntities.set(nodeType, entities);
  }

  /**
   * Get all entities for a node type
   */
  getEntitiesByNodeType(nodeType: TreeNodeType): EntityMetadata[] {
    const entityKeys = this.nodeTypeToEntities.get(nodeType) || [];
    return entityKeys
      .map(key => this.registrations.get(key))
      .filter((metadata): metadata is EntityMetadata => metadata !== undefined);
  }

  /**
   * Get entity by key
   */
  getEntityByKey(entityKey: string): EntityMetadata | undefined {
    return this.registrations.get(entityKey);
  }

  /**
   * Get entities sorted by type for specific operation
   */
  getEntitiesSortedByType(
    nodeType: TreeNodeType,
    operation: 'delete' | 'commit'
  ): EntityMetadata[] {
    const entities = this.getEntitiesByNodeType(nodeType);
    
    // Define sort order based on operation
    const sortOrder: EntityType[] = 
      operation === 'delete' 
        ? ['relational', 'group', 'peer']
        : ['peer', 'group', 'relational'];

    // Sort entities by type
    return entities.sort((a, b) => {
      const aIndex = sortOrder.indexOf(a.entityType);
      const bIndex = sortOrder.indexOf(b.entityType);
      return aIndex - bIndex;
    });
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.registrations.clear();
    this.nodeTypeToEntities.clear();
  }

  /**
   * Validate entity metadata
   */
  private validateEntityMetadata(metadata: EntityMetadata): void {
    if (!metadata.tableName || !metadata.relationship) {
      throw new Error('Invalid entity metadata: missing required fields');
    }

    if (!metadata.relationship.foreignKeyField) {
      throw new Error('Invalid entity metadata: missing foreignKeyField');
    }

    // Validate entity type
    const validTypes: EntityType[] = ['peer', 'group', 'relational'];
    if (!validTypes.includes(metadata.entityType)) {
      throw new Error(`Invalid entity type: ${metadata.entityType}`);
    }

    // Validate relationship type
    const validRelationships = ['one-to-one', 'one-to-many', 'many-to-many'];
    if (!validRelationships.includes(metadata.relationship.type)) {
      throw new Error(`Invalid relationship type: ${metadata.relationship.type}`);
    }

    // Validate reference management for relational entities
    if (metadata.entityType === 'relational' && metadata.referenceManagement) {
      const refMgmt = metadata.referenceManagement;
      if (!refMgmt.countField || !refMgmt.nodeListField) {
        throw new Error('Invalid reference management: missing required fields');
      }
    }
  }
}