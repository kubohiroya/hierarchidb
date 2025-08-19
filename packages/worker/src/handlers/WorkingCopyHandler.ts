/**
 * @file WorkingCopyHandler.ts
 * @description Advanced working copy management handler
 * Implements Copy-on-Write pattern with conflict resolution and version control
 */

import type { BaseEntity, BaseSubEntity, BaseWorkingCopy, TreeNodeId } from '@hierarchidb/core';
import type Dexie from 'dexie';
import type { SimpleEntity, SimpleSubEntity, SimpleWorkingCopy } from './SimpleEntityHandler';
import type { ExtendedSubEntity } from './SubEntityHandler';
import { SubEntityHandler } from './SubEntityHandler';

/**
 * Enhanced working copy with additional tracking
 */
export interface EnhancedWorkingCopy extends BaseWorkingCopy {
  nodeId: TreeNodeId;
  name: string; // Required by SimpleWorkingCopy
  description?: string;
  value?: number;
  data?: Record<string, any>;
  workingCopyId: string;
  workingCopyOf: TreeNodeId;
  copiedAt: number;
  isDirty: boolean;

  // Change tracking
  changes: {
    modified: string[];
    added: string[];
    deleted: string[];
  };

  // Conflict detection
  baseVersion: number;
  conflicts?: Array<{
    field: string;
    baseValue: any;
    currentValue: any;
    workingValue: any;
  }>;

  // Metadata
  metadata: {
    author?: string;
    description?: string;
    tags?: string[];
    autoSave?: boolean;
    lastAutoSave?: number;
  };

  // Entity data
  entityData: any;
  subEntitiesData?: Record<string, ExtendedSubEntity[]>;

  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * Working copy conflict resolution strategy
 */
export type ConflictResolutionStrategy =
  | 'working' // Use working copy value
  | 'current' // Use current entity value
  | 'merge' // Attempt automatic merge
  | 'manual'; // Require manual resolution

/**
 * Working copy commit options
 */
export interface CommitOptions {
  conflictResolution?: ConflictResolutionStrategy;
  message?: string;
  author?: string;
  skipValidation?: boolean;
  preserveSubEntities?: boolean;
}

/**
 * Working copy status
 */
export interface WorkingCopyStatus {
  exists: boolean;
  isDirty: boolean;
  hasConflicts: boolean;
  changeCount: number;
  lastModified?: number;
  canCommit: boolean;
}

/**
 * Advanced handler for working copy management
 * Implements Copy-on-Write pattern with comprehensive change tracking
 */
export class WorkingCopyHandler extends SubEntityHandler {
  private workingCopyCache: Map<TreeNodeId, EnhancedWorkingCopy> = new Map();
  private autoSaveTimers: Map<TreeNodeId, NodeJS.Timeout> = new Map();

  constructor(
    db: Dexie,
    tableName: string,
    workingCopyTableName: string,
    subEntityTableName: string
  ) {
    super(db, tableName, workingCopyTableName, subEntityTableName);
  }

  /**
   * Create an enhanced working copy
   */
  async createWorkingCopy(nodeId: TreeNodeId): Promise<EnhancedWorkingCopy> {
    // Check if working copy already exists
    const existing = await this.getWorkingCopy(nodeId);
    if (existing) {
      throw new Error(`Working copy already exists for node: ${nodeId}`);
    }

    const entity = await this.getEntity(nodeId);
    const now = this.now();

    const workingCopy: EnhancedWorkingCopy = {
      nodeId,
      name: entity?.name || '', // Required by SimpleWorkingCopy
      description: entity?.description,
      value: entity?.value,
      data: entity?.data,
      workingCopyId: this.generateUUID(),
      workingCopyOf: nodeId,
      copiedAt: now,
      isDirty: false,
      changes: {
        modified: [],
        added: [],
        deleted: [],
      },
      baseVersion: entity?.version || 1,
      metadata: {
        author: undefined,
        description: undefined,
        autoSave: false,
        lastAutoSave: undefined,
      },
      entityData: entity ? { ...entity } : {},
      subEntitiesData: {},
      createdAt: entity?.createdAt || now,
      updatedAt: now,
      version: 1,
    };

    // Copy sub-entities if they exist
    if (this.subEntityTableName) {
      const subEntityTypes = Array.from(this.subEntityIndex.keys());
      for (const type of subEntityTypes) {
        const subEntities = await this.getSubEntities(nodeId, type);
        if (subEntities.length > 0) {
          workingCopy.subEntitiesData![type] = subEntities;
        }
      }
    }

    // Store in ephemeral database
    await this.db.table(this.workingCopyTableName).add(workingCopy);

    // Cache the working copy
    this.workingCopyCache.set(nodeId, workingCopy);

    // Start auto-save if configured
    if (workingCopy.metadata.autoSave) {
      this.setupAutoSave(nodeId, workingCopy.metadata.lastAutoSave || 30000);
    }

    this.log('Working copy created', {
      nodeId,
      workingCopyId: workingCopy.workingCopyId,
      hasEntity: !!entity,
    });

    return workingCopy;
  }

