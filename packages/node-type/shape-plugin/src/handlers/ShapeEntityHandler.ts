/**
 * Shape Entity Handler - UI Layer
 * Communicates with Worker layer via Comlink API
 */

import type { NodeId, EntityId } from '@hierarchidb/common-type';
import { generateEntityId } from '@hierarchidb/common-type';
import type { ShapeEntity, ShapeWorkingCopy } from '~/types';
import { shapePluginAPI } from '~/api/ShapePluginAPI';
import { createWorkingCopyFromEntity, mapWorkingCopyToUpdates } from '../shared/utils';

/**
 * Create shape data interface (UI layer)
 */
export interface CreateShapeData {
  name: string;
  description?: string;
  dataSourceName: string;
  processingConfig?: any;
  selectedCountries?: string[];
  adminLevels?: number[];
}

/**
 * Shape filter criteria for searching
 */
export interface ShapeFilterCriteria {
  name?: string;
  dataSource?: string;
  processingStatus?: string;
  hasActiveBatch?: boolean;
}

/**
 * Entity handler for Shape plugin in UI layer
 * Acts as a proxy to Worker layer operations via Comlink API
 */
export class ShapeEntityHandler {
  /**
   * Create a new Shape entity
   */
  async createEntity(nodeId: NodeId, data: CreateShapeData): Promise<ShapeEntity> {
    try {
      // Use Comlink API to create entity in Worker
      const entity = await shapePluginAPI.createShapeEntity(nodeId, data);
      console.log(`Created Shape entity for node: ${nodeId}`);
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
      // Use Comlink API to update entity in Worker
      const entity = await shapePluginAPI.updateShapeEntity(entityId, updates);
      console.log(`Updated Shape entity: ${entityId}`);
      return entity;
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
      // Use Comlink API to delete entity in Worker
      await shapePluginAPI.deleteShapeEntity(entityId);
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
      const entity = await shapePluginAPI.getShapeEntity(entityId);
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
      const entity = await shapePluginAPI.getShapeEntityByNodeId(nodeId);
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
      const entities = await shapePluginAPI.listShapeEntities(limit, offset);
      return entities;
    } catch (error) {
      console.error('Failed to list Shape entities:', error);
      throw error;
    }
  }

  /**
   * Search Shape entities by criteria
   */
  async searchEntities(criteria: ShapeFilterCriteria): Promise<ShapeEntity[]> {
    try {
      const entities = await shapePluginAPI.searchShapeEntities(criteria);
      return entities;
    } catch (error) {
      console.error('Failed to search Shape entities:', error);
      throw error;
    }
  }

  /**
   * Create working copy from entity (UI-side operation)
   */
  createWorkingCopy(entity: ShapeEntity): ShapeWorkingCopy {
    const workingCopy = createWorkingCopyFromEntity(entity);
    console.log(`Created working copy for entity: ${entity.id}`);
    return workingCopy;
  }

  /**
   * Create new draft working copy (UI-side operation)
   */
  createNewDraftWorkingCopy(_parentId: NodeId): ShapeWorkingCopy {
    const workingCopyId = generateEntityId() as EntityId;

    const workingCopy: ShapeWorkingCopy = {
      id: workingCopyId,
      nodeId: '' as NodeId, // Will be set when committed
      name: '',
      description: '',
      dataSourceName: 'naturalearth',
      licenseAgreement: false,
      processingConfig: {
        simplifyTolerance: 0.01,
        featureLimit: 10000,
        tileSizeKB: 500,
      },
      checkboxState: '',
      selectedCountries: [],
      adminLevels: [],
      urlMetadata: [],
      isDraft: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    console.log(`Created new draft working copy: ${workingCopyId}`);
    return workingCopy;
  }

  /**
   * Apply working copy changes to entity (commit via API)
   */
  async applyWorkingCopy(entityId: EntityId, workingCopy: ShapeWorkingCopy): Promise<ShapeEntity> {
    const updates = mapWorkingCopyToUpdates(workingCopy);
    return this.updateEntity(entityId, updates as Partial<ShapeEntity>);
  }

  /**
   * Update processing status via API
   */
  async updateProcessingStatus(
    entityId: EntityId,
    status: 'idle' | 'processing' | 'completed' | 'failed',
    batchSessionId?: string
  ): Promise<void> {
    try {
      await shapePluginAPI.updateProcessingStatus(entityId, status, batchSessionId);
      console.log(`Updated processing status for entity: ${entityId} to ${status}`);
    } catch (error) {
      console.error('Failed to update processing status:', error);
      throw error;
    }
  }

  /**
   * Get processing statistics via API
   */
  async getProcessingStats(entityId: EntityId): Promise<{
    featureCount: number;
    tileCount: number;
    storageUsed: number;
    lastProcessed?: number;
  }> {
    try {
      const stats = await shapePluginAPI.getProcessingStats(entityId);
      return stats;
    } catch (error) {
      console.error('Failed to get processing stats:', error);
      throw error;
    }
  }

  /**
   * Start batch processing for entity
   */
  async startBatchProcessing(
    entityId: EntityId,
    config: any,
    countries: string[],
    adminLevels: number[]
  ): Promise<string> {
    try {
      const sessionId = await shapePluginAPI.startBatchProcessing(
        entityId,
        config,
        countries,
        adminLevels
      );
      console.log(`Started batch processing session: ${sessionId} for entity: ${entityId}`);
      return sessionId;
    } catch (error) {
      console.error('Failed to start batch processing:', error);
      throw error;
    }
  }

  /**
   * Cancel batch processing session
   */
  async cancelBatchProcessing(sessionId: string): Promise<void> {
    try {
      await shapePluginAPI.cancelBatchProcessing(sessionId);
      console.log(`Cancelled batch processing session: ${sessionId}`);
    } catch (error) {
      console.error('Failed to cancel batch processing:', error);
      throw error;
    }
  }

  /**
   * Get batch processing progress
   */
  async getBatchProgress(sessionId: string): Promise<any> {
    try {
      const progress = await shapePluginAPI.getBatchProgress(sessionId);
      return progress;
    } catch (error) {
      console.error('Failed to get batch progress:', error);
      throw error;
    }
  }
}