import type { NodeType, PluginDefinition } from '@hierarchidb/common-type';

export interface NodeTypeRegistryAPI {
  // Node Type Operations
  listSupportedNodeTypes(): Promise<NodeType[]>;
  isSupportedNodeType(nodeType: NodeType): Promise<boolean>;
  getNodeDefinition(nodeType: NodeType): Promise<PluginDefinition | undefined>;
  validateNodeTypeOperation(nodeType: NodeType, operation: any, context?: any): Promise<boolean>;

  // Plugin Management
  listRegisteredPlugins(): Promise<PluginDefinition[]>;
  getPluginsForTree(treeId: string): Promise<PluginDefinition[]>;
  getPluginMetadata(pluginId: string): Promise<any>;
  isPluginActive(pluginId: string): Promise<boolean>;

  // Plugin Registry Operations
  registerPlugin(definition: PluginDefinition): Promise<{ success: boolean; error?: string }>;
  unregisterPlugin(nodeType: NodeType): Promise<{ success: boolean; cleanedUpNodes: number; error?: string }>;
  reloadPlugin(nodeType: NodeType, definition: PluginDefinition): Promise<{ success: boolean; affectedNodes: number; error?: string }>;

  // Plugin Validation
  validatePluginDefinition(definition: PluginDefinition): Promise<{ valid: boolean; errors: string[] }>;
  checkPluginCompatibility(nodeType: NodeType): Promise<{ compatible: boolean; version: string; requiredVersion: string }>;
  getPluginSystemHealth(): Promise<{
    totalPlugins: number;
    activePlugins: number;
    failedPlugins: number;
    systemErrors: string[];
    performance: {
      averageLoadTime: number;
      totalMemoryUsage: number;
    };
  }>;

  // Node Type Capabilities
  getSupportedOperations(nodeType: NodeType): Promise<Array<'create' | 'read' | 'update' | 'delete' | 'move' | 'copy'>>;
  supportsChildren(nodeType: NodeType): Promise<boolean>;
  getAllowedChildTypes(parentType: NodeType): Promise<NodeType[]>;

  // Plugin API Extensions
  getExtension(nodeType: NodeType): Promise<any>;
  registerExtension(nodeType: NodeType, api: any): Promise<void>;
}