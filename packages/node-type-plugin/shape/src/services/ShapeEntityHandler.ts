/**
 * @file ShapeEntityHandler.ts
 * @description ERIA-Cartograph移植: ShapeEntityHandler実装
 */

import type { NodeId, EntityId } from '@hierarchidb/core';
import { createEntityId } from '@hierarchidb/core';
import type { ShapeEntity, ShapeWorkingCopy } from '../types/ShapeEntity';
import type { BatchConfig } from '../types/BatchConfig';

/**
 * Shape Entity Handler for HierarchiDB
 * Handles CRUD operations and Working Copy pattern for Shape entities
 */
export class ShapeEntityHandler {
  private entities: Map<NodeId, ShapeEntity> = new Map();
  private workingCopies: Map<NodeId, ShapeWorkingCopy> = new Map();

  /**
   * Create a new Shape entity
   */
  async createEntity(nodeId: NodeId, data: Partial<ShapeEntity>): Promise<ShapeEntity> {
    const entityId = createEntityId();
    const now = Date.now();
    
    const entity: ShapeEntity = {
      id: entityId,
      nodeId,
      dataSourceName: data.dataSourceName || 'naturalearth',
      selectedCountries: data.selectedCountries || [],
      selectedAdminLevels: data.selectedAdminLevels || [],
      licenseAgreement: data.licenseAgreement || false,
      batchConfig: data.batchConfig,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    
    this.entities.set(nodeId, entity);
    return entity;
  }

  /**
   * Get Shape entity by nodeId
   */
  async getEntity(nodeId: NodeId): Promise<ShapeEntity | undefined> {
    return this.entities.get(nodeId);
  }

  /**
   * Update Shape entity
   */
  async updateEntity(nodeId: NodeId, updates: Partial<ShapeEntity>): Promise<ShapeEntity> {
    const existing = this.entities.get(nodeId);
    if (!existing) {
      throw new Error(`Entity not found for nodeId: ${nodeId}`);
    }

    // Add a small delay to ensure updatedAt is different
    await new Promise(resolve => setTimeout(resolve, 1));

    const updated: ShapeEntity = {
      ...existing,
      ...updates,
      nodeId, // Preserve nodeId
      id: existing.id, // Preserve ID
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    this.entities.set(nodeId, updated);
    return updated;
  }

  /**
   * Delete Shape entity
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    this.entities.delete(nodeId);
    this.workingCopies.delete(nodeId);
  }

  /**
   * Create working copy for safe editing
   */
  async createWorkingCopy(nodeId: NodeId): Promise<ShapeWorkingCopy> {
    const entity = this.entities.get(nodeId);
    if (!entity) {
      throw new Error(`Entity not found for nodeId: ${nodeId}`);
    }

    const workingCopy: ShapeWorkingCopy = {
      nodeId,
      baseVersion: entity.version,
      isModified: false,
      changes: {},
    };

    this.workingCopies.set(nodeId, workingCopy);
    return workingCopy;
  }

  /**
   * Modify working copy
   */
  async modifyWorkingCopy(
    workingCopy: ShapeWorkingCopy,
    changes: Partial<Omit<ShapeEntity, 'id' | 'nodeId' | 'createdAt' | 'version'>>
  ): Promise<ShapeWorkingCopy> {
    const modified: ShapeWorkingCopy = {
      ...workingCopy,
      isModified: true,
      changes: {
        ...workingCopy.changes,
        ...changes,
      },
    };

    this.workingCopies.set(workingCopy.nodeId, modified);
    return modified;
  }

  /**
   * Commit working copy to CoreDB
   */
  async commitWorkingCopy(workingCopy: ShapeWorkingCopy): Promise<ShapeEntity> {
    if (!workingCopy.isModified) {
      const existing = this.entities.get(workingCopy.nodeId);
      if (!existing) {
        throw new Error(`Entity not found for nodeId: ${workingCopy.nodeId}`);
      }
      return existing;
    }

    const updatedEntity = await this.updateEntity(workingCopy.nodeId, workingCopy.changes);
    this.workingCopies.delete(workingCopy.nodeId);
    return updatedEntity;
  }

  /**
   * Discard working copy
   */
  async discardWorkingCopy(workingCopy: ShapeWorkingCopy): Promise<void> {
    this.workingCopies.delete(workingCopy.nodeId);
  }

  /**
   * Set batch configuration
   */
  async setBatchConfig(nodeId: NodeId, batchConfig: BatchConfig): Promise<void> {
    await this.updateEntity(nodeId, { batchConfig });
  }

  /**
   * Get batch configuration
   */
  async getBatchConfig(nodeId: NodeId): Promise<BatchConfig | undefined> {
    const entity = this.entities.get(nodeId);
    return entity?.batchConfig;
  }
}