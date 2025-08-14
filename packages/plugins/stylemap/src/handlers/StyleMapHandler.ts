/**
 * @file StyleMapHandler.ts
 * @description Main handler class for StyleMap plugin operations
 * Simplified interface for common StyleMap operations
 * References:
 * - packages/plugins/basemap/src/handlers/BaseMapHandler.ts
 * - docs/spec/plugin-stylemap-requirements.md (REQ-502)
 */

import type { TreeNodeId, TreeNodeType } from '@hierarchidb/core';
import type { EntityHandler, EntityBackup } from '@hierarchidb/core';
import type { StyleMapEntity, StyleMapWorkingCopy } from '../types';
import { StyleMapEntityHandler } from './StyleMapEntityHandler';
import { StyleMapDatabase } from '../database/StyleMapDatabase';

/**
 * Simplified StyleMap handler for common operations
 * Used by the plugin system for basic resource management
 */
export class StyleMapHandler implements EntityHandler<StyleMapEntity, never, StyleMapWorkingCopy> {
  private entityHandler: StyleMapEntityHandler;
  private get stylemapDB() {
    return StyleMapDatabase.getInstance();
  }

  constructor() {
    this.entityHandler = new StyleMapEntityHandler();
  }

  // ==================
  // EntityHandler Interface Implementation
  // ==================

  /**
   * Create a new StyleMap entity
   */
  async createEntity(nodeId: TreeNodeId, data?: Partial<StyleMapEntity>): Promise<StyleMapEntity> {
    return await this.entityHandler.createEntity(nodeId, data);
  }

  /**
   * Get a StyleMap entity by node ID
   */
  async getEntity(nodeId: TreeNodeId): Promise<StyleMapEntity | undefined> {
    return await this.entityHandler.getEntity(nodeId);
  }

  /**
   * Update a StyleMap entity
   */
  async updateEntity(nodeId: TreeNodeId, data: Partial<StyleMapEntity>): Promise<void> {
    await this.entityHandler.updateEntity(nodeId, data);
  }

  /**
   * Delete a StyleMap entity
   */
  async deleteEntity(nodeId: TreeNodeId): Promise<void> {
    await this.entityHandler.deleteEntity(nodeId);
  }

  /**
   * Create a working copy for editing
   */
  async createWorkingCopy(nodeId: TreeNodeId): Promise<StyleMapWorkingCopy> {
    return await this.entityHandler.createWorkingCopy(nodeId);
  }

  /**
   * Commit a working copy back to the entity
   */
  async commitWorkingCopy(nodeId: TreeNodeId, workingCopy: StyleMapWorkingCopy): Promise<void> {
    await this.entityHandler.commitWorkingCopy(nodeId, workingCopy);
  }

  /**
   * Discard a working copy
   */
  async discardWorkingCopy(nodeId: TreeNodeId): Promise<void> {
    await this.entityHandler.discardWorkingCopy(nodeId);
  }

  // ==================
  // Optional EntityHandler Methods
  // ==================

  /**
   * Duplicate StyleMap entity
   */
  async duplicate(sourceId: TreeNodeId, duplicatedId: TreeNodeId): Promise<void> {
    const sourceEntity = await this.stylemapDB.getEntity(sourceId);
    if (sourceEntity) {
      // Create duplicate with new ID, preserving all configuration
      const duplicateData = {
        filename: sourceEntity.filename
          ? `Copy of ${sourceEntity.filename}`
          : 'Copy of Untitled.csv',
        keyColumn: sourceEntity.keyColumn,
        valueColumn: sourceEntity.valueColumn,
        filterRules: sourceEntity.filterRules ? [...sourceEntity.filterRules] : undefined,
        styleMapConfig: sourceEntity.styleMapConfig
          ? { ...sourceEntity.styleMapConfig }
          : undefined,
        // Note: tableMetadataId is intentionally not copied to avoid sharing table data
        // The user will need to re-import the data file for the duplicate
      };

      await this.entityHandler.createEntity(duplicatedId, duplicateData);
    }
  }

  /**
   * Create backup of StyleMap entity
   */
  async backup(id: TreeNodeId): Promise<EntityBackup<StyleMapEntity>> {
    const entity = await this.stylemapDB.getEntity(id);
    if (!entity) {
      throw new Error(`StyleMap entity not found: ${id}`);
    }

    // Include table metadata for complete backup
    let tableMetadata = null;
    if (entity.tableMetadataId) {
      tableMetadata = await this.stylemapDB.getTableMetadata(entity.tableMetadataId);
    }

    return {
      entity,
      subEntities: {}, // StyleMap doesn't have sub-entities
      metadata: {
        backupDate: Date.now(),
        version: '1.0',
        nodeType: 'stylemap' as TreeNodeType,
        tableMetadata, // Additional custom metadata
      },
    } as EntityBackup<StyleMapEntity>;
  }

  /**
   * Restore StyleMap entity from backup
   */
  async restore(id: TreeNodeId, backup: EntityBackup<StyleMapEntity>): Promise<void> {
    if (!backup || !backup.entity) {
      throw new Error('Invalid backup data');
    }

    // Restore entity
    const entity = { ...backup.entity, nodeId: id } as StyleMapEntity;
    await this.stylemapDB.saveEntity(entity);

    // Restore table metadata if available
    const tableMetadata = (backup.metadata as any).tableMetadata;
    if (tableMetadata) {
      const metadata = tableMetadata;
      metadata.nodeId = id; // Update node reference
      await this.stylemapDB.saveTableMetadata(metadata);

      // Update entity with table reference
      await this.stylemapDB.updateEntity(id, {
        tableMetadataId: metadata.tableId,
      });
    }
  }

