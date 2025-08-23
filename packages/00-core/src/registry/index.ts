/**
 * @file openstreetmap-type.ts
 * @description Registry module exports for core package
 */

// Export interfaces
export type {
  INodeTypeRegistry,
  IPluginRegistry,
  INodeDefinitionRegistry,
  ISimpleNodeTypeRegistry,
  NodeTypeConfig,
} from './INodeTypeRegistry';

// Export base class
export { BaseNodeTypeRegistry } from './BaseNodeTypeRegistry';

// Export concrete implementation
export { NodeDefinitionRegistry } from './NodeDefinitionRegistry';

// Direct export as NodeTypeRegistry for immediate migration
export { NodeDefinitionRegistry as NodeTypeRegistry } from './NodeDefinitionRegistry';
