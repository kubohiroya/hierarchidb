/**
 * @file PluginRegistryAPI.ts
 * @description Plugin registration and node type management API
 *
 * This API manages the plugin system, including node type definitions, plugin registration,
 * and validation of plugin capabilities within the hierarchical database system.
 */

import type {
  NodeId,
  NodeType,
  CoreNodeDefinition,
  PluginCapabilities,
  PluginMetadata,
  ValidationResult,
} from '@hierarchidb/common-core';

/**
 * Plugin system management API
 *
 * Provides comprehensive plugin lifecycle management, node type operations,
 * and plugin capability validation within the tree system.
 */
export interface PluginRegistryAPI {
  // ==================
  // Node Type Operations
  // ==================

  /**
   * Get list of all supported node types
   *
   * @returns Array of supported node type identifiers
   *
   * @example
   * ```typescript
   * const nodeTypes = await pluginAPI.listSupportedNodeTypes();
   * console.log('Available types:', nodeTypes); // ['folder', 'document', 'basemap']
   * ```
   */
  listSupportedNodeTypes(): Promise<NodeType[]>;

  /**
   * Check if a specific node type is supported
   *
   * @param nodeType - Node type to validate
   * @returns True if the node type is registered and supported
   *
   * @example
   * ```typescript
   * const isSupported = await pluginAPI.isSupportedNodeType('document');
   * if (isSupported) {
   *   console.log('Document type is available');
   * }
   * ```
   */
  isSupportedNodeType(nodeType: NodeType): Promise<boolean>;

  /**
   * Get detailed definition for a specific node type
   *
   * @param nodeType - Target node type identifier
   * @returns Node type definition including schema, handlers, and UI components
   *
   * @example
   * ```typescript
   * const definition = await pluginAPI.getNodeDefinition('basemap');
   * console.log('Database schema:', definition?.database?.schema);
   * ```
   */
  getNodeDefinition(nodeType: NodeType): Promise<CoreNodeDefinition | undefined>;

  /**
   * Validate node type compatibility for a specific operation
   *
   * @param nodeType - Node type to validate
   * @param operation - Operation type ('create', 'update', 'delete', 'move')
   * @param context - Optional context for validation
   * @returns Validation result with success status and any error messages
   */
  validateNodeTypeOperation(
    nodeType: NodeType,
    operation: 'create' | 'update' | 'delete' | 'move',
    context?: { parentId?: NodeId; targetNodeId?: NodeId }
  ): Promise<ValidationResult>;

  // ==================
  // Plugin Management
  // ==================

  /**
   * Get list of all registered plugins
   *
   * @returns Array of plugin metadata for all registered plugins
   */
  listRegisteredPlugins(): Promise<PluginMetadata[]>;

  /**
   * Get metadata for a specific plugin
   *
   * @param pluginId - Plugin identifier
   * @returns Plugin metadata including capabilities and status
   */
  getPluginMetadata(pluginId: string): Promise<PluginMetadata | undefined>;

  /**
   * Get capabilities of a specific plugin
   *
   * @param pluginId - Plugin identifier
   * @returns Plugin capabilities including supported operations and features
   */
  getPluginCapabilities(pluginId: string): Promise<PluginCapabilities | undefined>;

  /**
   * Check if a plugin is currently active
   *
   * @param pluginId - Plugin identifier
   * @returns True if plugin is loaded and active
   */
  isPluginActive(pluginId: string): Promise<boolean>;

  // ==================
  // Plugin Registry Operations
  // ==================

  /**
   * Register a new plugin with the system
   *
   * @param definition - Complete node type definition for the plugin
   * @returns Success status and any registration errors
   *
   * @example
   * ```typescript
   * const result = await pluginAPI.registerPlugin(myPluginDefinition);
   * if (result.success) {
   *   console.log('Plugin registered successfully');
   * } else {
   *   console.error('Registration failed:', result.error);
   * }
   * ```
   */
  registerPlugin(definition: CoreNodeDefinition): Promise<{
    success: boolean;
    error?: string;
  }>;

  /**
   * Unregister a plugin from the system
   *
   * @param nodeType - Node type identifier to unregister
   * @returns Success status and cleanup results
   */
  unregisterPlugin(nodeType: NodeType): Promise<{
    success: boolean;
    cleanedUpNodes: number;
    error?: string;
  }>;

  /**
   * Reload a plugin with updated definition
   *
   * @param nodeType - Node type to reload
   * @param definition - Updated plugin definition
   * @returns Success status and reload results
   */
  reloadPlugin(
    nodeType: NodeType,
    definition: CoreNodeDefinition
  ): Promise<{
    success: boolean;
    affectedNodes: number;
    error?: string;
  }>;

  // ==================
  // Plugin Validation
  // ==================

  /**
   * Validate plugin definition before registration
   *
   * @param definition - Plugin definition to validate
   * @returns Validation result with detailed error information
   */
  validatePluginDefinition(definition: CoreNodeDefinition): Promise<
    ValidationResult & {
      warnings?: string[];
      recommendations?: string[];
    }
  >;

  /**
   * Check plugin compatibility with current system
   *
   * @param nodeType - Plugin node type to check
   * @returns Compatibility report including version conflicts and dependencies
   */
  checkPluginCompatibility(nodeType: NodeType): Promise<{
    compatible: boolean;
    version: string;
    requiredVersion: string;
    conflicts?: string[];
    missingDependencies?: string[];
  }>;

  /**
   * Get plugin system health status
   *
   * @returns System health metrics and any detected issues
   */
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

  // ==================
  // Node Type Capabilities
  // ==================

  /**
   * Get supported operations for a node type
   *
   * @param nodeType - Target node type
   * @returns Array of operations that the node type supports
   */
  getSupportedOperations(
    nodeType: NodeType
  ): Promise<Array<'create' | 'read' | 'update' | 'delete' | 'move' | 'copy'>>;

  /**
   * Check if a node type supports children
   *
   * @param nodeType - Node type to check
   * @returns True if the node type can have child nodes
   */
  supportsChildren(nodeType: NodeType): Promise<boolean>;

  /**
   * Get allowed child node types for a parent type
   *
   * @param parentType - Parent node type
   * @returns Array of node types that can be children of the parent type
   */
  getAllowedChildTypes(parentType: NodeType): Promise<NodeType[]>;

  // ==================
  // Backward Compatibility - TEMPORARY for migration only
  // ==================

  /** @deprecated Use getNodeDefinition instead. Will be removed after plugin migration. */
  getNodeTypeDefinition(nodeType: NodeType): Promise<CoreNodeDefinition | undefined>;

  // ==================
  // Plugin API Extensions - New 3-Layer Architecture Support
  // ==================

  /**
   * Get plugin API extension for specific node type
   *
   * @param nodeType - Node type to get extension for
   * @returns Plugin API implementation with all registered methods
   *
   * @example
   * ```typescript
   * const projectAPI = await pluginRegistry.getExtension('project');
   * const entity = await projectAPI.createEntity(nodeId, data);
   * ```
   */
  getExtension<T = any>(nodeType: NodeType): Promise<T>;

  /**
   * Register plugin API extension
   *
   * @param nodeType - Node type to register extension for
   * @param api - Plugin API implementation
   *
   * @example
   * ```typescript
   * await pluginRegistry.registerExtension('project', projectPluginAPI);
   * ```
   */
  registerExtension(nodeType: NodeType, api: any): Promise<void>;
}

/**
 * Default export for the PluginRegistryAPI interface
 */
export default PluginRegistryAPI;
