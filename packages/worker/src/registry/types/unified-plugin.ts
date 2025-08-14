/**
 * @file unified-plugin.ts
 * @description UnifiedPluginDefinition interface and related types
 * Based on AOP architecture document (docs/7-aop-architecture.md)
 */

import type { TreeNodeType, TreeNodeId } from '@hierarchidb/core';
import type { NodeTypeConfig } from '../types';

// Base types for entities
export interface BaseEntity {
  nodeId: TreeNodeId;
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
  version: number;
}

export interface BaseSubEntity {
  id: string;
  parentNodeId: TreeNodeId;
  subEntityType: string;
  type: string; // Added to match core BaseSubEntity
  createdAt: number;
  updatedAt: number;
}

export interface BaseWorkingCopy extends BaseEntity {
  workingCopyId: string; // UUID
  workingCopyOf: TreeNodeId;
  copiedAt: number; // Timestamp
  isDirty: boolean;
}

// Re-export EntityHandler and related types from core
import type {
  EntityHandler as CoreEntityHandler,
  EntityBackup as CoreEntityBackup,
} from '@hierarchidb/core';

// Re-export with same names for compatibility
export type EntityHandler<
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
> = CoreEntityHandler<TEntity, TSubEntity, TWorkingCopy>;

export type EntityBackup<TEntity extends BaseEntity = BaseEntity> = CoreEntityBackup<TEntity>;

// Lifecycle hooks
export interface NodeLifecycleHooks<
  TEntity extends BaseEntity = BaseEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
> {
  // Creation hooks
  beforeCreate?: (parentId: TreeNodeId, nodeData: Partial<any>) => Promise<void>;
  afterCreate?: (nodeId: TreeNodeId, entity: TEntity) => Promise<void>;

  // Update hooks
  beforeUpdate?: (nodeId: TreeNodeId, changes: Partial<any>) => Promise<void>;
  afterUpdate?: (nodeId: TreeNodeId, entity: TEntity) => Promise<void>;

  // Deletion hooks
  beforeDelete?: (nodeId: TreeNodeId) => Promise<void>;
  afterDelete?: (nodeId: TreeNodeId) => Promise<void>;

  // Working copy hooks
  beforeCommit?: (nodeId: TreeNodeId, workingCopy: TWorkingCopy) => Promise<void>;
  afterCommit?: (nodeId: TreeNodeId, entity: TEntity) => Promise<void>;
  beforeDiscard?: (nodeId: TreeNodeId, workingCopy: TWorkingCopy) => Promise<void>;
  afterDiscard?: (nodeId: TreeNodeId) => Promise<void>;

  // Move hooks
  beforeMove?: (
    nodeId: TreeNodeId,
    oldParentId: TreeNodeId,
    newParentId: TreeNodeId
  ) => Promise<void>;
  afterMove?: (
    nodeId: TreeNodeId,
    oldParentId: TreeNodeId,
    newParentId: TreeNodeId
  ) => Promise<void>;
}

// Worker-side plugin router action definition (without React components)
export interface WorkerPluginRouterAction {
  path?: string;
  loader?: () => Promise<any>;
  action?: () => Promise<any>;
  componentPath?: string; // Path to the component to load on UI side
}

// Validation rule
export interface ValidationRule<TEntity extends BaseEntity = BaseEntity> {
  name: string;
  validate: (entity: TEntity) => Promise<boolean | string>;
}

// Node type definition (base)
export interface NodeTypeDefinition<
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
> {
  readonly nodeType: TreeNodeType;
  readonly name: string;
  readonly displayName: string;

  // Database configuration
  readonly database: {
    dbName: string;
    tableName: string;
    schema: string; // Dexie schema
    version: number;
  };

  // Entity handler
  readonly entityHandler: EntityHandler<TEntity, TSubEntity, TWorkingCopy>;

  // Lifecycle hooks
  readonly lifecycle?: NodeLifecycleHooks<TEntity, TWorkingCopy>;

  // UI configuration references (optional)
  // Note: Actual React components are loaded on UI side
  readonly ui?: {
    dialogComponentPath?: string;
    panelComponentPath?: string;
    formComponentPath?: string;
    iconComponentPath?: string;
  };

  // API extensions (optional)
  readonly api?: {
    workerExtensions?: Record<string, (...args: any[]) => Promise<any>>;
    clientExtensions?: Record<string, (...args: any[]) => Promise<any>>;
  };

  // Validation (optional)
  readonly validation?: {
    namePattern?: RegExp;
    maxChildren?: number;
    allowedChildTypes?: TreeNodeType[];
    customValidators?: ValidationRule<TEntity>[];
  };
}

// Unified plugin definition (extends NodeTypeDefinition with routing and metadata)
export interface UnifiedPluginDefinition<
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
> extends NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy> {
  // Worker-side routing configuration (without React components)
  readonly routing: {
    actions: Record<string, WorkerPluginRouterAction>;
    defaultAction?: string;
  };

  // Plugin metadata
  readonly meta: {
    version: string;
    description?: string;
    author?: string;
    tags?: string[];
    dependencies?: string[];
  };
}

// Extended NodeTypeConfig for backward compatibility
export interface ExtendedNodeTypeConfig extends NodeTypeConfig {
  pluginDefinition?: UnifiedPluginDefinition;
}
