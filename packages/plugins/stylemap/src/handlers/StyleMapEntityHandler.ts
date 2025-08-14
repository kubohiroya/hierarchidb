/**
 * @file StyleMapEntityHandler.ts
 * @description EntityHandler implementation for StyleMap plugin
 * Extends hierarchidb BaseEntityHandler with StyleMap-specific operations
 * References:
 * - packages/worker/src/handlers/EntityHandler.ts
 * - packages/plugins/basemap/src/handlers/BaseMapEntityHandler.ts
 * - docs/spec/plugin-stylemap-requirements.md (REQ-502)
 */

import type { TreeNodeId } from '@hierarchidb/core';
import { generateUUID } from '@hierarchidb/core';
import { BaseEntityHandler } from '@hierarchidb/worker';
import type { CoreDB } from '@hierarchidb/worker';
import type { EphemeralDB } from '@hierarchidb/worker';
import type {
  StyleMapEntity,
  StyleMapWorkingCopy,
  StyleMapCreationData,
  StyleMapUpdateData,
  TableMetadataEntity,
  FilterRule,
  StyleMapConfig,
  TableImportResult,
  TableQueryOptions,
  TableQueryResult,
} from '../types';
import { createStyleMapEntity, createStyleMapWorkingCopy, validateStyleMapEntity } from '../types';
import { StyleMapDatabase } from '../database/StyleMapDatabase';

/**
 * StyleMap entity handler
 * Provides CRUD operations and StyleMap-specific functionality
 */
export class StyleMapEntityHandler extends BaseEntityHandler<
  StyleMapEntity,
  never, // No sub-entities for StyleMap
  StyleMapWorkingCopy
