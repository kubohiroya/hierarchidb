/**
 * @file entityWorkingCopy.ts
 * @description Working copy types for plugin entities
 * Extends the existing working copy system to support entity-level editing
 */

import type { NodeId, EntityId } from './ids';
import type { PeerEntity, GroupEntity, RelationalEntity } from './nodeDefinition';

/**
 * Base working copy properties for entities
 */
export interface EntityWorkingCopyProperties {
  workingCopyId: EntityId;
  workingCopyOf: EntityId; // Original entity ID
  entityType: 'peer' | 'group' | 'relational';
  nodeId: NodeId; // Associated TreeNode
  copiedAt: number;
  isDirty: boolean;
  sessionId?: string; // Optional session tracking
}

/**
 * Working copy for PeerEntity
 */
export type PeerEntityWorkingCopy<T extends PeerEntity = PeerEntity> = 
  T & EntityWorkingCopyProperties;

/**
 * Working copy for GroupEntity
 */
export type GroupEntityWorkingCopy<T extends GroupEntity = GroupEntity> = 
  T & EntityWorkingCopyProperties;

/**
 * Working copy for RelationalEntity
 */
export type RelationalEntityWorkingCopy<T extends RelationalEntity = RelationalEntity> = 
  T & EntityWorkingCopyProperties & {
  // Additional properties for relational working copies
  originalReferencingNodeIds: NodeId[]; // Backup of original references
  workingReferencingNodeIds: NodeId[];  // Working references (can be modified)
};

/**
 * Union type for all entity working copies
 */
export type EntityWorkingCopy = 
  | PeerEntityWorkingCopy
  | GroupEntityWorkingCopy  
  | RelationalEntityWorkingCopy;

/**
 * Working copy change tracking
 */
export interface EntityWorkingCopyChange {
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  changedAt: number;
}

/**
 * Working copy session for managing multiple entity edits
 */
export interface EntityWorkingCopySession {
  sessionId: string;
  nodeId: NodeId;
  startedAt: number;
  lastActivityAt: number;
  workingCopyIds: EntityId[];
  changes: EntityWorkingCopyChange[];
  autoSaveEnabled: boolean;
  autoSaveIntervalMs?: number;
}

/**
 * Working copy conflict resolution
 */
export interface EntityWorkingCopyConflict {
  entityId: EntityId;
  fieldName: string;
  workingValue: unknown;
  currentValue: unknown; // Value in the actual entity (changed by someone else)
  baseValue: unknown;    // Value when working copy was created
  conflictType: 'modified' | 'deleted' | 'concurrent';
  resolutionStrategy?: 'keep_working' | 'keep_current' | 'merge' | 'ask_user';
}

/**
 * Batch working copy operation
 */
export interface EntityWorkingCopyBatch {
  batchId: string;
  nodeId: NodeId;
  operations: Array<{
    operationType: 'create' | 'update' | 'delete';
    entityType: 'peer' | 'group' | 'relational';
    entityId?: EntityId;
    workingCopyId?: EntityId;
    data?: unknown;
  }>;
  createdAt: number;
  completedAt?: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
}

/**
 * Working copy validation result
 */
export interface EntityWorkingCopyValidation {
  isValid: boolean;
  errors: Array<{
    fieldName: string;
    errorMessage: string;
    errorType: 'required' | 'type' | 'format' | 'constraint' | 'business_rule';
  }>;
  warnings: Array<{
    fieldName: string;
    warningMessage: string;
    warningType: 'performance' | 'best_practice' | 'compatibility';
  }>;
}

/**
 * Auto-save configuration for working copies
 */
export interface EntityWorkingCopyAutoSaveConfig {
  enabled: boolean;
  intervalMs: number;
  maxChangesBeforeSave: number;
  saveOnBlur: boolean;
  saveOnWindowClose: boolean;
  debounceMs: number;
}

/**
 * Working copy statistics
 */
export interface EntityWorkingCopyStats {
  totalWorkingCopies: number;
  workingCopiesByType: {
    peer: number;
    group: number;
    relational: number;
  };
  workingCopiesByNode: Record<NodeId, number>;
  oldestWorkingCopyAge: number; // milliseconds
  dirtyWorkingCopies: number;
  averageChangesPerWorkingCopy: number;
  sessionsWithUnsavedChanges: number;
}