  /**
   * Cleanup StyleMap resources
   */
  async cleanup(id: TreeNodeId): Promise<void> {
    await this.stylemapDB.deleteEntity(id);
  }

  /**
   * Delete StyleMap entity
   */
  async delete(id: TreeNodeId): Promise<void> {
    await this.cleanup(id);
  }

  // ==================
  // StyleMap-Specific Helper Methods
  // ==================

  /**
   * Get StyleMap entity
   */
  async getStyleMap(id: TreeNodeId): Promise<StyleMapEntity | undefined> {
    return await this.stylemapDB.getEntity(id);
  }

  /**
   * Save StyleMap entity
   */
  async saveStyleMap(entity: StyleMapEntity): Promise<void> {
    await this.stylemapDB.saveEntity(entity);
  }

  /**
   * Update StyleMap entity
   */
  async updateStyleMap(id: TreeNodeId, updates: Partial<StyleMapEntity>): Promise<void> {
    await this.stylemapDB.updateEntity(id, updates);
  }

  /**
   * Delete StyleMap entity
   */
  async deleteStyleMap(id: TreeNodeId): Promise<void> {
    await this.stylemapDB.deleteEntity(id);
  }

  /**
   * Check if StyleMap has table data
   */
  async hasTableData(id: TreeNodeId): Promise<boolean> {
    const entity = await this.stylemapDB.getEntity(id);
    return !!entity?.tableMetadataId;
  }

  /**
   * Get table row count for StyleMap
   */
  async getTableRowCount(id: TreeNodeId): Promise<number> {
    const entity = await this.stylemapDB.getEntity(id);
    if (!entity?.tableMetadataId) {
      return 0;
    }

    return await this.stylemapDB.getTableRowCount(entity.tableMetadataId);
  }

  /**
   * Clear table data for StyleMap
   */
  async clearTableData(id: TreeNodeId): Promise<void> {
    const entity = await this.stylemapDB.getEntity(id);
    if (entity?.tableMetadataId) {
      await this.stylemapDB.deleteTable(entity.tableMetadataId);
      await this.stylemapDB.updateEntity(id, {
        tableMetadataId: undefined,
        keyColumn: undefined,
        valueColumn: undefined,
        cacheKey: undefined,
      });
    }
  }

  /**
   * Get StyleMap configuration status
   */
  async getConfigurationStatus(id: TreeNodeId): Promise<{
    hasFile: boolean;
    hasColumnMapping: boolean;
    hasStyleConfig: boolean;
    hasFilters: boolean;
    isComplete: boolean;
  }> {
    const entity = await this.stylemapDB.getEntity(id);

    if (!entity) {
      return {
        hasFile: false,
        hasColumnMapping: false,
        hasStyleConfig: false,
        hasFilters: false,
        isComplete: false,
      };
    }

    const hasFile = !!(entity.tableMetadataId && entity.filename);
    const hasColumnMapping = !!(entity.keyColumn && entity.valueColumn);
    const hasStyleConfig = !!entity.styleMapConfig;
    const hasFilters = !!(entity.filterRules && entity.filterRules.length > 0);
    const isComplete = hasFile && hasColumnMapping && hasStyleConfig;

    return {
      hasFile,
      hasColumnMapping,
      hasStyleConfig,
      hasFilters,
      isComplete,
    };
  }

  /**
   * Validate StyleMap configuration
   */
  async validateConfiguration(id: TreeNodeId): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const entity = await this.stylemapDB.getEntity(id);

    if (!entity) {
      return {
        isValid: false,
        errors: ['StyleMap entity not found'],
        warnings: [],
      };
    }

    const { validateStyleMapEntity } = await import('../types');
    return validateStyleMapEntity(entity);
  }

  /**
   * Get StyleMap statistics
   */
  async getStatistics(id: TreeNodeId): Promise<{
    fileSize?: number;
    rowCount: number;
    columnCount: number;
    filterRuleCount: number;
    cacheStatus: 'none' | 'valid' | 'expired';
    lastModified: number;
  }> {
    const entity = await this.stylemapDB.getEntity(id);

    if (!entity) {
      return {
        rowCount: 0,
        columnCount: 0,
        filterRuleCount: 0,
        cacheStatus: 'none',
        lastModified: 0,
      };
    }

    let rowCount = 0;
    let columnCount = 0;
    let fileSize: number | undefined;

    if (entity.tableMetadataId) {
      const metadata = await this.stylemapDB.getTableMetadata(entity.tableMetadataId);
      if (metadata) {
        rowCount = metadata.rowCount;
        columnCount = metadata.columns.length;
        fileSize = metadata.fileSize;
      }
    }

    // Check cache status
    let cacheStatus: 'none' | 'valid' | 'expired' = 'none';
    if (entity.cacheKey) {
      const cacheEntry = await this.stylemapDB.getCache(entity.cacheKey);
      if (cacheEntry) {
        cacheStatus = Date.now() > cacheEntry.expiresAt ? 'expired' : 'valid';
      }
    }

    return {
      fileSize,
      rowCount,
      columnCount,
      filterRuleCount: entity.filterRules?.length || 0,
      cacheStatus,
      lastModified: entity.updatedAt,
    };
  }
}
