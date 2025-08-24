/**
 * @file EntityWorkingCopyManager.ts
 * @description Manager for entity working copies with session support
 * Provides entity-level working copy functionality beyond TreeNode working copies
 */

import type {
  NodeId,
  EntityId,
  PeerEntity,
  GroupEntity,
  RelationalEntity,
  EntityWorkingCopy,
  PeerEntityWorkingCopy,
  GroupEntityWorkingCopy,
  RelationalEntityWorkingCopy,
  EntityWorkingCopySession,
  EntityWorkingCopyConflict,
  EntityWorkingCopyValidation,
  EntityWorkingCopyStats,
} from '@hierarchidb/common-core';
import type { EphemeralDB } from '../db/EphemeralDB';
import { generateEntityId } from '@hierarchidb/common-core';

/**
 * Manager for entity working copies
 * Handles creation, management, and lifecycle of entity working copies
 */
export class EntityWorkingCopyManager {
  private ephemeralDB: EphemeralDB;
  private activeSessions = new Map<string, EntityWorkingCopySession>();
  private autoSaveTimers = new Map<EntityId, NodeJS.Timeout>();

  constructor(ephemeralDB: EphemeralDB) {
    this.ephemeralDB = ephemeralDB;
    this.setupCleanupInterval();
  }

  // =============================================================================
  // PeerEntity Working Copy Operations
  // =============================================================================

  /**
   * Create working copy for PeerEntity
   */
  async createPeerEntityWorkingCopy<T extends PeerEntity>(
    originalEntity: T,
    sessionId?: string
  ): Promise<PeerEntityWorkingCopy<T>> {
    const workingCopyId = generateEntityId();
    const now = Date.now();

    const workingCopy: PeerEntityWorkingCopy<T> = {
      ...originalEntity,
      workingCopyId,
      workingCopyOf: originalEntity.id || generateEntityId(),
      entityType: 'peer',
      nodeId: originalEntity.nodeId,
      copiedAt: now,
      isDirty: false,
      sessionId,
    };

    // Store in ephemeral database
    await this.ephemeralDB.table('entityWorkingCopies').add(workingCopy);

    // Track in session if provided
    if (sessionId) {
      await this.addToSession(sessionId, workingCopyId, originalEntity.nodeId);
    }

    return workingCopy;
  }

  /**
   * Update PeerEntity working copy
   */
  async updatePeerEntityWorkingCopy<T extends PeerEntity>(
    workingCopyId: EntityId,
    updates: Partial<T>
  ): Promise<void> {
    const workingCopy = await this.getEntityWorkingCopy<PeerEntityWorkingCopy<T>>(workingCopyId);
    if (!workingCopy) {
      throw new Error(`PeerEntity working copy not found: ${workingCopyId}`);
    }

    const updatedWorkingCopy = {
      ...workingCopy,
      ...updates,
      isDirty: true,
      updatedAt: Date.now(),
    };

    await this.ephemeralDB.table('entityWorkingCopies').put(updatedWorkingCopy);

    // Update session activity
    if (updatedWorkingCopy.sessionId) {
      await this.updateSessionActivity(updatedWorkingCopy.sessionId);
    }
  }

