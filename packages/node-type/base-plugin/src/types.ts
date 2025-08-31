/**
 * @file types.ts
 * @description Base types for base-plugin
 */

import type { EntityId } from '@hierarchidb/common-type';

/**
 * Base search criteria interface
 */
export interface BaseSearchCriteria {
  name?: string;
  createdAfter?: number;
  createdBefore?: number;
  updatedAfter?: number;
  updatedBefore?: number;
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
 * Entity handler lifecycle hooks
 */
export interface EntityLifecycleHooks<TEntity> {
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