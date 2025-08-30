/**
 * @file WorkingCopyManager.ts
 * @description Unified manager for working copy operations across all plugins
 */

import type { NodeId, EntityId } from '@hierarchidb/common-core';
import type { BaseEntity, BaseWorkingCopy } from '../types';
import type { BaseEntityHandler } from '../handlers/BaseEntityHandler';
import { generateEntityId } from '../utils/id-generator';

/**
 * Working copy storage interface
 */
export interface IWorkingCopyStorage<TWorkingCopy extends BaseWorkingCopy> {
  get(id: EntityId): Promise<TWorkingCopy | undefined>;
  set(id: EntityId, workingCopy: TWorkingCopy): Promise<void>;
  delete(id: EntityId): Promise<void>;
  has(id: EntityId): Promise<boolean>;
  clear(): Promise<void>;
}

/**
 * In-memory working copy storage implementation
 */
export class MemoryWorkingCopyStorage<TWorkingCopy extends BaseWorkingCopy> 
  implements IWorkingCopyStorage<TWorkingCopy> {
  
  private storage = new Map<EntityId, TWorkingCopy>();

  async get(id: EntityId): Promise<TWorkingCopy | undefined> {
    return this.storage.get(id);
  }

  async set(id: EntityId, workingCopy: TWorkingCopy): Promise<void> {
    this.storage.set(id, workingCopy);
  }

  async delete(id: EntityId): Promise<void> {
    this.storage.delete(id);
  }

  async has(id: EntityId): Promise<boolean> {
    return this.storage.has(id);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }
}

/**
 * Working copy validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Working copy manager for handling entity editing sessions
 */
export class WorkingCopyManager<
  TEntity extends BaseEntity,
  TWorkingCopy extends BaseWorkingCopy