  /**
   * Commit PeerEntity working copy
   */
  async commitPeerEntityWorkingCopy<T extends PeerEntity>(
    workingCopyId: EntityId,
    validator?: (entity: T) => Promise<EntityWorkingCopyValidation>
  ): Promise<T> {
    const workingCopy = await this.getEntityWorkingCopy<PeerEntityWorkingCopy<T>>(workingCopyId);
    if (!workingCopy) {
      throw new Error(`PeerEntity working copy not found: ${workingCopyId}`);
    }

    // Validate if validator provided
    if (validator) {
      const validation = await validator(workingCopy as T);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.map(e => e.errorMessage).join(', ')}`);
      }
    }

    // Extract working copy specific fields
    const { workingCopyId: _, workingCopyOf, entityType, copiedAt, isDirty, sessionId, ...entityData } = workingCopy;

    // Create committed entity
    const committedEntity: T = {
      ...entityData,
      id: workingCopyOf,
      updatedAt: Date.now(),
      version: (workingCopy.version || 1) + 1,
    } as T;

    // Clean up working copy
    await this.ephemeralDB.table('entityWorkingCopies').delete(workingCopyId);

    // Remove from session
    if (sessionId) {
      await this.removeFromSession(sessionId, workingCopyId);
    }

    return committedEntity;
  }

  // =============================================================================
  // GroupEntity Working Copy Operations
  // =============================================================================

  /**
   * Create working copy for GroupEntity
   */
  async createGroupEntityWorkingCopy<T extends GroupEntity>(
    originalEntity: T,
    sessionId?: string
  ): Promise<GroupEntityWorkingCopy<T>> {
    const workingCopyId = generateEntityId();
    const now = Date.now();

    const workingCopy: GroupEntityWorkingCopy<T> = {
      ...originalEntity,
      workingCopyId,
      workingCopyOf: originalEntity.id,
      entityType: 'group',
      nodeId: (originalEntity as GroupEntity).nodeId,
      copiedAt: now,
      isDirty: false,
      sessionId,
    };

    await this.ephemeralDB.table('entityWorkingCopies').add(workingCopy);

    if (sessionId) {
      await this.addToSession(sessionId, workingCopyId, (originalEntity as GroupEntity).nodeId);
    }

    return workingCopy;
  }

  /**
   * Batch create working copies for multiple GroupEntities
   */
  async createGroupEntityWorkingCopiesBatch<T extends GroupEntity>(
    originalEntities: T[],
    sessionId?: string
  ): Promise<GroupEntityWorkingCopy<T>[]> {
    const workingCopies: GroupEntityWorkingCopy<T>[] = [];
    const now = Date.now();

    for (const entity of originalEntities) {
      const workingCopyId = generateEntityId();
      const workingCopy: GroupEntityWorkingCopy<T> = {
        ...entity,
        workingCopyId,
        workingCopyOf: entity.id,
        entityType: 'group',
        nodeId: (entity as GroupEntity).nodeId,
        copiedAt: now,
        isDirty: false,
        sessionId,
      };
      workingCopies.push(workingCopy);
    }

    // Bulk insert
    await this.ephemeralDB.table('entityWorkingCopies').bulkAdd(workingCopies);

    // Add to session
    if (sessionId && workingCopies.length > 0) {
      const workingCopyIds = workingCopies.map(wc => wc.workingCopyId);
      await this.addToSession(sessionId, workingCopyIds, workingCopies[0]?.nodeId ?? ('' as NodeId));
    }

    return workingCopies;
  }

  // =============================================================================
  // RelationalEntity Working Copy Operations
  // =============================================================================

  /**
   * Create working copy for RelationalEntity
   */
  async createRelationalEntityWorkingCopy<T extends RelationalEntity>(
    originalEntity: T,
    sessionId?: string
  ): Promise<RelationalEntityWorkingCopy<T>> {
    const workingCopyId = generateEntityId();
    const now = Date.now();

    const workingCopy: RelationalEntityWorkingCopy<T> = {
      ...originalEntity,
      workingCopyId,
      workingCopyOf: originalEntity.id,
      entityType: 'relational',
      nodeId: (originalEntity as RelationalEntity).nodeIds[0] || ('unknown' as NodeId), // Use first reference
      copiedAt: now,
      isDirty: false,
      sessionId,
      originalReferencingNodeIds: [...(originalEntity as RelationalEntity).nodeIds],
      workingReferencingNodeIds: [...(originalEntity as RelationalEntity).nodeIds],
    };

    await this.ephemeralDB.table('entityWorkingCopies').add(workingCopy);

    if (sessionId) {
      await this.addToSession(sessionId, workingCopyId, workingCopy.nodeId);
    }

    return workingCopy;
  }

  /**
   * Update RelationalEntity references in working copy
   */
  async updateRelationalEntityReferences(
    workingCopyId: EntityId,
    newReferences: NodeId[]
  ): Promise<void> {
    const workingCopy = await this.getEntityWorkingCopy<RelationalEntityWorkingCopy>(workingCopyId);
    if (!workingCopy || workingCopy.entityType !== 'relational') {
      throw new Error(`RelationalEntity working copy not found: ${workingCopyId}`);
    }

    const updatedWorkingCopy = {
      ...workingCopy,
      workingReferencingNodeIds: newReferences,
      referenceCount: newReferences.length,
      isDirty: true,
      updatedAt: Date.now(),
    };

    await this.ephemeralDB.table('entityWorkingCopies').put(updatedWorkingCopy);

    if (updatedWorkingCopy.sessionId) {
      await this.updateSessionActivity(updatedWorkingCopy.sessionId);
    }
  }

  // =============================================================================
  // Generic Working Copy Operations
  // =============================================================================

  /**
   * Get entity working copy by ID
   */
  async getEntityWorkingCopy<T extends EntityWorkingCopy>(
    workingCopyId: EntityId
  ): Promise<T | undefined> {
    return await this.ephemeralDB.table('entityWorkingCopies').get(workingCopyId) as T | undefined;
  }

  /**
   * Get all working copies for a node
   */
  async getWorkingCopiesForNode(nodeId: NodeId): Promise<EntityWorkingCopy[]> {
    return await this.ephemeralDB.table('entityWorkingCopies')
      .where('nodeId')
      .equals(nodeId)
      .toArray();
  }

  /**
   * Discard entity working copy
   */
  async discardEntityWorkingCopy(workingCopyId: EntityId): Promise<void> {
    const workingCopy = await this.getEntityWorkingCopy(workingCopyId);
    
    if (workingCopy) {
      // Remove from session
      if (workingCopy.sessionId) {
        await this.removeFromSession(workingCopy.sessionId, workingCopyId);
      }

      // Remove auto-save timer
      const timer = this.autoSaveTimers.get(workingCopyId);
      if (timer) {
        clearTimeout(timer);
        this.autoSaveTimers.delete(workingCopyId);
      }

      // Delete from database
      await this.ephemeralDB.table('entityWorkingCopies').delete(workingCopyId);
    }
  }

  /**
   * Discard all working copies for a node
   */
  async discardAllWorkingCopiesForNode(nodeId: NodeId): Promise<number> {
    const workingCopies = await this.getWorkingCopiesForNode(nodeId);
    
    for (const workingCopy of workingCopies) {
      await this.discardEntityWorkingCopy(workingCopy.workingCopyId);
    }

    return workingCopies.length;
  }

  // =============================================================================
  // Session Management
  // =============================================================================

  /**
   * Create working copy session
   */
  async createSession(nodeId: NodeId, autoSaveEnabled = false): Promise<string> {
    const sessionId = generateEntityId();
    const now = Date.now();

    const session: EntityWorkingCopySession = {
      sessionId,
      nodeId,
      startedAt: now,
      lastActivityAt: now,
      workingCopyIds: [],
      changes: [],
      autoSaveEnabled,
      autoSaveIntervalMs: autoSaveEnabled ? 30000 : undefined, // 30 seconds
    };

    this.activeSessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * Add working copy to session
   */
  private async addToSession(
    sessionId: string, 
    workingCopyId: EntityId | EntityId[], 
    nodeId: NodeId
  ): Promise<void> {
    let session = this.activeSessions.get(sessionId);
    
    if (!session) {
      // Create session if it doesn't exist
      await this.createSession(nodeId);
      session = this.activeSessions.get(sessionId)!;
    }

    const ids = Array.isArray(workingCopyId) ? workingCopyId : [workingCopyId];
    session.workingCopyIds.push(...ids);
    session.lastActivityAt = Date.now();
  }

  /**
   * Remove working copy from session
   */
  private async removeFromSession(sessionId: string, workingCopyId: EntityId): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.workingCopyIds = session.workingCopyIds.filter(id => id !== workingCopyId);
      session.lastActivityAt = Date.now();

      // Remove session if no working copies remain
      if (session.workingCopyIds.length === 0) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  /**
   * Update session activity timestamp
   */
  private async updateSessionActivity(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
  }

  /**
   * End session and optionally commit all working copies
   */
  async endSession(sessionId: string, commitAll = false): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    if (commitAll) {
      // Commit all working copies in session
      for (const workingCopyId of session.workingCopyIds) {
        try {
          const workingCopy = await this.getEntityWorkingCopy(workingCopyId);
          if (workingCopy && workingCopy.isDirty) {
            // Note: In real implementation, this would need type-specific commit logic
            await this.commitPeerEntityWorkingCopy(workingCopyId);
          }
        } catch (error) {
          console.error(`Failed to commit working copy ${workingCopyId}:`, error);
        }
      }
    } else {
      // Discard all working copies in session
      for (const workingCopyId of session.workingCopyIds) {
        await this.discardEntityWorkingCopy(workingCopyId);
      }
    }

    this.activeSessions.delete(sessionId);
  }

  // =============================================================================
  // Statistics and Monitoring
  // =============================================================================

  /**
   * Get working copy statistics
   */
  async getWorkingCopyStats(): Promise<EntityWorkingCopyStats> {
    const allWorkingCopies = await this.ephemeralDB.table('entityWorkingCopies').toArray();
    
    const stats: EntityWorkingCopyStats = {
      totalWorkingCopies: allWorkingCopies.length,
      workingCopiesByType: {
        peer: allWorkingCopies.filter(wc => wc.entityType === 'peer').length,
        group: allWorkingCopies.filter(wc => wc.entityType === 'group').length,
        relational: allWorkingCopies.filter(wc => wc.entityType === 'relational').length,
      },
      workingCopiesByNode: {},
      oldestWorkingCopyAge: 0,
      dirtyWorkingCopies: allWorkingCopies.filter(wc => wc.isDirty).length,
      averageChangesPerWorkingCopy: 0, // Would need change tracking
      sessionsWithUnsavedChanges: this.activeSessions.size,
    };

    // Calculate per-node stats
    for (const wc of allWorkingCopies) {
      stats.workingCopiesByNode[wc.nodeId] = (stats.workingCopiesByNode[wc.nodeId] || 0) + 1;
    }

    // Calculate oldest working copy age
    if (allWorkingCopies.length > 0) {
      const now = Date.now();
      stats.oldestWorkingCopyAge = Math.max(...allWorkingCopies.map(wc => now - wc.copiedAt));
    }

    return stats;
  }

  // =============================================================================
  // Cleanup and Maintenance
  // =============================================================================

  /**
   * Setup periodic cleanup of stale working copies
   */
  private setupCleanupInterval(): void {
    // Clean up every 5 minutes
    setInterval(() => {
      this.cleanupStaleWorkingCopies();
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up working copies older than specified age
   */
  async cleanupStaleWorkingCopies(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffTime = Date.now() - maxAgeMs;
    const staleWorkingCopies = await this.ephemeralDB.table('entityWorkingCopies')
      .where('copiedAt')
      .below(cutoffTime)
      .toArray();

    let cleanedUp = 0;
    for (const workingCopy of staleWorkingCopies) {
      await this.discardEntityWorkingCopy(workingCopy.workingCopyId);
      cleanedUp++;
    }

    return cleanedUp;
  }

  /**
   * Clean up inactive sessions
   */
  async cleanupInactiveSessions(maxInactiveMs = 60 * 60 * 1000): Promise<number> {
    const cutoffTime = Date.now() - maxInactiveMs;
    let cleanedUp = 0;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.lastActivityAt < cutoffTime) {
        await this.endSession(sessionId, false); // Discard changes
        cleanedUp++;
      }
    }

    return cleanedUp;
  }
}