/**
 * BaseMap Entity Handler for Worker layer
 * Handles database operations and business logic
 */

import { NodeId, EntityId, generateEntityId } from '@hierarchidb/common-core';
// Note: BaseEntityHandler requires database instances we don't have access to yet
// This is a standalone implementation following the same interface pattern
import {
  BaseMapEntity,
  BaseMapWorkingCopy,
  CreateBaseMapData,
  UpdateBaseMapData,
  DEFAULT_MAP_CONFIG,
  validateCreateBaseMapDataStrict,
  validateUpdateBaseMapDataStrict,
  BaseMapAsyncValidator,
  mergeBaseMapEntity,
  BaseMapErrorFactory,
  BaseMapDataValidationError,
  isCreateBaseMapData,
  isUpdateBaseMapData,
} from '../../shared';

/**
 * BaseMap entity handler extending the base entity handler
 */
export class BaseMapEntityHandler {
  // Mock storage - in real implementation this would connect to Dexie
  private storage = new Map<NodeId, BaseMapEntity>();
  private workingCopyStorage = new Map<NodeId, BaseMapWorkingCopy>();

  constructor() {
    // Initialize handler
  }

  /**
   * Create a new BaseMap entity
   */
  async createEntity(nodeId: NodeId, data: CreateBaseMapData): Promise<BaseMapEntity> {
    // Type guard validation
    if (!isCreateBaseMapData(data)) {
      throw BaseMapErrorFactory.databaseOperation('create', 'Invalid input data structure');
    }

    // Synchronous validation
    const syncValidation = validateCreateBaseMapDataStrict(data);
    if (!syncValidation.isValid) {
      throw new BaseMapDataValidationError('Invalid BaseMap data', 'data', syncValidation.errors);
    }

    // Asynchronous validation (business rules)
    const asyncValidator = new BaseMapAsyncValidator();
    const asyncValidation = await asyncValidator.validate(data);
    if (!asyncValidation.isValid) {
      throw new BaseMapDataValidationError(
        'BaseMap validation failed',
        'data',
        asyncValidation.errors
      );
    }

    // Generate entity ID and timestamps
    const entityId = generateEntityId() as EntityId;
    const now = Date.now();

    // Create entity with defaults
    const entity: BaseMapEntity = {
      id: entityId,
      nodeId,
      name: data.name,
      description: data.description,
      mapStyle: data.mapStyle,
      styleUrl: data.styleUrl,
      styleConfig: data.styleConfig,
      center: data.center,
      zoom: data.zoom,
      bearing: data.bearing ?? DEFAULT_MAP_CONFIG.bearing!,
      pitch: data.pitch ?? DEFAULT_MAP_CONFIG.pitch!,
      bounds: data.bounds,
      displayOptions: data.displayOptions ?? DEFAULT_MAP_CONFIG.displayOptions,
      apiKey: data.apiKey,
      attribution: data.attribution,
      thumbnailUrl: undefined, // Will be output on demand
      tags: data.tags,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // Store entity in database
    this.storage.set(nodeId, entity);

    return entity;
  }

  /**
   * Get BaseMap entity by node ID
   */
  async getEntity(nodeId: NodeId): Promise<BaseMapEntity | undefined> {
    return this.storage.get(nodeId);
  }

  /**
   * Update BaseMap entity
   */
  async updateEntity(nodeId: NodeId, data: UpdateBaseMapData): Promise<void> {
    // Get existing entity
    const existing = await this.storage.get(nodeId);
    if (!existing) {
      throw BaseMapErrorFactory.entityNotFound(nodeId as string);
    }

    // Type guard validation
    if (!isUpdateBaseMapData(data)) {
      throw BaseMapErrorFactory.databaseOperation('update', 'Invalid update data structure');
    }

    // Synchronous validation
    const syncValidation = validateUpdateBaseMapDataStrict(data);
    if (!syncValidation.isValid) {
      throw new BaseMapDataValidationError(
        'Invalid BaseMap update data',
        'data',
        syncValidation.errors
      );
    }

    // Asynchronous validation for name uniqueness (if name is being changed)
    if (data.name && data.name !== existing.name) {
      const asyncValidator = new BaseMapAsyncValidator();
      // Convert UpdateBaseMapData to CreateBaseMapData for validation
      const dataForValidation: CreateBaseMapData = {
        ...existing,
        ...data,
        name: data.name, // Ensure name is not undefined
      };
      const asyncValidation = await asyncValidator.validate(dataForValidation);
      if (!asyncValidation.isValid) {
        throw new BaseMapDataValidationError(
          'BaseMap update validation failed',
          'data',
          asyncValidation.errors
        );
      }
    }

    // Merge updates with existing entity
    const updatedEntity = mergeBaseMapEntity(existing, data);

    // Store updated entity
    this.storage.set(updatedEntity.nodeId, updatedEntity);
  }

  /**
   * Delete BaseMap entity
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    this.storage.delete(nodeId);
  }

  /**
   * Create working copy for editing
   */
  async createWorkingCopy(nodeId: NodeId): Promise<BaseMapWorkingCopy> {
    const entity = await this.storage.get(nodeId);
    if (!entity) {
      throw new Error('BaseMap entity not found');
    }

    const now = Date.now();

    const workingCopy: BaseMapWorkingCopy = {
      // TreeNode base fields
      nodeType: 'basemap',
      id: nodeId,
      parentId: '' as NodeId, // Will be set by caller
      name: entity.name,
      description: entity.description,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      version: entity.version,

      // WorkingCopyProperties
      originalNodeId: nodeId,
      copiedAt: now,
      hasEntityCopy: true,

      // BaseMapWorkingCopy specific fields
      workingCopyId: generateEntityId(),
      workingCopyOf: nodeId,
      isDirty: false,

      // BaseMap-specific fields
      nodeId: entity.nodeId,
      mapStyle: entity.mapStyle,
      styleUrl: entity.styleUrl,
      styleConfig: entity.styleConfig,
      center: entity.center,
      zoom: entity.zoom,
      bearing: entity.bearing,
      pitch: entity.pitch,
      bounds: entity.bounds,
      displayOptions: entity.displayOptions,
      apiKey: entity.apiKey,
      attribution: entity.attribution,
      thumbnailUrl: entity.thumbnailUrl,
      tags: entity.tags,
    };

    // Store the working copy
    this.workingCopyStorage.set(nodeId, workingCopy);

    return workingCopy;
  }

  /**
   * Update working copy
   */
  async updateWorkingCopy(
    workingCopy: BaseMapWorkingCopy,
    data: UpdateBaseMapData
  ): Promise<BaseMapWorkingCopy> {
    // Validate update data
    const validation = validateUpdateBaseMapDataStrict(data);
    if (!validation.isValid) {
      throw new Error(
        `Invalid BaseMap update data: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }

    // Update working copy with new data
    const updatedWorkingCopy: BaseMapWorkingCopy = {
      ...workingCopy,
      ...data,
      updatedAt: Date.now(),
      version: workingCopy.version + 1,
      isDirty: true,
    };

    return updatedWorkingCopy;
  }

  /**
   * Commit working copy to entity
   */
  async commitWorkingCopy(nodeId: NodeId, workingCopy: BaseMapWorkingCopy): Promise<void> {
    const entityData: BaseMapEntity = {
      id: generateEntityId() as EntityId,
      nodeId: workingCopy.nodeId,
      name: workingCopy.name,
      description: workingCopy.description,
      mapStyle: workingCopy.mapStyle,
      styleUrl: workingCopy.styleUrl,
      styleConfig: workingCopy.styleConfig,
      center: workingCopy.center,
      zoom: workingCopy.zoom,
      bearing: workingCopy.bearing,
      pitch: workingCopy.pitch,
      bounds: workingCopy.bounds,
      displayOptions: workingCopy.displayOptions,
      apiKey: workingCopy.apiKey,
      attribution: workingCopy.attribution,
      thumbnailUrl: workingCopy.thumbnailUrl,
      tags: workingCopy.tags,
      createdAt: workingCopy.createdAt,
      updatedAt: workingCopy.updatedAt,
      version: workingCopy.version,
    };

    this.storage.set(entityData.nodeId, entityData);
    this.workingCopyStorage.delete(nodeId);
  }

  /**
   * Validate entity data before operations
   */
  protected validateEntity(entity: BaseMapEntity): void {
    const validation = validateUpdateBaseMapDataStrict({
      name: entity.name,
      mapStyle: entity.mapStyle,
      center: entity.center,
      zoom: entity.zoom,
      bearing: entity.bearing,
      pitch: entity.pitch,
      bounds: entity.bounds,
    });

    if (!validation.isValid) {
      throw new Error(
        `Invalid BaseMap entity: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }
  }

  /**
   * Get entity table name for database operations
   */
  protected getTableName(): string {
    return 'basemaps';
  }

  /**
   * Transform entity before storage (hook for subclasses)
   */
  protected async beforeStore(entity: BaseMapEntity): Promise<BaseMapEntity> {
    // Ensure required fields are set
    if (!entity.center) entity.center = DEFAULT_MAP_CONFIG.center!;
    if (entity.zoom === undefined) entity.zoom = DEFAULT_MAP_CONFIG.zoom!;
    if (entity.bearing === undefined) entity.bearing = DEFAULT_MAP_CONFIG.bearing!;
    if (entity.pitch === undefined) entity.pitch = DEFAULT_MAP_CONFIG.pitch!;
    if (!entity.displayOptions) entity.displayOptions = DEFAULT_MAP_CONFIG.displayOptions!;

    return entity;
  }

  /**
   * Transform entity after retrieval (hook for subclasses)
   */
  protected async afterRetrieve(entity: BaseMapEntity): Promise<BaseMapEntity> {
    // Ensure all required fields have default values
    return {
      ...entity,
      center: entity.center || DEFAULT_MAP_CONFIG.center!,
      zoom: entity.zoom ?? DEFAULT_MAP_CONFIG.zoom!,
      bearing: entity.bearing ?? DEFAULT_MAP_CONFIG.bearing!,
      pitch: entity.pitch ?? DEFAULT_MAP_CONFIG.pitch!,
      displayOptions: entity.displayOptions || DEFAULT_MAP_CONFIG.displayOptions!,
    };
  }
}