> {
  constructor(
    private entityHandler: BaseEntityHandler<TEntity, TWorkingCopy>,
    private storage: IWorkingCopyStorage<TWorkingCopy> = new MemoryWorkingCopyStorage()
  ) {}

  /**
   * Create working copy from existing entity
   */
  async createWorkingCopy(entity: TEntity): Promise<TWorkingCopy> {
    const workingCopy = this.buildWorkingCopy(entity);
    await this.storage.set(workingCopy.id, workingCopy);
    return workingCopy;
  }

  /**
   * Create working copy from entity ID
   */
  async createWorkingCopyFromId(entityId: EntityId): Promise<TWorkingCopy> {
    const entity = await this.entityHandler.getEntity(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }
    return this.createWorkingCopy(entity);
  }

  /**
   * Create new draft working copy (for new entities)
   */
  async createNewDraftWorkingCopy(
    parentNodeId?: NodeId,
    initialData?: Partial<TEntity>
  ): Promise<TWorkingCopy> {
    const workingCopyId = generateEntityId() as EntityId;
    
    const workingCopy = this.buildDraftWorkingCopy(
      workingCopyId,
      parentNodeId,
      initialData
    );
    
    await this.storage.set(workingCopyId, workingCopy);
    return workingCopy;
  }

  /**
   * Get working copy by ID
   */
  async getWorkingCopy(workingCopyId: EntityId): Promise<TWorkingCopy | undefined> {
    return await this.storage.get(workingCopyId);
  }

  /**
   * Update working copy
   */
  async updateWorkingCopy(
    workingCopyId: EntityId,
    updates: Partial<TWorkingCopy>
  ): Promise<TWorkingCopy> {
    const existing = await this.getWorkingCopy(workingCopyId);
    if (!existing) {
      throw new Error(`Working copy not found: ${workingCopyId}`);
    }

    const updated: TWorkingCopy = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
      modifiedFields: this.trackModifiedFields(existing, updates),
    };

    await this.storage.set(workingCopyId, updated);
    return updated;
  }

  /**
   * Commit working copy to entity storage
   */
  async commitWorkingCopy(workingCopyId: EntityId): Promise<NodeId> {
    const workingCopy = await this.getWorkingCopy(workingCopyId);
    if (!workingCopy) {
      throw new Error(`Working copy not found: ${workingCopyId}`);
    }

    // Validate before commit
    const validation = await this.validateWorkingCopy(workingCopy);
    if (!validation.valid) {
      throw new Error(
        `Working copy validation failed: ${validation.errors?.join(', ')}`
      );
    }

    let nodeId: NodeId;

    if (workingCopy.isDraft) {
      // Create new entity
      const entityData = this.prepareEntityData(workingCopy);
      const entity = await this.entityHandler.createEntity(
        workingCopy.nodeId || ('' as NodeId),
        entityData
      );
      nodeId = entity.nodeId;
    } else {
      // Update existing entity
      const updates = this.prepareEntityUpdates(workingCopy);
      await this.entityHandler.updateEntity(workingCopy.id, updates);
      nodeId = workingCopy.nodeId;
    }

    // Clean up working copy
    await this.discardWorkingCopy(workingCopyId);

    return nodeId;
  }

  /**
   * Discard working copy
   */
  async discardWorkingCopy(workingCopyId: EntityId): Promise<void> {
    await this.storage.delete(workingCopyId);
  }

  /**
   * Check if working copy exists
   */
  async hasWorkingCopy(workingCopyId: EntityId): Promise<boolean> {
    return await this.storage.has(workingCopyId);
  }

  /**
   * Get all working copy IDs
   */
  async getAllWorkingCopyIds(): Promise<EntityId[]> {
    // This would need to be implemented based on storage type
    // For memory storage, we can expose the keys
    if (this.storage instanceof MemoryWorkingCopyStorage) {
      return Array.from((this.storage as any).storage.keys());
    }
    return [];
  }

  /**
   * Clear all working copies
   */
  async clearAllWorkingCopies(): Promise<void> {
    await this.storage.clear();
  }

  /**
   * Check if working copy has changes
   */
  async hasChanges(workingCopyId: EntityId): Promise<boolean> {
    const workingCopy = await this.getWorkingCopy(workingCopyId);
    if (!workingCopy) {
      return false;
    }

    if (workingCopy.isDraft) {
      return true;
    }

    return (workingCopy.modifiedFields?.length || 0) > 0;
  }

  /**
   * Get changes in working copy
   */
  async getChanges(workingCopyId: EntityId): Promise<Partial<TWorkingCopy> | null> {
    const workingCopy = await this.getWorkingCopy(workingCopyId);
    if (!workingCopy) {
      return null;
    }

    if (!workingCopy.modifiedFields || workingCopy.modifiedFields.length === 0) {
      return null;
    }

    const changes: Partial<TWorkingCopy> = {};
    for (const field of workingCopy.modifiedFields) {
      changes[field as keyof TWorkingCopy] = workingCopy[field as keyof TWorkingCopy];
    }

    return changes;
  }

  /**
   * Revert working copy to original state
   */
  async revertWorkingCopy(workingCopyId: EntityId): Promise<TWorkingCopy> {
    const workingCopy = await this.getWorkingCopy(workingCopyId);
    if (!workingCopy) {
      throw new Error(`Working copy not found: ${workingCopyId}`);
    }

    if (workingCopy.isDraft) {
      throw new Error('Cannot revert draft working copy');
    }

    // Reload from entity
    const entity = await this.entityHandler.getEntity(workingCopy.id);
    if (!entity) {
      throw new Error(`Entity not found: ${workingCopy.id}`);
    }

    const reverted = this.buildWorkingCopy(entity);
    await this.storage.set(workingCopyId, reverted);
    
    return reverted;
  }

  /**
   * Validate working copy
   */
  async validateWorkingCopy(workingCopy: TWorkingCopy): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation - can be overridden
    if (!workingCopy.id) {
      errors.push('Working copy ID is required');
    }

    if (!workingCopy.isDraft && !workingCopy.nodeId) {
      errors.push('Node ID is required for non-draft working copies');
    }

    // Additional validation can be added by extending classes
    const additionalValidation = await this.performAdditionalValidation(workingCopy);
    errors.push(...(additionalValidation.errors || []));
    warnings.push(...(additionalValidation.warnings || []));

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Build working copy from entity
   * Can be overridden by derived classes
   */
  protected buildWorkingCopy(entity: TEntity): TWorkingCopy {
    return {
      ...entity,
      isDraft: false,
      copiedAt: Date.now(),
      originalVersion: entity.version,
      modifiedFields: [],
    } as TWorkingCopy;
  }

  /**
   * Build draft working copy
   * Can be overridden by derived classes
   */
  protected buildDraftWorkingCopy(
    workingCopyId: EntityId,
    parentNodeId?: NodeId,
    initialData?: Partial<TEntity>
  ): TWorkingCopy {
    return {
      id: workingCopyId,
      nodeId: '' as NodeId, // Will be set on commit
      isDraft: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      copiedAt: Date.now(),
      modifiedFields: [],
      ...initialData,
    } as TWorkingCopy;
  }

  /**
   * Track modified fields
   */
  protected trackModifiedFields(
    existing: TWorkingCopy,
    updates: Partial<TWorkingCopy>
  ): string[] {
    const modifiedFields = existing.modifiedFields || [];
    const newFields = Object.keys(updates).filter(
      key => !['updatedAt', 'modifiedFields'].includes(key)
    );

    // Add new fields to modified list if not already there
    for (const field of newFields) {
      if (!modifiedFields.includes(field)) {
        modifiedFields.push(field);
      }
    }

    return modifiedFields;
  }

  /**
   * Prepare entity data from working copy for creation
   */
  protected prepareEntityData(workingCopy: TWorkingCopy): Partial<TEntity> {
    const { isDraft, copiedAt, originalVersion, modifiedFields, ...entityData } = workingCopy;
    return entityData as Partial<TEntity>;
  }

  /**
   * Prepare entity updates from working copy
   */
  protected prepareEntityUpdates(workingCopy: TWorkingCopy): Partial<TEntity> {
    const { isDraft, copiedAt, originalVersion, modifiedFields, ...updates } = workingCopy;
    return updates as Partial<TEntity>;
  }

  /**
   * Perform additional validation (can be overridden)
   */
  protected async performAdditionalValidation(
    workingCopy: TWorkingCopy
  ): Promise<ValidationResult> {
    return { valid: true };
  }

  /**
   * Create a snapshot of working copy
   */
  async createSnapshot(workingCopyId: EntityId): Promise<TWorkingCopy> {
    const workingCopy = await this.getWorkingCopy(workingCopyId);
    if (!workingCopy) {
      throw new Error(`Working copy not found: ${workingCopyId}`);
    }

    return { ...workingCopy };
  }

  /**
   * Restore working copy from snapshot
   */
  async restoreFromSnapshot(
    workingCopyId: EntityId,
    snapshot: TWorkingCopy
  ): Promise<void> {
    await this.storage.set(workingCopyId, { ...snapshot });
  }

  /**
   * Merge changes from another working copy
   */
  async mergeChanges(
    targetWorkingCopyId: EntityId,
    sourceWorkingCopyId: EntityId,
    overwrite: boolean = false
  ): Promise<TWorkingCopy> {
    const target = await this.getWorkingCopy(targetWorkingCopyId);
    const source = await this.getWorkingCopy(sourceWorkingCopyId);

    if (!target || !source) {
      throw new Error('Target or source working copy not found');
    }

    const merged = overwrite
      ? { ...target, ...source, id: target.id }
      : { ...source, ...target, id: target.id };

    merged.updatedAt = Date.now();
    merged.modifiedFields = [
      ...new Set([
        ...(target.modifiedFields || []),
        ...(source.modifiedFields || []),
      ]),
    ];

    await this.storage.set(targetWorkingCopyId, merged as TWorkingCopy);
    return merged as TWorkingCopy;
  }
}