> {
  private stylemapDB: StyleMapDatabase;

  constructor(coreDB?: CoreDB, ephemeralDB?: EphemeralDB) {
    super(
      coreDB || ({} as CoreDB),
      ephemeralDB || ({} as EphemeralDB),
      'stylemaps', // Main table name
      undefined // No sub-entity table
    );

    // Use StyleMap-specific database
    this.stylemapDB = StyleMapDatabase.getInstance();
  }

  // ==================
  // Basic CRUD Operations (BaseEntityHandler implementation)
  // ==================

  /**
   * Create a new StyleMap entity
   */
  async createEntity(nodeId: TreeNodeId, data?: StyleMapCreationData): Promise<StyleMapEntity> {
    // Create entity with default values
    const entity = createStyleMapEntity(nodeId, data || {});

    // Validate entity before creation
    const validation = validateStyleMapEntity(entity);
    if (!validation.isValid) {
      throw new Error(`Cannot create StyleMap: ${validation.errors.join(', ')}`);
    }

    // Save to database
    await this.stylemapDB.saveEntity(entity);

    return entity;
  }

  /**
   * Get StyleMap entity by node ID
   */
  async getEntity(nodeId: TreeNodeId): Promise<StyleMapEntity | undefined> {
    return await this.stylemapDB.getEntity(nodeId);
  }

  /**
   * Update StyleMap entity
   */
  async updateEntity(nodeId: TreeNodeId, data: StyleMapUpdateData): Promise<void> {
    const existing = await this.stylemapDB.getEntity(nodeId);
    if (!existing) {
      throw new Error(`StyleMap entity not found: ${nodeId}`);
    }

    // Merge updates with existing data
    const updated = { ...existing, ...data, updatedAt: Date.now() };

    // Validate updated entity
    const validation = validateStyleMapEntity(updated);
    if (!validation.isValid) {
      throw new Error(`Cannot update StyleMap: ${validation.errors.join(', ')}`);
    }

    // Save updated entity
    await this.stylemapDB.updateEntity(nodeId, data);
  }

  /**
   * Delete StyleMap entity and all related data
   */
  async deleteEntity(nodeId: TreeNodeId): Promise<void> {
    const entity = await this.stylemapDB.getEntity(nodeId);
    if (!entity) {
      throw new Error(`StyleMap entity not found: ${nodeId}`);
    }

    // Cascade delete handled by database
    await this.stylemapDB.deleteEntity(nodeId);
  }

  // ==================
  // Working Copy Operations (hierarchidb pattern)
  // ==================

  /**
   * Create working copy for editing
   */
  async createWorkingCopy(
    nodeId: TreeNodeId,
    isDraft: boolean = false
  ): Promise<StyleMapWorkingCopy> {
    // Check if working copy already exists
    const existing = await this.stylemapDB.getWorkingCopy(nodeId);
    if (existing) {
      throw new Error(`Working copy already exists for StyleMap: ${nodeId}`);
    }

    let workingCopy: StyleMapWorkingCopy;

    if (isDraft) {
      // Create draft working copy (new entity)
      workingCopy = {
        workingCopyId: generateUUID(),
        nodeId,
        workingCopyOf: nodeId,
        copiedAt: Date.now(),
        isDirty: true,
        updatedAt: Date.now(),
        createdAt: Date.now(),
        version: 1,
      } as StyleMapWorkingCopy;
    } else {
      // Create working copy from existing entity
      const entity = await this.stylemapDB.getEntity(nodeId);
      if (!entity) {
        throw new Error(`Cannot create working copy: StyleMap entity not found: ${nodeId}`);
      }

      workingCopy = createStyleMapWorkingCopy(entity, generateUUID());
    }

    // Save working copy
    await this.stylemapDB.createWorkingCopy(workingCopy);

    return workingCopy;
  }

  /**
   * Get working copy for node
   */
  async getWorkingCopy(nodeId: TreeNodeId): Promise<StyleMapWorkingCopy | undefined> {
    return await this.stylemapDB.getWorkingCopy(nodeId);
  }

  /**
   * Update working copy
   */
  async updateWorkingCopy(
    nodeId: TreeNodeId,
    updates: Partial<StyleMapWorkingCopy>
  ): Promise<void> {
    const workingCopy = await this.stylemapDB.getWorkingCopy(nodeId);
    if (!workingCopy) {
      throw new Error(`Working copy not found for StyleMap: ${nodeId}`);
    }

    // Mark as dirty and update timestamp
    const updatedData = {
      ...updates,
      isDirty: true,
      updatedAt: Date.now(),
    };

    await this.stylemapDB.updateWorkingCopy(workingCopy.workingCopyId, updatedData);
  }

  /**
   * Commit working copy changes
   */
  async commitWorkingCopy(nodeId: TreeNodeId, workingCopy?: StyleMapWorkingCopy): Promise<void> {
    // If workingCopy is not provided, fetch it from the database
    const wc = workingCopy || (await this.stylemapDB.getWorkingCopy(nodeId));
    if (!wc) {
      throw new Error(`Working copy not found for StyleMap: ${nodeId}`);
    }

    if ((wc as any).isDraft) {
      // Create new entity from draft
      const entity = this.workingCopyToEntity(wc);
      await this.stylemapDB.saveEntity(entity);
    } else {
      // Update existing entity
      const entity = await this.stylemapDB.getEntity(nodeId);
      if (!entity) {
        throw new Error(`Target entity not found for commit: ${nodeId}`);
      }

      const updates = this.extractEntityUpdates(wc, entity);
      await this.stylemapDB.updateEntity(nodeId, updates);
    }

    // Delete working copy after successful commit
    await this.stylemapDB.deleteWorkingCopy(nodeId);
  }

  /**
   * Discard working copy changes
   */
  async discardWorkingCopy(nodeId: TreeNodeId): Promise<void> {
    await this.stylemapDB.deleteWorkingCopy(nodeId);
  }

  // ==================
  // StyleMap-Specific Operations
  // ==================

  /**
   * Import table data from file
   */
  async importTableData(
    nodeId: TreeNodeId,
    file: File,
    options: {
      keyColumn?: string;
      valueColumn?: string;
      filterRules?: FilterRule[];
    } = {}
  ): Promise<TableImportResult> {
    const entity = await this.stylemapDB.getEntity(nodeId);
    if (!entity) {
      throw new Error(`StyleMap entity not found: ${nodeId}`);
    }

    try {
      // Parse file content (implementation depends on file type)
      const { parseCSVFile } = await import('../utils/csvParser');
      const fileContent = await file.text();
      const delimiter = file.name.endsWith('.tsv') ? '	' : ',';
      const parseResult = parseCSVFile(fileContent, delimiter);

      // Create table metadata
      const { createTableMetadataEntity, analyzeColumnData } = await import(
        '../types/TableMetadataEntity'
      );

      const columnMetadata = parseResult.headers.map((colName, index) => {
        const columnValues = parseResult.rows
          .map((row) => row[index])
          .filter((v): v is string | number | null => v !== undefined);
        return analyzeColumnData(colName, columnValues);
      });

      const tableMetadata = createTableMetadataEntity(nodeId, file.name, {
        format: file.name.endsWith('.tsv') ? 'tsv' : 'csv',
        fileSize: file.size,
        encoding: 'utf-8', // TODO: Detect encoding
        contentHash: await this.generateFileHash(file),
        columns: columnMetadata,
        rowCount: parseResult.rows.length,
      });

      // Save table metadata
      await this.stylemapDB.saveTableMetadata(tableMetadata);

      // Create row entities
      const { createRowEntity } = await import('../types/TableMetadataEntity');
      const rowEntities = parseResult.rows.map((rowData, index) =>
        createRowEntity(tableMetadata.tableId, index, rowData)
      );

      // Batch insert rows
      await this.stylemapDB.batchInsertRows(rowEntities);

      // Update entity with table reference
      await this.stylemapDB.updateEntity(nodeId, {
        tableMetadataId: tableMetadata.tableId,
        filename: file.name,
        keyColumn: options.keyColumn,
        valueColumn: options.valueColumn,
        filterRules: options.filterRules,
      });

      return {
        metadata: tableMetadata,
        rowCount: parseResult.rows.length,
        warnings: [],
        errors: [],
      };
    } catch (error) {
      return {
        metadata: {} as TableMetadataEntity,
        rowCount: 0,
        warnings: [],
        errors: [error instanceof Error ? error.message : 'Unknown import error'],
      };
    }
  }

  /**
   * Query table data with options
   */
  async queryTableData(
    nodeId: TreeNodeId,
    options: TableQueryOptions = {}
  ): Promise<TableQueryResult> {
    const entity = await this.stylemapDB.getEntity(nodeId);
    if (!entity?.tableMetadataId) {
      throw new Error(`No table data found for StyleMap: ${nodeId}`);
    }

    return await this.stylemapDB.queryTableRows(entity.tableMetadataId, options);
  }

  /**
   * Apply filter rules to table data
   */
  async applyFilterRules(
    nodeId: TreeNodeId,
    filterRules: FilterRule[]
  ): Promise<{
    filteredRows: Array<Array<string | number | null>>;
    stats: {
      totalRows: number;
      matchedRows: number;
      resultRows: number;
      matchRate: number;
    };
  }> {
    const entity = await this.stylemapDB.getEntity(nodeId);
    if (!entity?.tableMetadataId) {
      throw new Error(`No table data found for StyleMap: ${nodeId}`);
    }

    // Get table metadata for column information
    const tableMetadata = await this.stylemapDB.getTableMetadata(entity.tableMetadataId);
    if (!tableMetadata) {
      throw new Error(`Table metadata not found: ${entity.tableMetadataId}`);
    }

    // Get all table rows
    const queryResult = await this.stylemapDB.queryTableRows(entity.tableMetadataId, {
      limit: 1000000, // Large limit to get all rows
    });

    // Apply filter rules
    const { applyFilterRules } = await import('../types/FilterRule');
    const columns = tableMetadata.columns.map((col) => col.name);

    return applyFilterRules(
      queryResult.rows as Array<Array<string | number>>,
      filterRules,
      columns
    );
  }

  /**
   * Generate color mapping from configuration
   */
  async generateColorMapping(
    nodeId: TreeNodeId,
    config: StyleMapConfig
  ): Promise<{
    properties: Array<{
      keyValue: string | number;
      styleValue: any;
    }>;
    stats: {
      totalValues: number;
      mappedValues: number;
      minValue: number;
      maxValue: number;
    };
  }> {
    const entity = await this.stylemapDB.getEntity(nodeId);
    if (!entity?.tableMetadataId || !entity.keyColumn || !entity.valueColumn) {
      throw new Error(`StyleMap not properly configured for color mapping: ${nodeId}`);
    }

    // Get filtered data
    const filterResult = await this.applyFilterRules(nodeId, entity.filterRules || []);
    const tableMetadata = await this.stylemapDB.getTableMetadata(entity.tableMetadataId);

    if (!tableMetadata) {
      throw new Error(`Table metadata not found: ${entity.tableMetadataId}`);
    }

    const columns = tableMetadata.columns.map((col) => col.name);
    const keyColumnIndex = columns.indexOf(entity.keyColumn);
    const valueColumnIndex = columns.indexOf(entity.valueColumn);

    if (keyColumnIndex === -1 || valueColumnIndex === -1) {
      throw new Error('Key or value column not found in table data');
    }

    // Extract key-value pairs
    const keyValuePairs = filterResult.filteredRows
      .map((row) => ({
        key: row[keyColumnIndex],
        value: Number(row[valueColumnIndex]),
      }))
      .filter((pair) => !isNaN(pair.value));

    // Generate color mapping
    const { generateColorMapping } = await import('../utils/colorMapping');
    const values = keyValuePairs.map((pair) => pair.value);
    const colorMapping = generateColorMapping(config, values);

    // Combine with keys
    const properties = keyValuePairs.map((pair, index) => ({
      keyValue: pair.key as string | number,
      styleValue: colorMapping[index],
    }));

    const stats = {
      totalValues: filterResult.filteredRows.length,
      mappedValues: properties.length,
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
    };

    return { properties, stats };
  }

  /**
   * Generate cache key for StyleMap configuration
   */
  async generateCacheKey(nodeId: TreeNodeId): Promise<string> {
    const entity = await this.stylemapDB.getEntity(nodeId);
    if (!entity) {
      throw new Error(`StyleMap entity not found: ${nodeId}`);
    }

    const { generateCacheKey } = await import('../utils/hashUtils');
    return await generateCacheKey(entity.filename || 'untitled', entity.styleMapConfig);
  }

  /**
   * Clear cache for StyleMap
   */
  async clearCache(nodeId: TreeNodeId): Promise<void> {
    const entity = await this.stylemapDB.getEntity(nodeId);
    if (entity?.cacheKey) {
      await this.stylemapDB.deleteCache(entity.cacheKey);
    }
  }

  // ==================
  // Helper Methods
  // ==================

  /**
   * Convert working copy to entity format
   */
  protected workingCopyToEntity(workingCopy: StyleMapWorkingCopy): StyleMapEntity {
    const { workingCopyId, workingCopyOf, copiedAt, isDirty, ...entityData } = workingCopy;

    return {
      ...entityData,
      createdAt: entityData.createdAt || Date.now(),
      updatedAt: Date.now(),
      version: entityData.version || 1,
    } as StyleMapEntity;
  }

  /**
   * Extract entity updates from working copy
   */
  private extractEntityUpdates(
    workingCopy: StyleMapWorkingCopy,
    originalEntity: StyleMapEntity
  ): StyleMapUpdateData {
    const {
      workingCopyId,
      workingCopyOf,
      copiedAt,
      isDirty,
      nodeId,
      createdAt,
      version,
      ...updates
    } = workingCopy;

    // Only include fields that have actually changed
    const changedFields: StyleMapUpdateData = {};

    Object.keys(updates).forEach((key) => {
      const typedKey = key as keyof typeof updates;
      if (JSON.stringify(updates[typedKey]) !== JSON.stringify(originalEntity[typedKey])) {
        (changedFields as any)[typedKey] = updates[typedKey];
      }
    });

    return changedFields;
  }

  /**
   * Generate hash for file content
   */
  private async generateFileHash(file: File): Promise<string> {
    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', uint8Array);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }

  /**
   * Get default entity values
   */
  protected getDefaultEntity(): Partial<StyleMapEntity> {
    return {
      filename: 'Untitled.csv',
      filterRules: [],
      keyColumn: undefined,
      valueColumn: undefined,
      styleMapConfig: undefined,
    };
  }

  /**
   * Get default working copy values
   */
  protected getDefaultWorkingCopy(): Partial<StyleMapWorkingCopy> {
    return {
      filename: 'Untitled.csv',
      filterRules: [],
      isDirty: false,
    };
  }
}