  /**
   * Get working copy for a node
   */
  async getWorkingCopy(nodeId: TreeNodeId): Promise<EnhancedWorkingCopy | undefined> {
    // Check cache first
    if (this.workingCopyCache.has(nodeId)) {
      return this.workingCopyCache.get(nodeId);
    }

    // Load from database
    const workingCopy = (await this.db
      .table(this.workingCopyTableName)
      .where('workingCopyOf')
      .equals(nodeId)
      .first()) as EnhancedWorkingCopy | undefined;

    if (workingCopy) {
      this.workingCopyCache.set(nodeId, workingCopy);
    }

    return workingCopy;
  }

  /**
   * Update working copy data
   */
  async updateWorkingCopy(
    nodeId: TreeNodeId,
    updates: Partial<any>,
    markDirty: boolean = true
  ): Promise<void> {
    const workingCopy = await this.getWorkingCopy(nodeId);
    if (!workingCopy) {
      throw new Error(`Working copy not found for node: ${nodeId}`);
    }

    const now = this.now();

    // Track changes
    const changedFields = Object.keys(updates);
    for (const field of changedFields) {
      if (!workingCopy.changes.modified.includes(field)) {
        workingCopy.changes.modified.push(field);
      }
    }

    // Update entity data
    workingCopy.entityData = {
      ...workingCopy.entityData,
      ...updates,
    };

    // Update metadata
    workingCopy.isDirty = markDirty;
    workingCopy.updatedAt = now;
    workingCopy.version++;

    // Save to database
    await this.db.table(this.workingCopyTableName).update(workingCopy.workingCopyId, workingCopy);

    // Update cache
    this.workingCopyCache.set(nodeId, workingCopy);

    this.log('Working copy updated', { nodeId, fields: changedFields });
  }

  /**
   * Commit working copy with conflict detection
   */
  async commitWorkingCopy(nodeId: TreeNodeId, workingCopy: EnhancedWorkingCopy): Promise<void> {
    // Validate working copy exists
    const existing = await this.getWorkingCopy(nodeId);
    if (!existing || existing.workingCopyId !== workingCopy.workingCopyId) {
      throw new Error(`Working copy not found or mismatch for node: ${nodeId}`);
    }

    // Check for conflicts
    const currentEntity = await this.getEntity(nodeId);
    const hasConflicts = currentEntity && currentEntity.version > workingCopy.baseVersion;

    if (hasConflicts) {
      // For now, use 'working' strategy by default - use working copy values
      this.log('Conflicts detected, using working copy values', {
        nodeId,
        baseVersion: workingCopy.baseVersion,
        currentVersion: currentEntity.version,
      });
    }

    // Begin transaction
    await this.db.transaction('rw', this.db.table(this.tableName), async () => {
      const now = this.now();

      // Prepare entity data
      const entityData = {
        ...workingCopy.entityData,
        nodeId,
        name: workingCopy.name,
        description: workingCopy.description,
        value: workingCopy.value,
        data: workingCopy.data,
        updatedAt: now,
        version: (currentEntity?.version || 0) + 1,
      };

      // Create or update entity
      if (currentEntity) {
        await this.updateEntity(nodeId, entityData);
      } else {
        await this.createEntity(nodeId, entityData);
      }

      // Commit sub-entities if configured
      if (workingCopy.subEntitiesData && this.subEntityTableName) {
        // Clear existing sub-entities
        await this.db.table(this.subEntityTableName).where('parentNodeId').equals(nodeId).delete();

        // Add all sub-entities from working copy
        for (const [type, subEntities] of Object.entries(workingCopy.subEntitiesData)) {
          for (const subEntity of subEntities) {
            await this.db.table(this.subEntityTableName).add({
              ...subEntity,
              parentNodeId: nodeId,
              updatedAt: now,
            });
          }
        }
      }
    });

    // Clean up
    await this.discardWorkingCopy(nodeId);

    // Stop auto-save if running
    this.cancelAutoSave(nodeId);

    this.log('Working copy committed', {
      nodeId,
      workingCopyId: workingCopy.workingCopyId,
      hadConflicts: hasConflicts,
    });
  }

