/**
 * Shape Entity Handler
 * Manages CRUD operations for Shape entities
 */

// Shape plugin uses its own entity management approach via Comlink API
// No direct dependency on worker's BaseEntityHandler
import type { NodeId, EntityId } from '@hierarchidb/common-core';
import { generateEntityId } from '@hierarchidb/common-core';
import type { ShapeEntity, ShapeWorkingCopy } from '~/types';
import { shapePluginAPI } from '~/api/ShapePluginAPI';

/**
 * Entity handler for Shape plugin
 * Extends BaseEntityHandler to provide Shape-specific CRUD operations
 */
export class ShapeEntityHandler {
  private table: any;

  constructor() {
    // Initialize with plugin-specific database interface
    // This would typically connect to the Shapes plugin API via Comlink
    this.table = {
      add: async (_entity: any): Promise<any> => _entity,
      get: async (_id: any): Promise<any> => null,
      put: async (_entity: any): Promise<any> => _entity,
      delete: async (_id: any): Promise<void> => {},
      where: (_field: string) => ({
        equals: (_value: any) => ({
          first: async (): Promise<any> => null,
          toArray: async (): Promise<any[]> => [],
        }),
      }),
      orderBy: (_field: string) => ({
        reverse: () => ({
          offset: (_n: number) => ({
            limit: (_n: number) => ({
              toArray: async (): Promise<any[]> => [],
            }),
            toArray: async (): Promise<any[]> => [],
          }),
          limit: (_n: number) => ({
            toArray: async (): Promise<any[]> => [],
          }),
          toArray: async (): Promise<any[]> => [],
        }),
        offset: (_n: number) => ({
          limit: (_n: number) => ({
            toArray: async (): Promise<any[]> => [],
          }),
          toArray: async (): Promise<any[]> => [],
        }),
        limit: (_n: number) => ({
          toArray: async (): Promise<any[]> => [],
        }),
        toArray: async (): Promise<any[]> => [],
      }),
      toCollection: () => ({
        filter: (_predicate: any) => ({
          toArray: async (): Promise<any[]> => [],
        }),
      }),
    };
  }
  
  /**
   * Create a new Shape entity
   */
  async createEntity(nodeId: NodeId, data: Partial<ShapeEntity>): Promise<ShapeEntity> {
    const entityId = generateEntityId() as EntityId;
    const now = Date.now();
    
    const entity: ShapeEntity = {
      id: entityId,
      nodeId: nodeId,
      name: data.name || '',
      description: data.description || '',
      dataSourceName: data.dataSourceName || 'naturalearth',
      licenseAgreement: data.licenseAgreement || false,
      checkboxState: data.checkboxState || '[]', // Serialized empty array
      processingConfig: data.processingConfig || {
        concurrentDownloads: 2,
        corsProxyBaseURL: '',
        enableFeatureFiltering: false,
        featureFilterMethod: 'hybrid',
        featureAreaThreshold: 0.1,
        concurrentProcesses: 2,
        maxZoomLevel: 12,
        tileBufferSize: 256,
        simplificationTolerance: 0.01,
      },
      adminLevels: data.adminLevels || [],
      selectedCountries: data.selectedCountries || [],
      urlMetadata: data.urlMetadata || [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // Store in database via the shapes plugin API
    try {
      // Initialize plugin API if needed
      await this.ensurePluginInitialized();
      
      // Store entity in database
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

      // Note: Batch session checking would be implemented in full version

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
        query = query.filter((_entity: any) => 
          _entity.name.toLowerCase().includes(criteria.name!.toLowerCase())
        );
      }

      if (criteria.dataSource) {
        query = query.filter((_entity: any) => _entity.dataSourceName === criteria.dataSource);
      }

      if (criteria.processingStatus) {
        query = query.filter((_entity: any) => _entity.processingStatus === criteria.processingStatus);
      }

      if (criteria.hasActiveBatch !== undefined) {
        query = query.filter((_entity: any) => 
          true // Mock implementation
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
    return {
      id: entity.id,
      nodeId: entity.nodeId,
      name: entity.name,
      description: entity.description,
      dataSourceName: entity.dataSourceName,
      licenseAgreement: false, // Reset for editing
      processingConfig: { ...entity.processingConfig },
      checkboxState: [], // Will be populated by UI
      selectedCountries: [...entity.selectedCountries],
      adminLevels: [...entity.adminLevels],
      urlMetadata: [...entity.urlMetadata],
      isDraft: false,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      version: entity.version,
    };
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
    };

    return this.updateEntity(entityId, updates);
  }

  /**
   * Start batch processing for an entity
   */
  async startBatchProcessing(entityId: EntityId): Promise<string> {
    try {
      const entity = await this.getEntity(entityId);
      if (!entity) {
        throw new Error(`Shape entity not found: ${entityId}`);
      }

      await this.ensurePluginInitialized();

      // Create batch configuration from entity
      const batchConfig = {
        dataSource: entity.dataSourceName as any,
        countryCode: entity.selectedCountries[0] || 'global',
        adminLevels: entity.adminLevels,
        ...entity.processingConfig,
      };

      // Start batch process
      const batchSession = await shapePluginAPI.startBatchProcess(entity.nodeId, batchConfig);

      // Note: Entity update with session ID would be implemented in full version
      // await this.updateEntity(entityId, { batchSessionId: batchSession.sessionId });

      return batchSession.sessionId;
    } catch (error) {
      console.error('Failed to start batch processing:', error);
      throw error;
    }
  }

  /**
   * Get batch status for an entity
   */
  async getBatchStatus(entityId: EntityId): Promise<any> {
    try {
      const entity = await this.getEntity(entityId);
      if (!entity) {
        return null;
      }

      // Note: Batch status checking would be implemented in full version
      return null;
    } catch (error) {
      console.error('Failed to get batch status:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async ensurePluginInitialized(): Promise<void> {
    // The plugin API should be initialized by the plugin system
    // This is a safety check
    try {
      await shapePluginAPI.getHealthStatus();
    } catch (error) {
      console.warn('Shape plugin API not ready, initializing...');
      await shapePluginAPI.initialize();
    }
  }

  private async cleanupEntityData(entity: ShapeEntity): Promise<void> {
    try {
      await this.ensurePluginInitialized();

      // Note: Batch session cancellation would be implemented in full version

      // Clear cached data for this node
      try {
        await shapePluginAPI.clearCache(entity.nodeId);
      } catch (error) {
        console.warn('Failed to clear cache during cleanup:', error);
      }

      console.log(`Cleaned up data for Shape entity: ${entity.id}`);
    } catch (error) {
      console.error('Error during entity cleanup:', error);
      // Don't throw - cleanup is best effort
    }
  }
}