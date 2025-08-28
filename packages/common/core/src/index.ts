// Export interfaces
// Registry interfaces remain in old location for backwards compatibility
export type {
  INodeTypeRegistry,
  IPluginRegistry,
  INodeDefinitionRegistry,
  ISimpleNodeTypeRegistry,
  NodeTypeConfig,
} from './registry/INodeTypeRegistry';

// Export base class
export { BaseNodeTypeRegistry } from './registry/BaseNodeTypeRegistry';

// Export concrete implementation
export { NodeDefinitionRegistry } from './registry/NodeDefinitionRegistry';

// Direct export as NodeTypeRegistry for immediate migration
export { NodeDefinitionRegistry as NodeTypeRegistry } from './registry/NodeDefinitionRegistry';

// Plugin system exports
export * from './plugin-system';

// Re-export from types (already explicit in types/index.ts)
export * from './types';

export type {
  // ID Types
  NodeId,
  EntityId,
  TreeId,
  WorkingCopyId,
  // Base Types
  Timestamp,
  NodeType,
  IconComponent,
  CreateMenuItem,
  MenuDividerItem,
  CreateMenuItemOrDivider,
  // Tree Types
  Tree,
  NodeBase,
  DescendantProperties,
  ReferenceProperties,
  TrashItemProperties,
  DraftProperties,
  TreeNode,
  TreeNodeWithChildren,
  // Working Copy Types
  WorkingCopyProperties,
  WorkingCopy,
  // Command Types
  CommandGroupId,
  CommandId,
  Seq,
  OnNameConflict,
  CommandEnvelope,
  ErrorCode,
  CommandResult,
  CreateWorkingCopyForCreatePayload,
  CreateWorkingCopyPayload,
  DiscardWorkingCopyPayload,
  CommitWorkingCopyForCreatePayload,
  CommitWorkingCopyPayload,
  MoveNodesPayload,
  DuplicateNodesPayload,
  PasteNodesPayload,
  MoveToTrashPayload,
  RemovePayload,
  RecoverFromTrashPayload,
  ImportNodesPayload,
  CopyNodesPayload,
  ExportNodesPayload,
  UndoPayload,
  RedoPayload,
  GetTreePayload,
  GetNodePayload,
  GetChildrenPayload,
  GetDescendantsPayload,
  GetAncestorsPayload,
  SearchNodesPayload,
  ObserveNodePayload,
  SubscribeChildrenPayload,
  ObserveSubtreePayload,
  ObserveWorkingCopiesPayload,
  SubscriptionFilter,
  TreeChangeEventType,
  TreeChangeEvent,
  // Node Definition Types
  BaseEntity,
  PeerEntity,
  GroupEntity,
  RelationalEntity,
  ValidationErrors,
  DatabaseSchema,
  ValidationResult,
  PluginCapabilities,
  PluginMetadata,
  EntityReferenceHints,
  EntityHandler,
  EntityBackup,
  NodeLifecycleHooks,
  NodeDefinition,
  NodeTypeDefinition,
  ValidationRule,
  APIMethodArgs,
  APIMethodReturn,
  WorkerAPIMethod,
  TreeNodeEvent,
  SubscriptionId,
  SubscriptionOptions,
  CommitResult,
  // Plugin Types
  IconDefinition,
  CategoryDefinition,
  NodeCapability,
  WorkerPluginRouterAction,
  PluginDatabaseConfig,
  PluginUIConfig,
  PluginAPIConfig,
  PluginValidationConfig,
  PluginI18nConfig,
  PluginDefinition,
  BaseEntityExtension,
  PluginRoutingConfig,
  ExtendedPluginDefinition,
  // State Types
  TreeRootState,
  ExpandedStateChanges,
  SubTreeChanges,
  TreeViewState,
  // Import/Export Types
  ImportManifest,
  ExportManifest,
  ImportProgress,
  ExportProgress,
  ImportResult,
  ExportResult,
  ImportOptions,
  FileImportOptions,
  TemplateImportOptions,
  ExportOptions,
  TreeNodeExportData,
  ClipboardData,
  IdMapping,
  // Entity Metadata Types
  EntityType,
  EntityRelationship,
  ReferenceManagement,
  WorkingCopyConfig,
  EntityMetadata,
  AutoLifecycleConfig,
} from './types';

// Re-export from constants
export {
  TREE_ROOT_NODE_TYPES,
  NODE_TYPES,
  isTreeRootNodeType,
  isRootNodeType,
  isTrashNodeType,
  isSuperRootNodeType,
} from './constants';
export type { TreeRootNodeType } from './constants';

