/**
 * @file WorkingCopyHandler.ts
 * @description Advanced working copy management handler
 * Implements Copy-on-Write pattern with conflict resolution and version control
 */

import type { PeerEntity, GroupEntity, WorkingCopy, NodeId, EntityId } from '@hierarchidb/common-core';
import type Dexie from 'dexie';
import type { PeerEntityImpl, GroupEntityImpl, PeerWorkingCopy } from './SimpleEntityHandler';
// GroupEntityImpl interface was removed, using GroupEntityImpl instead
import { GroupEntityHandler } from './GroupEntityHandler';

/**
 * Enhanced working copy with additional tracking
 */
export interface EnhancedWorkingCopy extends Omit<WorkingCopy, 'id'> {
  id: EntityId; // Override id type to match PeerEntityImpl
  nodeId: NodeId;
  type: string; // Required by GroupEntity
  name: string; // Required by SimpleWorkingCopy
  description?: string;
  value?: number;
  data?: Record<string, any>;
  workingCopyId: string;
  workingCopyOf: NodeId;
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
  groupEntitiesData?: Record<string, GroupEntityImpl[]>;

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
  preserveGroupEntities?: boolean;
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
export class WorkingCopyHandler extends GroupEntityHandler {
  private workingCopyCache: Map<NodeId, EnhancedWorkingCopy> = new Map();
  private autoSaveTimers: Map<NodeId, NodeJS.Timeout> = new Map();

  constructor(
    db: Dexie,
    tableName: string,
    workingCopyTableName: string,
    groupEntityTableName: string
  ) {
    super(db, tableName, workingCopyTableName, groupEntityTableName);
  }

