/**
import type { NodeId, NodeType } from '@hierarchidb/common-type';
 * @file types.ts
 * @description Re-export handler types from core to avoid duplication
 */

// Re-export all handler types from common-type
export type {
  BaseEntity,
  GroupEntity,
  WorkingCopy,
  PeerEntity,
  RelationalEntity,
  EntityMetadata,
  WorkingCopyProperties,
  Timestamp,
  EntityHandler,
  EntityBackup,
  ValidationResult,
  ValidationFunction,
  PluginMetadata,
  NodeTypeDefinition,
  PluginDatabaseConfig,
  PluginUIConfig,
  PluginAPIConfig,
  PluginValidationConfig,
  EntityReferenceHints,
  EntityWorkingCopy,
  EntityWorkingCopySession,
  EntityWorkingCopyStats,
  PeerEntityWorkingCopy,
  GroupEntityWorkingCopy,
  RelationalEntityWorkingCopy,
  ExportOptions,
  ExportResult,
  ImportResult,
  ImportProgress,
  ExportProgress,
  ImportManifest,
  ExportManifest,
  TreeNodeExportData,
  FileImportOptions,
  TemplateImportOptions,
  IdMapping,
  CommandEnvelope,
  ImportNodesPayload,
  EntityType,
  IPluginRegistry,
  CorePeerEntity,
  CoreGroupEntity,
  WorkerPluginRouterAction,
  IconDefinition,
  CategoryDefinition,
  CoreValidationRule,
  CoreNodeLifecycleHooks,
  CorePluginDefinition,
  PluginRoutingConfig,
  NodeTypeConfig,
} from '@hierarchidb/common-type';

// Worker-specific extensions (if needed)

/**
 * Configuration for entity handler
 * This is worker-specific and not defined in core
 */
export interface EntityHandlerConfig {
  tableName: string;
  groupEntityTableName?: string;
  workingCopyTableName?: string;
  cascadeDelete?: boolean;
  versionControl?: boolean;
}

/**
 * Working copy base structure for worker-specific operations
 * @deprecated Use WorkingCopyTypes from core instead
 */
export interface WorkingCopyBase {
  workingCopyId: string;
  nodeId: NodeId;
  isDraft?: boolean;
  workingCopyOf?: NodeId;
  copiedAt: number;
  updatedAt: number;
}
