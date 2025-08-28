// ID Types
export type { NodeId, EntityId, TreeId, WorkingCopyId } from './ids';
export {
  toNodeId,
  toEntityId,
  toTreeId,
  isNodeId,
  isEntityId,
  isTreeId,
  generateNodeId,
  generateEntityId,
  generateTreeId,
} from './ids';

// Base Types
export type {
  Timestamp,
  NodeType,
  IconComponent,
  CreateMenuItem,
  MenuDividerItem,
  CreateMenuItemOrDivider,
} from './base';

// Command Types
export type {
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
} from './command';

// Tree Types
export type {
  Tree,
  NodeBase,
  DescendantProperties,
  ReferenceProperties,
  TrashItemProperties,
  DraftProperties,
  TreeNode,
  TreeNodeWithChildren,
} from './tree';
export { NodeAction } from './tree';

// State Types
export type { TreeRootState, ExpandedStateChanges, SubTreeChanges, TreeViewState } from './state';
export { SortOrder } from './state';

// Working Copy Types
export type { WorkingCopyProperties, WorkingCopy } from './workingCopy';

// Vite Environment Types
// No exports from vite-env

// Node Definition Types
export type {
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
  SubscriptionId,
  SubscriptionOptions,
  TreeNodeEvent,
  CommitResult,
  ValidationRule,
  APIMethodArgs,
  APIMethodReturn,
  WorkerAPIMethod,
  WorkerAPIExtensions,
  TypedWorkerAPIExtensions,
  ClientAPIMethod,
  ClientAPIExtensions,
  TypedClientAPIExtensions,
  NodeTypeDefinition,
  EntityHandler,
  EntityBackup,
  NodeLifecycleHooks,
  NodeDefinition,
  ExtendedPluginDefinition,
  RelationalEntityManager,
} from './nodeDefinition';

// Import/Export Types
export type {
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
  TemplateDefinition,
  TreeNodeExportData,
  ClipboardData,
  IdMapping,
} from './import-export';

// Entity Metadata Types
export type {
  EntityType,
  EntityRelationship,
  ReferenceManagement,
  WorkingCopyConfig,
  EntityMetadata,
  AutoLifecycleConfig,
} from './entityMetadata';

// Plugin Types
export type {
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
  PluginRoutingConfig,
} from './plugin';

// Plugin Extension System Types
export type {
  ExtendingNodeTypeDefinition,
  BaseNodeDefinition,
  DialogStepDefinition,
  ExtendedFieldDefinition,
  ValidationExtension,
  ExtensionMetadata,
  BaseEntityExtension,
  PluginExtensionConfig,
} from './plugin-extension';