  /**
   * Discard working copy and clean up
   */
  async discardWorkingCopy(nodeId: TreeNodeId): Promise<void> {
    const workingCopy = await this.getWorkingCopy(nodeId);
    if (!workingCopy) {
      return; // Already discarded
    }

    // Cancel auto-save if active
    this.cancelAutoSave(nodeId);

    // Delete from database
    await this.db.table(this.workingCopyTableName).delete(workingCopy.workingCopyId);

    // Remove from cache
    this.workingCopyCache.delete(nodeId);

    this.log('Working copy discarded', { nodeId });
  }

  /**
   * Get working copy status
   */
  async getWorkingCopyStatus(nodeId: TreeNodeId): Promise<WorkingCopyStatus> {
    const workingCopy = await this.getWorkingCopy(nodeId);

    if (!workingCopy) {
      return {
        exists: false,
        isDirty: false,
        hasConflicts: false,
        changeCount: 0,
        canCommit: false,
      };
    }

    const currentEntity = await this.getEntity(nodeId);
    const conflicts = currentEntity ? await this.detectConflicts(workingCopy, currentEntity) : [];

    const changeCount =
      workingCopy.changes.modified.length +
      workingCopy.changes.added.length +
      workingCopy.changes.deleted.length;

    return {
      exists: true,
      isDirty: workingCopy.isDirty,
      hasConflicts: conflicts.length > 0,
      changeCount,
      lastModified: workingCopy.updatedAt,
      canCommit: workingCopy.isDirty && currentEntity !== undefined,
    };
  }