// Entity Working Copy Types
export type {
  EntityWorkingCopyProperties,
  PeerEntityWorkingCopy,
  GroupEntityWorkingCopy,
  RelationalEntityWorkingCopy,
  EntityWorkingCopy,
  EntityWorkingCopyChange,
  EntityWorkingCopySession,
  EntityWorkingCopyConflict,
  EntityWorkingCopyBatch,
  EntityWorkingCopyValidation,
  EntityWorkingCopyAutoSaveConfig,
  EntityWorkingCopyStats,
} from './types/entityWorkingCopy';

// Patterns
export { BaseReferenceCountingHandler } from './base';

// Utils - Command Builder
export { createCommand, createBatchCommand, CommandActions } from './utils/commandBuilder';
export type { CommandOptions, CommandAction } from './utils/commandBuilder';

// Utils - Image (no exports in this file)

// Utils - Logger
export {
  devLog,
  devWarn,
  devError,
  devInfo,
  devDebug,
  devTable,
  devGroup,
  devGroupCollapsed,
  devGroupEnd,
  devTime,
  devTimeEnd,
  devTimeLog,
  devLogIf,
  devWarnIf,
  devErrorIf,
  devInspect,
  devPerf,
  devPerfAsync,
  devLifecycle,
  devAssert,
  devFeature,
  devAPI,
  deprecatedLog,
} from './utils/logger';

// Utils - Memory
export { formatBytes, clampPercentage, getMemorySeverity } from './utils/memory';

// Utils - Name
export { normalizeName } from './utils/name';

// Utils - Page
export {
  getPageButtonColor,
  getPageBackgroundColor,
  getEditButtonColor,
  getPreviewButtonColor,
  determinePageType,
} from './utils/page';
export type { PageType } from './utils/page';

// Utils - SingletonMixin
export { SingletonMixin } from './utils/SingletonMixin';

// Utils - Time
export { getCurrentTimestamp } from './utils/time';

// Utils - Validation
export {
  assertNonNull,
  isValidTreeNodeName,
  NODE_VALIDATION_CONSTANTS,
  validateNodeName,
  validateNodeDescription,
  validateNodeTags,
  validateCommonNodeData,
  canMoveNode,
  validateExternalURL,
} from './utils/validation';
export type { CommonValidationResult, NodeDataValidation } from './utils/validation';

// Utils - Node ID Generator
export { NodeIdGenerator } from './utils/nodeIdGenerator';

// Utils - Serialization
export {
  ValidationError,
  deserializeTreeNode,
  deserializeTree,
  serializeTreeNode,
  serializeTree,
  parseTreeNode,
  parseTree,
  deserializeTreeNodes,
  validateIds,
  cleanSerialize,
  analyzeDataStructure,
} from './utils/serialization';

// Utils - Plugin Serialization
export { PluginEntitySerializer } from './utils/plugin-serializer';
export type { SerializationResult, DeserializationInput } from './types/plugin-serialization';

// Utils - Entity Handler Context
export type { EntityHandlerContext } from './utils/entityHandlerContext';

// Export ID utilities with explicit naming to resolve conflicts
export {
  // Factory functions (from utils/idFactory) - for validated creation
  createNodeId,
  createTreeId,
  createEntityId,
  generateNodeId as generateValidatedNodeId,
  generateTreeId as generateValidatedTreeId,
  generateEntityId as generateValidatedEntityId,
  // Validation functions
  isValidNodeIdString,
  isValidTreeIdString,
  isValidEntityIdString,
  validateNodeIds,
} from './utils/idFactory';

// Type helpers and simple generators (from types/ids) - preferred for basic usage
// Note: toNodeId, toEntityId, toTreeId are already exported from './types' above
export {
  isNodeId,
  isEntityId,
  isTreeId,
  generateNodeId,
  generateEntityId,
  generateTreeId,
} from './types/ids';
// Export entity managers (avoiding naming conflicts)
export {
  PeerEntityManager,
  GroupEntityManager,
  RelationalEntityManagerImpl,
  EphemeralPeerEntityManager,
  EphemeralGroupEntityManager,
  AutoEntityLifecycleManager,
  createPeerEntityManager,
  createGroupEntityManager,
  createRelationalEntityManager,
  createEphemeralPeerEntityManager,
  createEphemeralGroupEntityManager,
  createAutoEntityLifecycleManager,
} from './managers/entityManagers';