  /**
   * Create an enhanced working copy
   */
  async createWorkingCopy(nodeId: NodeId): Promise<EnhancedWorkingCopy> {
    // Check if working copy already exists
    const existing = await this.getWorkingCopy(nodeId);
    if (existing) {
      throw new Error(`Working copy already exists for node: ${nodeId}`);
    }

    const entity = await this.getEntity(nodeId);
    const now = this.now();

    const workingCopy: EnhancedWorkingCopy = {
      id: crypto.randomUUID() as EntityId,
      nodeId,
      type: entity?.type || 'working-copy',
      nodeType: 'simple' as const,
      parentId: undefined as any,
      name: (entity as any)?.name || '', // Required by SimpleWorkingCopy
      description: (entity as any)?.description,
      value: (entity as any)?.value,
      data: (entity as any)?.data,
      workingCopyId: this.generateNodeId(),
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
      groupEntitiesData: {},
      createdAt: entity?.createdAt || now,
      updatedAt: now,
      version: 1,
    };

    // Copy sub-entities if they exist
    if (this.groupEntityTableName) {
      try {
        // Get all sub-entities for this node without relying on groupEntityIndex
        const allGroupEntities = await this.db
          .table(this.groupEntityTableName)
          .where('parentNodeId')
          .equals(nodeId)
          .toArray();

        // Group by type
        const groupedByType: Record<string, any[]> = {};
        for (const groupEntity of allGroupEntities) {
          const type = (groupEntity as any).groupEntityType || 'default';
          if (!groupedByType[type]) {
            groupedByType[type] = [];
          }
          groupedByType[type].push(groupEntity);
        }

        // Add to working copy
        for (const [type, entities] of Object.entries(groupedByType)) {
          if (entities.length > 0) {
            workingCopy.groupEntitiesData![type] = entities;
          }
        }
      } catch (error) {
        this.log('Warning: Could not copy sub-entities to working copy', error);
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
  async getWorkingCopy(nodeId: NodeId): Promise<EnhancedWorkingCopy | undefined> {
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
    nodeId: NodeId,
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
  async commitWorkingCopy(nodeId: NodeId, workingCopy: EnhancedWorkingCopy): Promise<void> {
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
      if (workingCopy.groupEntitiesData && this.groupEntityTableName) {
        // Clear existing sub-entities
        await this.db
          .table(this.groupEntityTableName)
          .where('parentNodeId')
          .equals(nodeId)
          .delete();

        // Add all sub-entities from working copy
        for (const [type, groupEntities] of Object.entries(workingCopy.groupEntitiesData)) {
          for (const groupEntity of groupEntities) {
            await this.db.table(this.groupEntityTableName).add({
              ...groupEntity,
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
  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
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
  async getWorkingCopyStatus(nodeId: NodeId): Promise<WorkingCopyStatus> {
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
    currentEntity: GroupEntity
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
    currentEntity: GroupEntity,
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
  private async commitGroupEntities(
    nodeId: NodeId,
    groupEntitiesData: Record<string, GroupEntityImpl[]>
  ): Promise<void> {
    // Delete all existing sub-entities
    if (this.groupEntityTableName) {
      await this.db.table(this.groupEntityTableName).where('parentNodeId').equals(nodeId).delete();
    }

    // Create new sub-entities from working copy
    for (const [type, entities] of Object.entries(groupEntitiesData)) {
      for (const entity of entities) {
        const { id, parentNodeId, createdAt, updatedAt, version, ...data } = entity;
        await this.createGroupEntity(nodeId, type, {
          ...data,
          id: id || this.generateNodeId(),
          parentNodeId: nodeId,
          groupEntityType: type,
          type: type,
          createdAt: createdAt || this.now(),
          updatedAt: updatedAt || this.now(),
          version: version || 1,
        } as GroupEntityImpl);
      }
    }
  }

  /**
   * Setup auto-save for working copy
   */
  private setupAutoSave(nodeId: NodeId, interval: number): void {
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
  private cancelAutoSave(nodeId: NodeId): void {
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
    sourceNodeId: NodeId,
    targetNodeId: NodeId
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
      workingCopyId: this.generateNodeId(),
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
    sourceNodeId: NodeId,
    targetNodeId: NodeId,
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
  async exportWorkingCopy(nodeId: NodeId): Promise<string> {
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
    workingCopy.workingCopyId = this.generateNodeId();
    workingCopy.createdAt = this.now();
    workingCopy.updatedAt = this.now();

    await this.db.table(this.workingCopyTableName).add(workingCopy);
    this.workingCopyCache.set(workingCopy.workingCopyOf, workingCopy);

    return workingCopy;
  }

  // ==================
  // Abstract method implementations required by BaseEntityHandler
  // ==================

  /**
   * Create entity - delegates to parent GroupEntityHandler
   */
  async createEntity(nodeId: NodeId, data?: Partial<GroupEntity>): Promise<GroupEntity> {
    // For WorkingCopyHandler, we delegate to the parent's entity creation logic
    // This creates the main entity that working copies will be based on
    const now = this.now();
    const entity: GroupEntity = {
      id: this.generateNodeId() as EntityId,
      nodeId: nodeId,
      type: data?.type || 'working-copy',
      createdAt: data?.createdAt || now,
      updatedAt: data?.updatedAt || now,
      version: data?.version || 1,
      ...data,
    };

    await this.db.table(this.tableName).add(entity);
    this.log('Entity created for working copy management', { nodeId, entityId: entity.id });

    return entity;
  }

  /**
   * Get entity by nodeId - delegates to parent GroupEntityHandler
   */
  async getEntity(nodeId: NodeId): Promise<GroupEntity | undefined> {
    return await this.db.table(this.tableName).where('nodeId').equals(nodeId).first();
  }

  /**
   * Update entity - delegates to parent GroupEntityHandler
   */
  async updateEntity(nodeId: NodeId, data: Partial<GroupEntity>): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error(`Entity not found for working copy: ${nodeId}`);
    }

    const updates = {
      ...data,
      updatedAt: this.now(),
      version: (existing.version || 0) + 1,
    };

    await this.db.table(this.tableName).where('nodeId').equals(nodeId).modify(updates);
    this.log('Entity updated for working copy', { nodeId, updates });
  }

  /**
   * Delete entity - delegates to parent GroupEntityHandler
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    // First discard any working copy
    await this.discardWorkingCopy(nodeId);

    // Then delete the main entity
    await this.db.table(this.tableName).where('nodeId').equals(nodeId).delete();

    // Clean up cache
    this.workingCopyCache.delete(nodeId);

    // Cancel auto-save timer
    this.cancelAutoSave(nodeId);

    this.log('Entity deleted for working copy', { nodeId });
  }

  /**
   * Create group entity - required for working copy sub-entity management
   */
  async createGroupEntity(
    nodeId: NodeId,
    groupEntityType: string,
    data: GroupEntityImpl
  ): Promise<void> {
    if (!this.groupEntityTableName) {
      throw new Error('Sub-entity table not configured');
    }

    const now = this.now();
    const groupEntityData: GroupEntityImpl = {
      id: data.id || (this.generateNodeId() as EntityId),
      nodeId: nodeId,
      type: groupEntityType, // Required by GroupEntity
      parentNodeId: nodeId,
      groupEntityType,
      data: data.data || {},
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      version: data.version || 1,
    };

    await this.db.table(this.groupEntityTableName).add(groupEntityData);
    this.log('Group entity created for working copy', {
      id: groupEntityData.id,
      type: groupEntityType,
      parent: nodeId,
    });
  }
}
