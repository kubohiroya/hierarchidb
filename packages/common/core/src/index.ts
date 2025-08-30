/*
 このパッケージ @hierarchidb/common-core のパッケージで提供しているメソッドの見直しをするため、このindex.tsから、それらのメソッドのexportをいったん削除していることに注意。
 */

export * from './managers/entityManagers';
export * from './utils/logger';

// ID generation utilities
export { generateNodeId, generateEntityId } from './utils/idUtil';
export { NodeIdGenerator } from './utils/nodeIdGenerator';

// ID types - re-export from common-type
export type { NodeId, EntityId, TreeId, WorkingCopyId, NodeType } from '@hierarchidb/common-type';

// Constants - re-export from common-type
export { TREE_ROOT_NODE_TYPES } from '@hierarchidb/common-type';

// Registry implementations moved to worker package
// Only re-export types from common-type for backward compatibility

// Re-export registry types from common-type for backward compatibility
export type {
  INodeTypeRegistry,
  IPluginRegistry,
  INodeDefinitionRegistry,
  NodeTypeConfig,
  ISimpleNodeTypeRegistry,
  WorkingCopy,
  BaseEntity,
  GroupEntity,
  WorkingCopyProperties,
  EntityHandler,
  EntityBackup,
  ValidationResult,
  PeerEntity,
  RelationalEntity,
  EntityMetadata,
  NodeTypeDefinition,
  PluginMetadata,
} from '@hierarchidb/common-type';

// Utils - needed by several packages
export { SingletonMixin } from './utils/SingletonMixin';
export { serializeTreeNode, deserializeTreeNode } from './utils/serialization';
