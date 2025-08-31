import type { NodeType, PluginDefinition } from '@hierarchidb/common-type';

export interface PluginRegistryAPI {
  getPluginDefinition(nodeType: NodeType): Promise<PluginDefinition | undefined>;
  validateNodeTypeOperation(nodeType: NodeType, operation: any, context?: any): Promise<boolean>;
  listRegisteredPlugins(): Promise<PluginDefinition[]>;
  getPluginsForTree(treeId: string): Promise<PluginDefinition[]>;
  getPluginMetadata(pluginId: string): Promise<any>;
  getPluginCapabilities(pluginId: string): Promise<any>;
  isPluginActive(pluginId: string): Promise<boolean>;
  registerPlugin(definition: PluginDefinition): Promise<{ success: boolean; error?: string }>;
  unregisterPlugin(nodeType: NodeType): Promise<{ success: boolean; cleanedUpNodes: number; error?: string }>;
  registerExtension(nodeType: NodeType, api: any): Promise<{ success: boolean }>;
  unregisterExtension(nodeType: NodeType): Promise<{ success: boolean }>;
  getExtension(nodeType: NodeType): Promise<any>;
  hasExtension(nodeType: NodeType): Promise<boolean>;
  listExtensions(): Promise<NodeType[]>;
  invokeExtensionMethod(nodeType: NodeType, method: string, ...args: any[]): Promise<any>;
  validatePluginConfiguration(nodeType: NodeType, config: any): Promise<{ valid: boolean; errors: string[] }>;
  getPluginHealth(nodeType: NodeType): Promise<{ healthy: boolean; issues?: string[] }>;
}