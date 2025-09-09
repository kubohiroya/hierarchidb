/**
 * @file NodeTypeAPI.ts
 * @description Node type management API - focused on node type operations and capabilities
 *
 * This API handles node type registration, validation, and capability queries.
 * It's separated from plugin-specific functionality for better separation of concerns.
 */

import type {
  NodeId,
  NodeLifecycleHooks,
  NodeType,
  PluginDefinition,
  TreeNode,
  ValidationResult,
} from '@hierarchidb/common-type';

/**
 * Node type management API
 *
 * Provides operations for managing node types, their capabilities, and validations.
 * This API is focused purely on node type concerns, separated from plugin management.
 *
 * @example
 * ```typescript
 * const nodeTypeAPI = workerAPI.getNodeTypeAPI();
 *
 * // Check if a node type is supported
 * const isSupported = await nodeTypeAPI.isSupported('folder-plugin');
 *
 * // Get supported operations
 * const operations = await nodeTypeAPI.getSupportedOperations('document');
 * ```
 */
export interface NodeTypeAPI {
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
   * const nodeTypes = await nodeTypeAPI.listSupported();
   * console.log('Available types:', nodeTypes); // ['folder-plugin', 'document', 'basemap']
   * ```
   */
  listSupported(): Promise<NodeType[]>;

  /**
   * Check if a specific node type is supported
   *
   * @param nodeType - Node type to validate
   * @returns True if the node type is registered and supported
   *
   * @example
   * ```typescript
   * const isSupported = await nodeTypeAPI.isSupported('document');
   * if (isSupported) {
   *   console.log('Document type is available');
   * }
   * ```
   */
  isSupported(nodeType: NodeType): Promise<boolean>;

  /**
   * Validate node type compatibility for a specific operation
   *
   * @param nodeType - Node type to validate
   * @param operation - Operation type ('create', 'update', 'delete', 'move')
   * @param context - Optional context for validation
   * @returns Validation result with success status and any error messages
   */
  validateOperation(
    nodeType: NodeType,
    operation: 'create' | 'update' | 'delete' | 'move',
    context?: { parentId?: NodeId; targetNodeId?: NodeId },
  ): Promise<ValidationResult>;

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
    nodeType: NodeType,
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

  /**
   * Check if a node type has a specific capability
   *
   * @param nodeType - Node type to check
   * @param capability - Capability to check for
   * @returns True if the node type has the capability
   */
  hasCapability(nodeType: NodeType, capability: string): Promise<boolean>;

  // ==================
  // Node Type Registration Management
  // ==================

  /**
   * Register a new node type definition
   *
   * @param nodeTypeDefinition - Complete node type definition
   * @throws Error if node type is already registered
   */
  registerNodeType(nodeTypeDefinition: PluginDefinition): Promise<void>;

  /**
   * Unregister an existing node type
   *
   * @param nodeType - Node type identifier to unregister
   * @throws Error if node type is not registered or is still in use
   */
  unregisterNodeType(nodeType: NodeType): Promise<void>;

  /**
   * Get complete list of registered node types
   *
   * @returns Array of all registered node type identifiers
   */
  listNodeTypes(): Promise<NodeType[]>;

  /**
   * Get the complete definition for a registered node type
   *
   * @param nodeType - Node type identifier
   * @returns Node type definition, or null if not registered
   */
  getNodeTypeDefinition(nodeType: NodeType): Promise<PluginDefinition | null>;

  /**
   * Check if a specific node type is registered
   *
   * @param nodeType - Node type identifier
   * @returns True if the node type is registered
   */
  isNodeTypeRegistered(nodeType: NodeType): Promise<boolean>;

  // ==================
  // Node Type Categorization
  // ==================

  /**
   * Get node types filtered by metadata category
   *
   * @param category - Category string to filter by
   * @returns Array of node types in the specified category
   */
  getNodeTypesByCategory(category: string): Promise<NodeType[]>;

  /**
   * Check if a parent type can contain a specific child type
   *
   * @param parentType - Parent node type
   * @param childType - Potential child node type
   * @returns True if parent can contain child
   */
  canContainChild(parentType: NodeType, childType: NodeType): Promise<boolean>;

  // ==================
  // Node Type Metadata
  // ==================

  /**
   * Get metadata for a registered node type
   *
   * @param nodeType - Node type identifier
   * @returns Node type metadata, or null if not registered
   */
  getNodeTypeMetadata(nodeType: NodeType): Promise<PluginDefinition | null>;

  /**
   * Update metadata for a registered node type
   *
   * @param nodeType - Node type identifier
   * @param metadata - New metadata to set
   * @throws Error if node type is not registered
   */
  updateNodeTypeMetadata(nodeType: NodeType, metadata: PluginDefinition): Promise<void>;

  // ==================
  // Node Type Validation
  // ==================

  /**
   * Validate a node against its type's validation rules
   *
   * @param node - Node to validate
   * @returns Validation result with any error messages
   */
  validateNodeType(node: TreeNode): Promise<{ valid: boolean; errors: string[] }>;

  // ==================
  // Node Type Hooks
  // ==================

  /**
   * Get lifecycle hooks for a node type
   *
   * @param nodeType - Node type identifier
   * @returns Lifecycle hooks, or null if none defined
   */
  getNodeTypeHooks(nodeType: NodeType): Promise<NodeLifecycleHooks<any> | null>;

  // ==================
  // Node Type Statistics
  // ==================

  /**
   * Get usage statistics for all node types
   *
   * @returns Object mapping node type to count of nodes of that type
   */
  getNodeTypeStats(): Promise<Record<NodeType, number>>;
}

/**
 * Default export for the NodeTypeAPI interface
 */
export default NodeTypeAPI;
