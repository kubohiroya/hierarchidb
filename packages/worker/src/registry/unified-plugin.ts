/**
 * @file unified-plugin.ts
 * @description UnifiedPluginDefinition interface and related types
 * Based on AOP architecture document (docs/7-aop-architecture.md)
 */

import type {NodeTypeConfig, TreeNodeId, TreeNodeType } from '@hierarchidb/core';
import { BaseEntityHandler } from "~/handlers";

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

// Re-export with same names for compatibility
export type EntityHandler<
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
> = BaseEntityHandler<TEntity, TSubEntity, TWorkingCopy>;

export type EntityBackup<TEntity extends BaseEntity = BaseEntity> = {}; //CoreEntityBackup<TEntity>;

// Lifecycle hooks
export interface NodeLifecycleHooks<
  TEntity extends BaseEntity = BaseEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
> {
  // Creation hooks
  beforeCreate?: (parentId: TreeNodeId, nodeData: Partial<unknown>) => Promise<void>;
  afterCreate?: (nodeId: TreeNodeId, entity: TEntity) => Promise<void>;

  // Update hooks
  beforeUpdate?: (nodeId: TreeNodeId, changes: Partial<unknown>) => Promise<void>;
  afterUpdate?: (nodeId: TreeNodeId, entity: TEntity) => Promise<void>;

  // Deletion hooks
  beforeDelete?: (nodeId: TreeNodeId) => Promise<void>;
  afterDelete?: (nodeId: TreeNodeId) => Promise<void>;

  // Working copy hooks
  beforeCommit?: (nodeId: TreeNodeId, workingCopy: TWorkingCopy) => Promise<void>;
  afterCommit?: (nodeId: TreeNodeId, entity: TEntity) => Promise<void>;
  beforeDiscard?: (nodeId: TrだeeNodeId, workingCopy: TWorkingCopy) => Promise<void>;
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
  loader?: () => Promise<unknown>;
  action?: () => Promise<unknown>;
  componentPath?: string; // Path to the component to load on UI side
}

// Validation rule
export interface ValidationRule<TEntity extends BaseEntity = BaseEntity> {
  name: string;
  validate: (entity: TEntity) => Promise<boolean | string>;
}

// Icon definition supporting multiple formats
export interface IconDefinition {
  // MUI icon name (e.g., 'Folder', 'Description', 'Map')
  muiIconName?: string;
  
  // Unicode emoji (e.g., '📁', '🗺️', '📍')
  emoji?: string;
  
  // SVG as string or React component path
  svg?: string;
  svgPath?: string;
  
  // Icon description for accessibility and UI hints
  description?: string;
  
  // Optional color hint
  color?: string;
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
  
  // i18n configuration
  readonly i18n?: {
    // Namespace for this plugin's translations
    namespace?: string;
    // Default locale (e.g., 'en', 'ja')
    defaultLocale?: string;
    // Path pattern for locale files (e.g., './locales/{{lng}}/{{ns}}.json')
    localesPath?: string;
    // Embedded translations (optional, for small plugins)
    resources?: {
      [locale: string]: {
        menuItem?: {
          title?: string;
          tooltip?: string;
        };
        dialog?: {
          title?: string;
          description?: string;
          createButton?: string;
          cancelButton?: string;
        };
        panel?: {
          title?: string;
          description?: string;
        };
        speedDial?: {
          tooltip?: string;
        };
        [key: string]: any;
      };
    };
  };
  
  // Icon configuration with multi-format support
  readonly icon?: IconDefinition;

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
    workerExtensions?: Record<string, (...args: unknown[]) => Promise<unknown>>;
    clientExtensions?: Record<string, (...args: unknown[]) => Promise<unknown>>;
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
