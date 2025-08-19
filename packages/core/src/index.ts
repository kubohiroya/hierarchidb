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
export * from './utils';
