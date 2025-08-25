/**
 * Shape Entity Handler - Worker Layer
 * Manages CRUD operations for Shape entities in Worker environment
 */

import { NodeId, EntityId, generateEntityId } from '@hierarchidb/common-core';
import {
  ShapeEntity,
  ShapeWorkingCopy,
  CreateShapeData,
  ProcessingConfig,
  DEFAULT_PROCESSING_CONFIG,
} from '../../shared';

/**
 * Entity handler for Shape plugin in Worker layer
 * Handles database operations and business logic
 */
export class ShapeEntityHandler {
  private table: any; // In real implementation, would use Dexie table

  constructor() {
    // Mock database table implementation
    // In real version, would initialize Dexie table for shapes
    this.table = {
      add: async (entity: any): Promise<any> => {
        console.log('Mock: Adding entity to database', entity);
        return entity;
      },
      get: async (id: any): Promise<any> => {
        console.log('Mock: Getting entity from database', id);
        return null;
      },
      put: async (entity: any): Promise<any> => {
        console.log('Mock: Updating entity in database', entity);
        return entity;
      },
      delete: async (id: any): Promise<void> => {
        console.log('Mock: Deleting entity from database', id);
      },
      where: (field: string) => ({
        equals: (value: any) => ({
          first: async (): Promise<any> => {
            console.log(`Mock: Querying ${field} equals ${value}`);
            return null;
          },
          toArray: async (): Promise<any[]> => {
            console.log(`Mock: Querying ${field} equals ${value} (array)`);
            return [];
          },
        }),
      }),
      orderBy: (field: string) => ({
        reverse: () => ({
          offset: (n: number) => ({
            limit: (n: number) => ({
              toArray: async (): Promise<any[]> => {
                console.log(`Mock: Ordered query ${field} reverse offset ${n} limit ${n}`);
                return [];
              },
            }),
            toArray: async (): Promise<any[]> => {
              console.log(`Mock: Ordered query ${field} reverse offset ${n}`);
              return [];
            },
          }),
          limit: (n: number) => ({
            toArray: async (): Promise<any[]> => {
              console.log(`Mock: Ordered query ${field} reverse limit ${n}`);
              return [];
            },
          }),
          toArray: async (): Promise<any[]> => {
            console.log(`Mock: Ordered query ${field} reverse`);
            return [];
          },
        }),
        offset: (n: number) => ({
          limit: (n: number) => ({
            toArray: async (): Promise<any[]> => {
              console.log(`Mock: Ordered query ${field} offset ${n} limit ${n}`);
              return [];
            },
          }),
          toArray: async (): Promise<any[]> => {
            console.log(`Mock: Ordered query ${field} offset ${n}`);
            return [];
          },
        }),
        limit: (n: number) => ({
          toArray: async (): Promise<any[]> => {
            console.log(`Mock: Ordered query ${field} limit ${n}`);
            return [];
          },
        }),
        toArray: async (): Promise<any[]> => {
          console.log(`Mock: Ordered query ${field}`);
          return [];
        },
      }),
      toCollection: () => ({
        filter: (predicate: any) => ({
          toArray: async (): Promise<any[]> => {
            console.log('Mock: Collection filter query');
            return [];
          },
        }),
      }),
    };
  }