  /**
   * Detect conflicts between working copy and current entity
   */
  private async detectConflicts(
    workingCopy: EnhancedWorkingCopy,
    currentEntity: SimpleEntity
  ): Promise<
    Array<{
      field: string;
      baseValue: any;
      currentValue: any;
      workingValue: any;
    }>
  > {
    const conflicts: Array<{
      field: string;
      baseValue: any;
      currentValue: any;
      workingValue: any;
    }> = [];

    // Check if entity has been modified since copy was created
    if (currentEntity.version > workingCopy.baseVersion) {
      // Compare each modified field
      for (const field of workingCopy.changes.modified) {
        const baseValue = (workingCopy.entityData as any)[field];
        const currentValue = (currentEntity as any)[field];
        const workingValue = (workingCopy.entityData as any)[field];

        // If current value differs from base and working differs from current
        if (
          JSON.stringify(currentValue) !== JSON.stringify(baseValue) &&
          JSON.stringify(workingValue) !== JSON.stringify(currentValue)
        ) {
          conflicts.push({
            field,
            baseValue,
            currentValue,
            workingValue,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts based on strategy
   */
  private async resolveConflicts(
    conflicts: Array<{
      field: string;
      baseValue: any;
      currentValue: any;
      workingValue: any;
    }>,
    workingCopy: EnhancedWorkingCopy,
    currentEntity: SimpleEntity,
    strategy: ConflictResolutionStrategy
  ): Promise<boolean> {
    switch (strategy) {
      case 'working':
        // Use working copy values (no action needed)
        return true;

      case 'current':
        // Use current entity values
        for (const conflict of conflicts) {
          (workingCopy.entityData as any)[conflict.field] = conflict.currentValue;
        }
        return true;

      case 'merge':
        // Attempt automatic merge (simple strategy)
        for (const conflict of conflicts) {
          // For strings, try to merge if both changed
          if (
            typeof conflict.workingValue === 'string' &&
            typeof conflict.currentValue === 'string'
          ) {
          }
          // For numbers, keep the larger value
          else if (
            typeof conflict.workingValue === 'number' &&
            typeof conflict.currentValue === 'number'
          ) {
            (workingCopy.entityData as any)[conflict.field] = Math.max(
              conflict.workingValue,
              conflict.currentValue
            );
          }
          // For objects, merge properties
          else if (
            typeof conflict.workingValue === 'object' &&
            typeof conflict.currentValue === 'object'
          ) {
            (workingCopy.entityData as any)[conflict.field] = {
              ...conflict.currentValue,
              ...conflict.workingValue,
            };
          }
        }
        return true;

      case 'manual':
        // Store conflicts for manual resolution
        workingCopy.conflicts = conflicts;
        return false;

      default:
        return false;
    }
  }

  /**
   * Commit sub-entities from working copy
   */
  private async commitSubEntities(
    nodeId: TreeNodeId,
    subEntitiesData: Record<string, ExtendedSubEntity[]>
  ): Promise<void> {
    // Delete all existing sub-entities
    const existingTypes = await this.getSubEntityTypes(nodeId);
    for (const type of existingTypes) {
      await this.deleteSubEntitiesByType(nodeId, type);
    }

    // Create new sub-entities from working copy
    for (const [type, entities] of Object.entries(subEntitiesData)) {
      for (const entity of entities) {
        const { id, parentNodeId, createdAt, updatedAt, version, ...data } = entity;
        await this.createSubEntity(nodeId, type, {
          ...data,
          id: id || this.generateUUID(),
          parentNodeId: nodeId,
          subEntityType: type,
          type: type,
          createdAt: createdAt || this.now(),
          updatedAt: updatedAt || this.now(),
          version: version || 1,
        } as ExtendedSubEntity);
      }
    }
  }

  /**
   * Setup auto-save for working copy
   */
  private setupAutoSave(nodeId: TreeNodeId, interval: number): void {
    // Cancel existing timer if any
    this.cancelAutoSave(nodeId);

    const timer = setInterval(async () => {
      try {
        const workingCopy = await this.getWorkingCopy(nodeId);
        if (workingCopy && workingCopy.isDirty) {
          workingCopy.metadata.lastAutoSave = this.now();
          await this.db
            .table(this.workingCopyTableName)
            .update(workingCopy.workingCopyId, { metadata: workingCopy.metadata });
          this.log('Auto-save completed', { nodeId });
        }
      } catch (error) {
        this.log('Auto-save failed', { nodeId, error });
      }
    }, interval);

    this.autoSaveTimers.set(nodeId, timer);
  }

  /**
   * Cancel auto-save for working copy
   */
  private cancelAutoSave(nodeId: TreeNodeId): void {
    const timer = this.autoSaveTimers.get(nodeId);
    if (timer) {
      clearInterval(timer);
      this.autoSaveTimers.delete(nodeId);
    }
  }

  /**
   * Create working copy from another working copy (branching)
   */
  async branchWorkingCopy(
    sourceNodeId: TreeNodeId,
    targetNodeId: TreeNodeId
  ): Promise<EnhancedWorkingCopy> {
    const sourceWorkingCopy = await this.getWorkingCopy(sourceNodeId);
    if (!sourceWorkingCopy) {
      throw new Error(`Source working copy not found: ${sourceNodeId}`);
    }

    // Check target doesn't have working copy
    const existingTarget = await this.getWorkingCopy(targetNodeId);
    if (existingTarget) {
      throw new Error(`Target already has working copy: ${targetNodeId}`);
    }

    const now = this.now();
    const branchedCopy: EnhancedWorkingCopy = {
      ...sourceWorkingCopy,
      nodeId: targetNodeId,
      workingCopyId: this.generateUUID(),
      workingCopyOf: targetNodeId,
      copiedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await this.db.table(this.workingCopyTableName).add(branchedCopy);
    this.workingCopyCache.set(targetNodeId, branchedCopy);

    return branchedCopy;
  }

  /**
   * Merge two working copies
   */
  async mergeWorkingCopies(
    sourceNodeId: TreeNodeId,
    targetNodeId: TreeNodeId,
    strategy: ConflictResolutionStrategy = 'merge'
  ): Promise<void> {
    const sourceWorkingCopy = await this.getWorkingCopy(sourceNodeId);
    const targetWorkingCopy = await this.getWorkingCopy(targetNodeId);

    if (!sourceWorkingCopy || !targetWorkingCopy) {
      throw new Error('Both working copies must exist for merge');
    }

    // Merge changes tracking
    targetWorkingCopy.changes.modified = [
      ...new Set([...targetWorkingCopy.changes.modified, ...sourceWorkingCopy.changes.modified]),
    ];
    targetWorkingCopy.changes.added = [
      ...new Set([...targetWorkingCopy.changes.added, ...sourceWorkingCopy.changes.added]),
    ];
    targetWorkingCopy.changes.deleted = [
      ...new Set([...targetWorkingCopy.changes.deleted, ...sourceWorkingCopy.changes.deleted]),
    ];

    // Merge entity data based on strategy
    if (strategy === 'merge') {
      // Merge: target takes priority, but missing fields come from source
      targetWorkingCopy.entityData = {
        ...targetWorkingCopy.entityData,
        ...sourceWorkingCopy.entityData,
      };
    }

    targetWorkingCopy.isDirty = true;
    targetWorkingCopy.updatedAt = this.now();
    targetWorkingCopy.version++;

    await this.db.table(this.workingCopyTableName).update(targetWorkingCopy.workingCopyId, {
      changes: targetWorkingCopy.changes,
      entityData: targetWorkingCopy.entityData,
      isDirty: targetWorkingCopy.isDirty,
      updatedAt: targetWorkingCopy.updatedAt,
      version: targetWorkingCopy.version,
    });

    // Update cache
    this.workingCopyCache.set(targetWorkingCopy.workingCopyOf, targetWorkingCopy);

    // Discard source working copy
    await this.discardWorkingCopy(sourceNodeId);
  }

  /**
   * Get all working copies
   */
  async getAllWorkingCopies(): Promise<EnhancedWorkingCopy[]> {
    return (await this.db.table(this.workingCopyTableName).toArray()) as EnhancedWorkingCopy[];
  }

  /**
   * Clean up stale working copies
   */
  async cleanupStaleWorkingCopies(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const now = this.now();
    const staleThreshold = now - maxAge;

    const staleWorkingCopies = (await this.db
      .table(this.workingCopyTableName)
      .where('updatedAt')
      .below(staleThreshold)
      .toArray()) as EnhancedWorkingCopy[];

    for (const wc of staleWorkingCopies) {
      await this.discardWorkingCopy(wc.workingCopyOf);
    }

    return staleWorkingCopies.length;
  }

  /**
   * Export working copy for external storage
   */
  async exportWorkingCopy(nodeId: TreeNodeId): Promise<string> {
    const workingCopy = await this.getWorkingCopy(nodeId);
    if (!workingCopy) {
      throw new Error(`Working copy not found: ${nodeId}`);
    }

    return JSON.stringify(workingCopy, null, 2);
  }

  /**
   * Import working copy from external storage
   */
  async importWorkingCopy(jsonData: string): Promise<EnhancedWorkingCopy> {
    let workingCopy: EnhancedWorkingCopy;

    try {
      workingCopy = JSON.parse(jsonData);
    } catch (error) {
      throw new Error('Invalid working copy JSON data');
    }

    // Check if working copy already exists
    const existing = await this.getWorkingCopy(workingCopy.workingCopyOf);
    if (existing) {
      throw new Error(`Working copy already exists for node: ${workingCopy.workingCopyOf}`);
    }

    // Generate new ID
    workingCopy.workingCopyId = this.generateUUID();
    workingCopy.createdAt = this.now();
    workingCopy.updatedAt = this.now();

    await this.db.table(this.workingCopyTableName).add(workingCopy);
    this.workingCopyCache.set(workingCopy.workingCopyOf, workingCopy);

    return workingCopy;
  }
}
