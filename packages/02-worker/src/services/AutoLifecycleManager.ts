/**
 * @file AutoLifecycleManager.ts
 * @description Automatic lifecycle management for entities based on TreeNode operations
 */

import type { NodeId, TreeNodeType } from '@hierarchidb/00-core';
import type { EntityMetadata } from '@hierarchidb/00-core';
import type Dexie from 'dexie';
import { EntityRegistrationService } from './EntityRegistrationService';
import { WorkingCopyManager, WorkingCopySession } from './WorkingCopyManager';

/**
 * Automatic lifecycle manager for entities
 * Handles create, delete, duplicate operations based on TreeNode lifecycle events
 */
export class AutoLifecycleManager {
  // Operation orders for consistency - to be implemented
  // DELETE_ORDER: ['relational', 'group', 'peer'];
  // COMMIT_ORDER: ['peer', 'group', 'relational'];

  constructor(
    private registrationService: EntityRegistrationService,
    private workingCopyManager: WorkingCopyManager,
    private database: Dexie
  ) {}

  /**
   * Handle TreeNode creation - create associated entities
   */
  async onNodeCreate(nodeId: NodeId, nodeType: TreeNodeType): Promise<void> {
    const entities = this.registrationService.getEntitiesByNodeType(nodeType);
    if (entities.length === 0) return;

    const tableNames = entities.map(e => e.tableName);
    
    await this.database.transaction('rw', tableNames, async () => {
      for (const entityMeta of entities) {
        await this.createEntityIfNeeded(nodeId, entityMeta);
      }
    });
  }

  /**
   * Handle TreeNode deletion - delete associated entities
   */
  async onNodeDelete(nodeId: NodeId, nodeType: TreeNodeType): Promise<void> {
    const entities = this.registrationService.getEntitiesSortedByType(nodeType, 'delete');
    if (entities.length === 0) return;

    const tableNames = this.getAllTableNames(entities);

    await this.database.transaction('rw', tableNames, async () => {
      for (const entityMeta of entities) {
        await this.deleteEntityWithCleanup(nodeId, entityMeta);
      }
    });
  }

  /**
   * Handle TreeNode duplication - duplicate associated entities
   */
  async onNodeDuplicate(
    sourceNodeId: NodeId,
    targetNodeId: NodeId,
    nodeType: TreeNodeType
  ): Promise<void> {
    const entities = this.registrationService.getEntitiesByNodeType(nodeType);
    if (entities.length === 0) return;

    const tableNames = this.getAllTableNames(entities);

    await this.database.transaction('rw', tableNames, async () => {
      for (const entityMeta of entities) {
        await this.duplicateEntity(sourceNodeId, targetNodeId, entityMeta);
      }
    });
  }

  /**
   * Create working copies for all enabled entities
   */
  async createWorkingCopies(nodeId: NodeId, nodeType: TreeNodeType): Promise<WorkingCopySession> {
    const entities = this.registrationService.getEntitiesByNodeType(nodeType);
    const session = new WorkingCopySession(nodeId);

    for (const entityMeta of entities) {
      if (entityMeta.workingCopyConfig?.enabled) {
        try {
          const workingCopy = await this.workingCopyManager.create(nodeId, entityMeta);
          session.addWorkingCopy(entityMeta.tableName, workingCopy);
        } catch (error) {
          // Skip if entity doesn't exist or other issues
          console.warn(`Failed to create working copy for ${entityMeta.tableName}:`, error);
        }
      }
    }

    return session;
  }

  /**
   * Commit working copies in correct order
   */
  async commitWorkingCopies(session: WorkingCopySession): Promise<void> {
    const nodeType = await this.getNodeTypeFromSession(session);
    if (!nodeType) return;

    const entities = this.registrationService.getEntitiesSortedByType(nodeType, 'commit');
    const relevantEntities = entities.filter(e => 
      session.getTableNames().includes(e.tableName)
    );

    if (relevantEntities.length === 0) return;

    const tableNames = this.getAllTableNames(relevantEntities);

    await this.database.transaction('rw', tableNames, async () => {
      for (const entityMeta of relevantEntities) {
        await this.workingCopyManager.commit(session, entityMeta);
      }
    });
  }

  /**
   * Discard working copies without committing
   */
  async discardWorkingCopies(session: WorkingCopySession): Promise<void> {
    const nodeType = await this.getNodeTypeFromSession(session);
    if (!nodeType) return;

    const entities = this.registrationService.getEntitiesByNodeType(nodeType);
    const relevantEntities = entities.filter(e => 
      session.getTableNames().includes(e.tableName)
    );

    if (relevantEntities.length === 0) return;

    const workingCopyStores = relevantEntities
      .map(e => e.workingCopyConfig?.tableName)
      .filter(Boolean) as string[];

    await this.database.transaction('rw', workingCopyStores, async () => {
      for (const entityMeta of relevantEntities) {
        await this.workingCopyManager.discard(session, entityMeta);
      }
    });
  }

  /**
   * Create entity if it should be auto-created
   */
  private async createEntityIfNeeded(nodeId: NodeId, entityMeta: EntityMetadata): Promise<void> {
    // Only auto-create peer entities by default
    if (entityMeta.entityType !== 'peer') return;

    const table = this.database.table(entityMeta.tableName);
    
    // Check if entity already exists
    const existing = await table.get(nodeId);
    if (existing) return;

    // Create basic entity
    const entity = {
      [entityMeta.relationship.foreignKeyField]: nodeId,
      createdAt: Date.now(),
    };

    await table.add(entity);
  }

