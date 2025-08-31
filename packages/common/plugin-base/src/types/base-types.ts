/**
 * @file base-types.ts
 * @description Base types for all HierarchiDB plugins
 */

import type { NodeId, EntityId } from '@hierarchidb/common-type';

/**
 * Base entity interface that all plugin entities must extend
 */
export interface BaseEntity {
  id: EntityId;
  nodeId: NodeId;
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * Base working copy interface for all plugins
 */
export interface BaseWorkingCopy extends BaseEntity {
  isDraft: boolean;
  copiedAt?: number;
  originalVersion?: number;
  modifiedFields?: string[];
}

/**
 * Pagination result interface
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Search criteria base interface
 */
export interface BaseSearchCriteria {
  name?: string;
  createdAfter?: number;
  createdBefore?: number;
  updatedAfter?: number;
  updatedBefore?: number;
}

/**
 * Entity handler lifecycle hooks
 */
export interface EntityLifecycleHooks<TEntity extends BaseEntity> {
  beforeCreate?: (data: Partial<TEntity>) => Promise<void>;
  afterCreate?: (entity: TEntity) => Promise<void>;
  beforeUpdate?: (entity: TEntity, updates: Partial<TEntity>) => Promise<void>;
  afterUpdate?: (entity: TEntity) => Promise<void>;
  beforeDelete?: (entity: TEntity) => Promise<void>;
  afterDelete?: (entityId: EntityId) => Promise<void>;
}

/**
 * Database operation result
 */
export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: Error;
  message?: string;
}

/**
 * Bulk operation options
 */
export interface BulkOperationOptions {
  batchSize?: number;
  onProgress?: (processed: number, total: number) => void;
  stopOnError?: boolean;
}

/**
 * Transaction context
 */
export interface TransactionContext {
  transactionId: string;
  startTime: number;
  operations: Array<{
    type: 'create' | 'update' | 'delete';
    entityId: EntityId;
    timestamp: number;
  }>;
}
