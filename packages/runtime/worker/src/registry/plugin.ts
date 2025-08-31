/**
import {  } from '@hierarchidb/common-core';
import type { NodeTypeConfig, WorkingCopyProperties, PeerEntity as CorePeerEntity, GroupEntity as CoreGroupEntity, NodeLifecycleHooks as CoreNodeLifecycleHooks, ValidationRule as CoreValidationRule, IconDefinition as CoreIconDefinition, CategoryDefinition as CoreCategoryDefinition, WorkerPluginRouterAction as CoreWorkerPluginRouterAction, PluginDatabaseConfig, PluginUIConfig, PluginAPIConfig, PluginValidationConfig, PluginDefinition as CorePluginDefinition, PluginRoutingConfig, PluginMetadata } from '@hierarchidb/common-type';
 * @file plugin.ts
 * @description PluginDefinition interface and related types
 * Based on AOP architecture document (docs/7-aop-architecture.md)
 */

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

export type ValidationRule<TEntity extends PeerEntity = PeerEntity> = CoreValidationRule<TEntity>;

// Node definition with entity handler (worker-specific extension of core)
export interface NodeDefinition<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> extends Omit<PluginDefinition, 'lifecycle' | 'database' | 'ui' | 'api'> {
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

// Use the core PluginDefinition directly and extend it with worker-specific properties
export interface PluginDefinition<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> extends Omit<CorePluginDefinition, 'lifecycle'> {
  // Entity handler - this is worker-specific and not in core
  readonly entityHandler: EntityHandler<TEntity, TGroupEntity, TWorkingCopy>;

  // Lifecycle hooks with actual implementations (override core's boolean flags)
  readonly lifecycle?: NodeLifecycleHooks<TEntity, TWorkingCopy>;

  // Worker-side routing configuration
  readonly routing: PluginRoutingConfig;

  // Plugin metadata
  readonly meta: PluginMetadata;
}

// Extended NodeTypeConfig for backward compatibility
export interface ExtendedNodeTypeConfig extends NodeTypeConfig {
  nodeDefinition?: PluginDefinition;
}

// Backward compatibility aliases - TEMPORARY for migration only, NOT for permanent use
/** @deprecated Use EntityTypes instead. This alias will be removed after plugin migration is complete. */
export type NodeTypeDefinition<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> = NodeDefinition<TEntity, TGroupEntity, TWorkingCopy>;