  /**
   * Delete entity with proper cleanup
   */
  private async deleteEntityWithCleanup(nodeId: NodeId, entityMeta: EntityMetadata): Promise<void> {
    const table = this.database.table(entityMeta.tableName);

    if (entityMeta.entityType === 'relational') {
      // Handle relational entities - update reference counts
      await this.cleanupRelationalReferences(nodeId, entityMeta);
    } else if (entityMeta.relationship.cascadeDelete) {
      // Delete peer/group entities if cascade delete is enabled
      if (entityMeta.relationship.type === 'one-to-one') {
        await table.delete(nodeId);
      } else {
        // one-to-many: delete by foreign key
        await table.where(entityMeta.relationship.foreignKeyField).equals(nodeId).delete();
      }

      // Clean up working copies
      if (entityMeta.workingCopyConfig?.enabled) {
        const workingCopyStore = entityMeta.workingCopyConfig.tableName;
        await this.database.table(workingCopyStore)
          .where('workingCopyOf').equals(nodeId).delete();
      }
    }
  }

  /**
   * Duplicate entity with proper handling for different types
   */
  private async duplicateEntity(
    sourceNodeId: NodeId,
    targetNodeId: NodeId,
    entityMeta: EntityMetadata
  ): Promise<void> {
    const table = this.database.table(entityMeta.tableName);

    if (entityMeta.entityType === 'peer') {
      // Duplicate peer entity
      const sourceEntity = await table.get(sourceNodeId);
      if (!sourceEntity) return;

      const duplicatedEntity = {
        ...sourceEntity,
        [entityMeta.relationship.foreignKeyField]: targetNodeId,
        createdAt: Date.now(),
      };

      await table.add(duplicatedEntity);
    } else if (entityMeta.entityType === 'group') {
      // Duplicate group entities
      const sourceEntities = await table
        .where(entityMeta.relationship.foreignKeyField).equals(sourceNodeId)
        .toArray();

      for (const entity of sourceEntities) {
        const duplicatedEntity = {
          ...entity,
          [entityMeta.relationship.foreignKeyField]: targetNodeId,
          createdAt: Date.now(),
        };
        delete duplicatedEntity[entity.primaryKey || 'id']; // Remove primary key
        await table.add(duplicatedEntity);
      }
    } else if (entityMeta.entityType === 'relational') {
      // For relational entities, increment reference count instead of duplicating
      await this.handleRelationalDuplication(sourceNodeId, targetNodeId, entityMeta);
    }
  }

  /**
   * Clean up relational entity references
   */
  private async cleanupRelationalReferences(nodeId: NodeId, entityMeta: EntityMetadata): Promise<void> {
    if (!entityMeta.referenceManagement) return;

    const table = this.database.table(entityMeta.tableName);
    const { nodeListField } = entityMeta.referenceManagement;

    // Find all relational entities that reference this node
    const referencingEntities = await table
      .filter((entity: any) => {
        const nodeList = entity[nodeListField] || [];
        return Array.isArray(nodeList) && nodeList.includes(nodeId);
      })
      .toArray();

    // Update each referencing entity
    for (const entity of referencingEntities) {
      await this.workingCopyManager.updateRelationalReference(
        entity.id || entity.primaryKey,
        nodeId,
        'remove',
        entityMeta
      );
    }
  }

  /**
   * Handle relational entity duplication by incrementing references
   */
  private async handleRelationalDuplication(
    sourceNodeId: NodeId,
    targetNodeId: NodeId,
    entityMeta: EntityMetadata
  ): Promise<void> {
    if (!entityMeta.referenceManagement) return;

    const table = this.database.table(entityMeta.tableName);
    const { nodeListField } = entityMeta.referenceManagement;

    // Find relational entities referenced by source node
    const referencingEntities = await table
      .filter((entity: any) => {
        const nodeList = entity[nodeListField] || [];
        return Array.isArray(nodeList) && nodeList.includes(sourceNodeId);
      })
      .toArray();

    // Add target node to each referenced entity
    for (const entity of referencingEntities) {
      await this.workingCopyManager.updateRelationalReference(
        entity.id || entity.primaryKey,
        targetNodeId,
        'add',
        entityMeta
      );
    }
  }

  /**
   * Get all table names including working copy tables
   */
  private getAllTableNames(entities: EntityMetadata[]): string[] {
    const tableNames = new Set<string>();
    
    for (const entity of entities) {
      tableNames.add(entity.tableName);
      if (entity.workingCopyConfig?.enabled) {
        tableNames.add(entity.workingCopyConfig.tableName);
      }
    }
    
    return Array.from(tableNames);
  }

  /**
   * Get node type from working copy session (helper method)
   */
  private async getNodeTypeFromSession(session: WorkingCopySession): Promise<TreeNodeType | null> {
    // This is a simplified approach - in practice, you might want to table
    // node type information in the session or look it up from the database
    const tableNames = session.getTableNames();
    if (tableNames.length === 0) return null;

    // Find node type by matching table names with registered entities
    // This is a basic implementation - could be optimized
    for (const [nodeType, entityKeys] of (this.registrationService as any).nodeTypeToEntities) {
      const entities = entityKeys.map((key: string) => 
        (this.registrationService as any).registrations.get(key)
      ).filter(Boolean);
      
      const entityTableNames = entities.map((e: EntityMetadata) => e.tableName);
      
      if (tableNames.some(table => entityTableNames.includes(table))) {
        return nodeType;
      }
    }

    return null;
  }
}