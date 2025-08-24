// Export interfaces
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

export * from './types';
export * from './constants';
export * from './types/entityWorkingCopy';
export * from './patterns';

// Export all utils except those that conflict with types
export * from './utils/commandBuilder';
export * from './utils/image';
export * from './utils/logger';
export * from './utils/memory';
export * from './utils/name';
export * from './utils/page';
export * from './utils/SingletonMixin';
export * from './utils/time';
export * from './utils/validation';
export * from './utils/nodeIdGenerator';
export * from './utils/serialization';
export * from './utils/entityHandlerContext';

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
export {
  toNodeId,
  toEntityId,
  toTreeId,
  isNodeId,
  isEntityId,
  isTreeId,
  generateNodeId,
  generateEntityId,
  generateTreeId
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
  createAutoEntityLifecycleManager
} from './managers/entityManagers';
