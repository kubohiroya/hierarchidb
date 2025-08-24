/**
 * @file plugin.ts
 * @description PluginDefinition interface and related types
 * Based on AOP architecture document (docs/7-aop-architecture.md)
 */

import type {
  NodeTypeConfig,
  WorkingCopyProperties,
  PeerEntity as CorePeerEntity,
  GroupEntity as CoreGroupEntity,
  NodeLifecycleHooks as CoreNodeLifecycleHooks,
  ValidationRule as CoreValidationRule,
  IconDefinition as CoreIconDefinition,
  CategoryDefinition as CoreCategoryDefinition,
  WorkerPluginRouterAction as CoreWorkerPluginRouterAction,
  PluginDatabaseConfig,
  PluginUIConfig,
  PluginAPIConfig,
  PluginValidationConfig,
  CoreNodeDefinition,
  PluginRoutingConfig,
  PluginMetadata,
} from '@hierarchidb/common-core';

// Re-export core types for consistency
export type { WorkingCopyProperties };
export type PeerEntity = CorePeerEntity;
export type GroupEntity = CoreGroupEntity;
export type { WorkingCopy } from '@hierarchidb/common-core';

import { BaseEntityHandler } from "../handlers";

// BaseWorkingCopy is no longer needed - using WorkingCopyProperties from core

// Re-export with same names for compatibility
export type EntityHandler<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> = BaseEntityHandler<TEntity, TGroupEntity, TWorkingCopy>;

export type EntityBackup<_TEntity extends PeerEntity = PeerEntity> = {}; //CoreEntityBackup<TEntity>;

// Re-export core types with compatibility
export type NodeLifecycleHooks<
  TEntity extends PeerEntity = PeerEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> = CoreNodeLifecycleHooks<TEntity, TWorkingCopy>;

export type WorkerPluginRouterAction = CoreWorkerPluginRouterAction;
export type ValidationRule<TEntity extends PeerEntity = PeerEntity> = CoreValidationRule<TEntity>;
export type IconDefinition = CoreIconDefinition;
export type CategoryDefinition = CoreCategoryDefinition;

// Node definition with entity handler (worker-specific extension of core)
export interface NodeDefinition<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> extends Omit<CoreNodeDefinition, 'lifecycle' | 'database' | 'ui' | 'api'> {
  // Entity handler - this is worker-specific and not in core
  readonly entityHandler: EntityHandler<TEntity, TGroupEntity, TWorkingCopy>;

  // Lifecycle hooks with actual implementations (different from core's boolean flags)
  readonly lifecycle?: NodeLifecycleHooks<TEntity, TWorkingCopy>;

  // Database configuration (use core type)
  readonly database: PluginDatabaseConfig;

  // UI configuration (use core type)
  readonly ui?: PluginUIConfig;

  // API extensions (use core type)
  readonly api?: PluginAPIConfig;

  // Validation configuration (use core type)
  readonly validation?: PluginValidationConfig;
}

// Unified plugin definition (extends NodeDefinition with routing and metadata)
export interface PluginDefinition<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> extends NodeDefinition<TEntity, TGroupEntity, TWorkingCopy> {
  // Worker-side routing configuration (use core type)
  readonly routing: PluginRoutingConfig;

  // Plugin metadata (use core type)
  readonly meta: PluginMetadata;
}

// Extended NodeTypeConfig for backward compatibility
export interface ExtendedNodeTypeConfig extends NodeTypeConfig {
  nodeDefinition?: PluginDefinition;
}

// Backward compatibility aliases - TEMPORARY for migration only, NOT for permanent use
/** @deprecated Use NodeDefinition instead. This alias will be removed after plugin migration is complete. */
export type NodeTypeDefinition<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> = NodeDefinition<TEntity, TGroupEntity, TWorkingCopy>;