  /**
   * Create a new Shape entity
   */
  async createEntity(nodeId: NodeId, data: CreateShapeData): Promise<ShapeEntity> {
    const entityId = generateEntityId() as EntityId;
    const now = Date.now();

    // Merge with default processing config
    const processingConfig: ProcessingConfig = {
      ...DEFAULT_PROCESSING_CONFIG,
      ...data.processingConfig,
    };

    const entity: ShapeEntity = {
      id: entityId,
      nodeId: nodeId,
      name: data.name,
      description: data.description || '',
      dataSourceName: data.dataSourceName as any,
      licenseAgreement: false, // Always starts false, user must agree in UI
      processingConfig,
      checkboxState: '[]', // Serialized empty array
      selectedCountries: [],
      adminLevels: [],
      urlMetadata: [],
      processingStatus: 'idle',
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    try {
      await this.table.add(entity);
      console.log(`Created Shape entity: ${entityId} for node: ${nodeId}`);
      return entity;
    } catch (error) {
      console.error('Failed to create Shape entity:', error);
      throw error;
    }
  }

  /**
   * Update an existing Shape entity
   */
  async updateEntity(entityId: EntityId, updates: Partial<ShapeEntity>): Promise<ShapeEntity> {
    try {
      const existing = await this.table.get(entityId);
      if (!existing) {
        throw new Error(`Shape entity not found: ${entityId}`);
      }

      const updatedEntity: ShapeEntity = {
        ...existing,
        ...updates,
        updatedAt: Date.now(),
        version: existing.version + 1,
      };

      await this.table.put(updatedEntity);
      console.log(`Updated Shape entity: ${entityId}`);
      return updatedEntity;
    } catch (error) {
      console.error('Failed to update Shape entity:', error);
      throw error;
    }
  }

  /**
   * Delete a Shape entity
   */
  async deleteEntity(entityId: EntityId): Promise<void> {
    try {
      const entity = await this.table.get(entityId);
      if (!entity) {
        throw new Error(`Shape entity not found: ${entityId}`);
      }

      // Cancel any active batch sessions
      if (entity.batchSessionId) {
        await this.cancelBatchSession(entity.batchSessionId);
      }

      // Cleanup related data
      await this.cleanupEntityData(entity);

      // Delete from database
      await this.table.delete(entityId);

      console.log(`Deleted Shape entity: ${entityId}`);
    } catch (error) {
      console.error('Failed to delete Shape entity:', error);
      throw error;
    }
  }

  /**
   * Get Shape entity by ID
   */
  async getEntity(entityId: EntityId): Promise<ShapeEntity | null> {
    try {
      const entity = await this.table.get(entityId);
      return entity || null;
    } catch (error) {
      console.error('Failed to get Shape entity:', error);
      throw error;
    }
  }

  /**
   * Get Shape entity by node ID
   */
  async getEntityByNodeId(nodeId: NodeId): Promise<ShapeEntity | null> {
    try {
      const entity = await this.table.where('nodeId').equals(nodeId).first();
      return entity || null;
    } catch (error) {
      console.error('Failed to get Shape entity by node ID:', error);
      throw error;
    }
  }

  /**
   * List all Shape entities
   */
  async listEntities(limit?: number, offset?: number): Promise<ShapeEntity[]> {
    try {
      let query = this.table.orderBy('updatedAt').reverse();

      if (offset) {
        query = query.offset(offset);
      }

      if (limit) {
        query = query.limit(limit);
      }

      return await query.toArray();
    } catch (error) {
      console.error('Failed to list Shape entities:', error);
      throw error;
    }
  }

  /**
   * Search Shape entities by criteria
   */
  async searchEntities(criteria: {
    name?: string;
    dataSource?: string;
    processingStatus?: string;
    hasActiveBatch?: boolean;
  }): Promise<ShapeEntity[]> {
    try {
      let query = this.table.toCollection();

      if (criteria.name) {
        query = query.filter((entity: any) =>
          entity.name.toLowerCase().includes(criteria.name!.toLowerCase())
        );
      }

      if (criteria.dataSource) {
        query = query.filter((entity: any) => entity.dataSourceName === criteria.dataSource);
      }

      if (criteria.processingStatus) {
        query = query.filter(
          (entity: any) => entity.processingStatus === criteria.processingStatus
        );
      }

      if (criteria.hasActiveBatch !== undefined) {
        query = query.filter((entity: any) =>
          criteria.hasActiveBatch ? !!entity.batchSessionId : !entity.batchSessionId
        );
      }

      return await query.toArray();
    } catch (error) {
      console.error('Failed to search Shape entities:', error);
      throw error;
    }
  }

  /**
   * Create working copy from entity
   */
  async createWorkingCopy(entity: ShapeEntity): Promise<ShapeWorkingCopy> {
    const workingCopy: ShapeWorkingCopy = {
      id: entity.id,
      nodeId: entity.nodeId,
      name: entity.name,
      description: entity.description,
      dataSourceName: entity.dataSourceName,
      licenseAgreement: false, // Reset for editing
      processingConfig: { ...entity.processingConfig },
      checkboxState: entity.checkboxState,
      selectedCountries: [...entity.selectedCountries],
      adminLevels: [...entity.adminLevels],
      urlMetadata: [...entity.urlMetadata],
      isDraft: false,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      version: entity.version,
    };

    console.log(`Created working copy for entity: ${entity.id}`);
    return workingCopy;
  }

  async createNewDraftWorkingCopy(parentId: NodeId): Promise<ShapeWorkingCopy> {
    const workingCopyId = generateEntityId() as EntityId;

    const workingCopy: ShapeWorkingCopy = {
      id: workingCopyId,
      nodeId: '' as NodeId, // Will be set when committed
      name: '',
      description: '',
      dataSourceName: 'naturalearth',
      licenseAgreement: false,
      processingConfig: DEFAULT_PROCESSING_CONFIG,
      checkboxState: '',
      selectedCountries: [],
      adminLevels: [],
      urlMetadata: [],
      isDraft: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    // In real implementation, would store in EphemeralDB
    console.log(`Created new draft working copy: ${workingCopyId} for parent: ${parentId}`);

    return workingCopy;
  }

  async getWorkingCopy(workingCopyId: EntityId): Promise<ShapeWorkingCopy | undefined> {
    // Mock implementation - would fetch from EphemeralDB
    console.log(`Getting working copy: ${workingCopyId}`);
    return undefined;
  }

  async updateWorkingCopy(
    workingCopyId: EntityId,
    data: Partial<ShapeEntity>
  ): Promise<ShapeWorkingCopy> {
    // Mock implementation - would update in EphemeralDB
    console.log(`Updating working copy: ${workingCopyId}`, data);

    const mockUpdated: ShapeWorkingCopy = {
      id: workingCopyId,
      nodeId: '' as NodeId,
      name: data.name || '',
      description: data.description || '',
      dataSourceName: data.dataSourceName || 'naturalearth',
      licenseAgreement: data.licenseAgreement || false,
      processingConfig: data.processingConfig || DEFAULT_PROCESSING_CONFIG,
      checkboxState: data.checkboxState || '',
      selectedCountries: data.selectedCountries || [],
      adminLevels: data.adminLevels || [],
      urlMetadata: data.urlMetadata || [],
      isDraft: false,
      createdAt: Date.now() - 10000,
      updatedAt: Date.now(),
      version: 1,
    };

    return mockUpdated;
  }

  async commitWorkingCopy(workingCopyId: EntityId): Promise<NodeId> {
    // Mock implementation - would:
    // 1. Get working copy from EphemeralDB
    // 2. Create/update entity in CoreDB
    // 3. Create tree node if it's a new draft
    // 4. Remove working copy from EphemeralDB
    console.log(`Committing working copy: ${workingCopyId}`);

    const nodeId = generateEntityId() as unknown as NodeId;
    return nodeId;
  }

  async discardWorkingCopy(workingCopyId: EntityId): Promise<void> {
    // Mock implementation - would remove from EphemeralDB
    console.log(`Discarding working copy: ${workingCopyId}`);
  }

  /**
   * Apply working copy changes to entity
   */
  async applyWorkingCopy(entityId: EntityId, workingCopy: ShapeWorkingCopy): Promise<ShapeEntity> {
    const updates: Partial<ShapeEntity> = {
      name: workingCopy.name,
      description: workingCopy.description,
      dataSourceName: workingCopy.dataSourceName,
      processingConfig: workingCopy.processingConfig,
      selectedCountries: workingCopy.selectedCountries,
      adminLevels: workingCopy.adminLevels,
      urlMetadata: workingCopy.urlMetadata,
      checkboxState: workingCopy.checkboxState,
    };

    return this.updateEntity(entityId, updates);
  }

  /**
   * Update processing status
   */
  async updateProcessingStatus(
    entityId: EntityId,
    status: 'idle' | 'processing' | 'completed' | 'failed',
    batchSessionId?: string
  ): Promise<void> {
    const updates: Partial<ShapeEntity> = {
      processingStatus: status,
    };

    if (batchSessionId !== undefined) {
      updates.batchSessionId = batchSessionId;
    }

    await this.updateEntity(entityId, updates);
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(entityId: EntityId): Promise<{
    featureCount: number;
    tileCount: number;
    storageUsed: number;
    lastProcessed?: number;
  }> {
    // Mock implementation - would query related tables
    console.log(`Getting processing stats for entity: ${entityId}`);
    return {
      featureCount: 0,
      tileCount: 0,
      storageUsed: 0,
    };
  }

  /**
   * Private helper methods
   */

  private async cancelBatchSession(sessionId: string): Promise<void> {
    try {
      console.log(`Cancelling batch session: ${sessionId}`);
      // Would cancel active workers and cleanup session
    } catch (error) {
      console.error('Failed to cancel batch session:', error);
      // Don't throw - cleanup is best effort
    }
  }

  private async cleanupEntityData(entity: ShapeEntity): Promise<void> {
    try {
      console.log(`Cleaning up data for Shape entity: ${entity.id}`);

      // Would cleanup:
      // 1. Feature data
      // 2. Vector tiles
      // 3. Cache entries
      // 4. Batch sessions
    } catch (error) {
      console.error('Error during entity cleanup:', error);
      // Don't throw - cleanup is best effort
    }
  }
}
